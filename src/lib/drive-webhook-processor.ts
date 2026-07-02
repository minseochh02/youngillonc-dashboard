/**
 * Google Drive Webhook Change Processor
 *
 * Processes Drive API changes, filters for target folders, and logs to database.
 */

import { drive_v3 } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';
import { executeSQL, insertRows, updateRows } from '../../egdesk-helpers';
import {
  createDriveClient,
  listChanges,
  isFileInTargetFolders,
  listFolderContentsAll,
  downloadFile,
  getFileMetadata,
  deleteFileFromDrive
} from './google-drive-client';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
import { processEMLFile, updateDeletionStatus, InsertResult } from './eml-processor';
import { generateActivitiesForDateRange } from './activity-generator';

interface SyncState {
  id: number;
  page_token: string;
  channel_id: string | null;
  channel_resource_id: string | null;
  channel_expiration: string | null;
  target_folder_ids: string | null;
  last_updated: string;
  created_at: string;
}

/**
 * Get current sync state from database
 */
export async function getSyncState(): Promise<SyncState | null> {
  const result = await executeSQL('SELECT * FROM drive_sync_state WHERE id = 1');

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as SyncState;
}

/**
 * Update page token in database
 */
export async function updatePageToken(pageToken: string): Promise<void> {
  await updateRows(
    'drive_sync_state',
    {
      page_token: pageToken,
      last_updated: new Date().toISOString()
    },
    { filters: { id: '1' } }
  );
}

/**
 * Parse target folder IDs from sync state
 */
export function parseTargetFolderIds(state: SyncState): string[] {
  if (!state.target_folder_ids) {
    return [];
  }

  try {
    const parsed = JSON.parse(state.target_folder_ids);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fallback: treat as comma-separated string
    return state.target_folder_ids.split(',').map(id => id.trim()).filter(Boolean);
  }
}

/**
 * Log file event to database
 */
export async function logFileEvent(
  fileId: string,
  fileName: string,
  eventType: 'created' | 'modified' | 'deleted',
  metadata?: {
    mimeType?: string;
    folderId?: string;
    modifiedTime?: string;
    fileSize?: number;
    additionalData?: any;
  }
): Promise<void> {
  await insertRows('drive_file_events', [
    {
      file_id: fileId,
      file_name: fileName,
      mime_type: metadata?.mimeType || null,
      folder_id: metadata?.folderId || null,
      event_type: eventType,
      modified_time: metadata?.modifiedTime || null,
      detected_at: new Date().toISOString(),
      downloaded: 0,
      file_size: metadata?.fileSize || null,
      metadata: metadata?.additionalData ? JSON.stringify(metadata.additionalData) : null
    }
  ]);

  console.log(`📝 Logged ${eventType} event: ${fileName} (${fileId})`);
}

/**
 * Check whether a file already has an event logged (any event type).
 * Used to make the snapshot idempotent so re-running init does not
 * re-process / re-download files that were already captured.
 */
export async function hasFileEvent(fileId: string): Promise<boolean> {
  const escapedFileId = fileId.replace(/'/g, "''");
  const result = await executeSQL(
    `SELECT 1 FROM drive_file_events WHERE file_id = '${escapedFileId}' LIMIT 1`
  );
  return !!(result.rows && result.rows.length > 0);
}

/**
 * Mark file as downloaded in database
 */
export async function markFileDownloaded(
  fileId: string,
  downloadPath: string
): Promise<void> {
  await updateRows(
    'drive_file_events',
    {
      downloaded: 1,
      download_path: downloadPath
    },
    { filters: { file_id: fileId, downloaded: '0' } }
  );
}

/**
 * Check if file should be downloaded based on mime type
 */
export function shouldDownloadFile(mimeType: string | undefined | null): boolean {
  if (!mimeType) return false;

  // Download common document and data formats
  const downloadableTypes = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/json',
    'application/zip',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'message/rfc822'  // EML files
  ];

  return downloadableTypes.includes(mimeType);
}

/**
 * Check if file should be processed as EML
 */
export function shouldProcessEML(
  mimeType: string | undefined | null,
  fileName: string
): boolean {
  return mimeType === 'message/rfc822' || fileName.toLowerCase().endsWith('.eml');
}

/**
 * Get download path for a file
 */
export function getDownloadPath(fileId: string, fileName: string): string {
  const downloadDir = process.env.DRIVE_DOWNLOAD_PATH || './drive-downloads';
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(downloadDir, `${fileId}_${sanitizedFileName}`);
}

/**
 * Process EML file in background
 * Parses messages, inserts to database, and deletes file from Drive and local storage
 */
async function processEMLInBackground(
  drive: drive_v3.Drive,
  fileId: string,
  downloadPath: string,
  fileName: string
): Promise<void> {
  try {
    console.log(`📧 Processing EML in background: ${fileName}`);

    // Process the EML file (parse and insert messages)
    const result = await processEMLFile(fileId, downloadPath, fileName);
    console.log(`📊 EML Result: Found ${result.found}, Inserted ${result.inserted}, Duplicates ${result.duplicates}`);

    // Generate activities immediately for newly inserted messages (blocking)
    if (result.inserted > 0) {
      console.log(`🤖 Starting activity generation for ${result.inserted} new messages...`);
      await triggerActivityGeneration(fileId, result);
    } else {
      console.log(`⏭️  Skipping activity generation (${result.inserted} new messages, ${result.duplicates} duplicates)`);
    }

    let deletedLocal = false;
    let deletedDrive = false;

    // Delete local file
    try {
      if (fs.existsSync(downloadPath)) {
        fs.unlinkSync(downloadPath);
        deletedLocal = true;
        console.log(`🗑️  Deleted local file: ${fileName}`);
      }
    } catch (error: any) {
      console.error(`⚠️  Failed to delete local file: ${error.message}`);
    }

    // Delete from Google Drive
    try {
      await deleteFileFromDrive(drive, fileId);
      deletedDrive = true;
      console.log(`🗑️  Deleted from Drive: ${fileName}`);
    } catch (error: any) {
      console.error(`⚠️  Failed to delete from Drive: ${error.message}`);
    }

    // Update deletion status in log
    await updateDeletionStatus(fileId, deletedDrive, deletedLocal);

    console.log(`✅ EML processing complete: ${fileName}`);
  } catch (error: any) {
    console.error(`❌ EML processing error for ${fileName}: ${error.message}`);
  }
}

/**
 * Get date range of newly inserted messages for activity generation
 */
async function getInsertedMessageDateRange(chatRoom: string): Promise<{startDate: string, endDate: string} | null> {
  // Escape single quotes for SQL safety
  const escapedChatRoom = chatRoom.replace(/'/g, "''");

  const query = `
    SELECT
      MIN(DATE(chat_date)) as start_date,
      MAX(DATE(chat_date)) as end_date
    FROM kakaotalk_raw_messages
    WHERE chat_room = '${escapedChatRoom}'
      AND id > (
        SELECT COALESCE(MAX(source_message_id), 0)
        FROM employee_activity_log
        WHERE chat_room = '${escapedChatRoom}'
      )
  `;

  const result = await executeSQL(query);
  const row = result.rows?.[0];

  if (!row?.start_date || !row?.end_date) {
    return null;
  }

  return {
    startDate: row.start_date,
    endDate: row.end_date
  };
}

/**
 * Log activity generation start
 */
async function logActivityGenerationStart(fileId: string, chatRoom: string): Promise<number> {
  const result = await insertRows('activity_generation_log', [{
    eml_file_id: fileId,
    chat_room: chatRoom,
    status: 'processing',
    started_at: new Date().toISOString()
  }]);
  return result.insertedIds?.[0] || 0;
}

/**
 * Update activity generation log status
 */
async function updateActivityGenerationLog(
  id: number,
  status: string,
  activitiesGenerated: number,
  startDate?: string,
  endDate?: string,
  errorMessage?: string
): Promise<void> {
  await updateRows('activity_generation_log', {
    status,
    activities_generated: activitiesGenerated,
    start_date: startDate,
    end_date: endDate,
    error_message: errorMessage,
    completed_at: new Date().toISOString()
  }, { ids: [id] });
}

/**
 * Trigger activity generation for newly inserted messages
 */
async function triggerActivityGeneration(
  fileId: string,
  insertResult: InsertResult
): Promise<void> {
  let logId = 0;

  try {
    console.log(`🤖 Triggering activity generation for ${insertResult.inserted} new messages...`);

    // Get chat room from eml_processing_log
    const escapedFileId = fileId.replace(/'/g, "''");
    const logEntry = await executeSQL(
      `SELECT chat_room FROM eml_processing_log WHERE file_id = '${escapedFileId}' LIMIT 1`
    );
    const chatRoom = logEntry.rows?.[0]?.chat_room || 'Unknown';

    // Log start
    logId = await logActivityGenerationStart(fileId, chatRoom);

    // Get date range of newly inserted messages
    const dateRange = await getInsertedMessageDateRange(chatRoom);

    if (!dateRange) {
      console.log('  ℹ️  No new messages to process for activity generation');
      await updateActivityGenerationLog(logId, 'completed', 0);
      return;
    }

    console.log(`  📅 Processing activities for ${dateRange.startDate} to ${dateRange.endDate}`);

    // Generate activities (blocking)
    const result = await generateActivitiesForDateRange(
      dateRange.startDate,
      dateRange.endDate,
      { chatRoom, logToFile: false }
    );

    // Log completion
    await updateActivityGenerationLog(
      logId,
      'completed',
      result.totalActivities,
      dateRange.startDate,
      dateRange.endDate
    );

    console.log(`✅ Generated ${result.totalActivities} activities from ${insertResult.inserted} messages`);

    if (result.errors.length > 0) {
      console.log(`  ⚠️  ${result.errors.length} dates failed to process`);
    }

  } catch (error: any) {
    console.error(`❌ Activity generation failed: ${error.message}`);

    // Log failure but continue (file cleanup still happens)
    if (logId > 0) {
      await updateActivityGenerationLog(
        logId,
        'failed',
        0,
        undefined,
        undefined,
        error.message
      );
    }
    // Don't throw - allow file cleanup to proceed
  }
}

/**
 * Process a file that is known to live in a target folder.
 *
 * Logs the event, downloads the file when appropriate, and kicks off EML
 * processing in the background. Shared by the change stream (processFileChange)
 * and the init-time snapshot (snapshotTargetFolders).
 *
 * @returns whether the file was logged and whether it was downloaded
 */
async function processTargetFile(
  drive: drive_v3.Drive,
  file: drive_v3.Schema$File,
  eventType: 'created' | 'modified'
): Promise<{ logged: boolean; downloaded: boolean }> {
  const fileId = file.id;
  if (!fileId) {
    return { logged: false, downloaded: false };
  }

  // Get parent folder ID
  const folderId = file.parents && file.parents.length > 0 ? file.parents[0] : undefined;

  // Log the event
  await logFileEvent(fileId, file.name || 'Unknown', eventType, {
    mimeType: file.mimeType || undefined,
    folderId,
    modifiedTime: file.modifiedTime || undefined,
    fileSize: file.size ? parseInt(file.size) : undefined
  });

  let downloaded = false;

  // Download file if appropriate
  if (shouldDownloadFile(file.mimeType)) {
    try {
      const downloadPath = getDownloadPath(fileId, file.name || 'unknown');
      await downloadFile(drive, fileId, downloadPath);
      await markFileDownloaded(fileId, downloadPath);
      downloaded = true;

      // Process EML files automatically
      if (shouldProcessEML(file.mimeType, file.name || '')) {
        console.log(`📧 Detected EML file: ${file.name}`);

        // Process in background (don't await to avoid blocking)
        processEMLInBackground(drive, fileId, downloadPath, file.name || 'unknown')
          .catch(error => {
            console.error(`❌ Background EML processing failed:`, error);
          });
      }
    } catch (error: any) {
      console.error(`❌ Failed to download file ${fileId}: ${error.message}`);
      // Continue processing other files even if download fails
    }
  }

  return { logged: true, downloaded };
}

/**
 * Process a single file change
 */
async function processFileChange(
  drive: drive_v3.Drive,
  change: drive_v3.Schema$Change,
  targetFolderIds: string[]
): Promise<void> {
  const file = change.file;
  const fileId = change.fileId;

  if (!file || !fileId) {
    return;
  }

  // Check if file is removed/deleted
  if (change.removed || file.trashed) {
    await logFileEvent(fileId, file.name || 'Unknown', 'deleted', {
      modifiedTime: change.time || undefined
    });
    return;
  }

  // Check if file is in target folders
  const isInTarget = await isFileInTargetFolders(drive, fileId, targetFolderIds);
  if (!isInTarget) {
    return; // Skip files not in target folders
  }

  // Determine event type (created vs modified)
  // If file's creation time is close to modification time, it's likely new
  const eventType: 'created' | 'modified' = 'modified'; // Simplified for now

  await processTargetFile(drive, file, eventType);
}

/**
 * Process all changes since last page token
 *
 * Main entry point for webhook processing
 */
export async function processChanges(): Promise<{
  changesProcessed: number;
  filesLogged: number;
  filesDownloaded: number;
}> {
  console.log('🔄 Processing Drive changes...');

  // Get current sync state
  const state = await getSyncState();
  if (!state) {
    throw new Error('Sync state not initialized. Run /api/drive/init first.');
  }

  const targetFolderIds = parseTargetFolderIds(state);
  if (targetFolderIds.length === 0) {
    console.log('⚠️  No target folders configured. Skipping processing.');
    return { changesProcessed: 0, filesLogged: 0, filesDownloaded: 0 };
  }

  console.log(`📂 Monitoring folders: ${targetFolderIds.join(', ')}`);

  const drive = createDriveClient();
  let pageToken = state.page_token;
  let totalChanges = 0;
  let filesLogged = 0;
  let filesDownloaded = 0;

  // Process changes with pagination
  while (true) {
    const result = await listChanges(drive, pageToken);
    const changes = result.changes;

    console.log(`📊 Fetched ${changes.length} changes`);

    // Process each change
    for (const change of changes) {
      try {
        await processFileChange(drive, change, targetFolderIds);
        totalChanges++;
        if (change.file && !change.removed && !change.file.trashed) {
          filesLogged++;
          if (shouldDownloadFile(change.file.mimeType)) {
            filesDownloaded++;
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing change: ${error.message}`);
        // Continue with next change
      }
    }

    // Update page token
    if (result.nextPageToken) {
      // More pages available
      pageToken = result.nextPageToken;
      await updatePageToken(pageToken);
    } else if (result.newStartPageToken) {
      // All caught up
      pageToken = result.newStartPageToken;
      await updatePageToken(pageToken);
      break;
    } else {
      break;
    }
  }

  console.log(`✅ Processing complete: ${totalChanges} changes, ${filesLogged} files logged, ${filesDownloaded} files downloaded`);

  return {
    changesProcessed: totalChanges,
    filesLogged,
    filesDownloaded
  };
}

/**
 * Snapshot the current contents of all target folders.
 *
 * The change stream (getStartPageToken / processChanges) is forward-only: it
 * only sees changes made AFTER the sync state was initialized. Files that
 * already exist in the target folders at init time would otherwise never be
 * processed. This walks every target folder (recursing into sub-folders) and
 * runs each existing file through the same log/download/EML pipeline.
 *
 * Idempotent: files already present in drive_file_events are skipped, so it is
 * safe to run on reset/re-init or alongside the change stream (overlap is
 * deduped here and, for EML messages, again at the message level).
 */
export async function snapshotTargetFolders(): Promise<{
  filesFound: number;
  filesLogged: number;
  filesDownloaded: number;
  filesSkipped: number;
}> {
  console.log('📸 Snapshotting current target folder contents...');

  const state = await getSyncState();
  if (!state) {
    throw new Error('Sync state not initialized. Run /api/drive/init first.');
  }

  const targetFolderIds = parseTargetFolderIds(state);
  if (targetFolderIds.length === 0) {
    console.log('⚠️  No target folders configured. Skipping snapshot.');
    return { filesFound: 0, filesLogged: 0, filesDownloaded: 0, filesSkipped: 0 };
  }

  console.log(`📂 Snapshotting folders: ${targetFolderIds.join(', ')}`);

  const drive = createDriveClient();
  let filesFound = 0;
  let filesLogged = 0;
  let filesDownloaded = 0;
  let filesSkipped = 0;

  // Breadth-first walk through target folders and their sub-folders.
  const visited = new Set<string>();
  const queue: string[] = [...targetFolderIds];

  while (queue.length > 0) {
    const folderId = queue.shift()!;
    if (visited.has(folderId)) {
      continue; // Guard against cycles / shared sub-folders
    }
    visited.add(folderId);

    let entries: drive_v3.Schema$File[];
    try {
      entries = await listFolderContentsAll(drive, folderId);
    } catch (error: any) {
      console.error(`❌ Failed to list folder ${folderId}: ${error.message}`);
      continue; // Skip this folder but keep snapshotting the rest
    }

    for (const file of entries) {
      // Recurse into sub-folders
      if (file.mimeType === FOLDER_MIME_TYPE) {
        if (file.id) {
          queue.push(file.id);
        }
        continue;
      }

      if (!file.id) {
        continue;
      }

      filesFound++;

      try {
        // Skip files already captured (idempotent re-runs / stream overlap)
        if (await hasFileEvent(file.id)) {
          filesSkipped++;
          continue;
        }

        const { logged, downloaded } = await processTargetFile(drive, file, 'created');
        if (logged) filesLogged++;
        if (downloaded) filesDownloaded++;
      } catch (error: any) {
        console.error(`❌ Error snapshotting file ${file.id}: ${error.message}`);
        // Continue with next file
      }
    }
  }

  console.log(
    `✅ Snapshot complete: ${filesFound} found, ${filesLogged} logged, ` +
    `${filesDownloaded} downloaded, ${filesSkipped} already known`
  );

  return { filesFound, filesLogged, filesDownloaded, filesSkipped };
}
