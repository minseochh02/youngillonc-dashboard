/**
 * Google Drive Webhook Change Processor
 *
 * Processes Drive API changes, filters for target folders, and logs to database.
 */

import { drive_v3 } from 'googleapis';
import * as path from 'path';
import { executeSQL } from '../../egdesk-helpers';
import {
  createDriveClient,
  listChanges,
  isFileInTargetFolders,
  downloadFile,
  getFileMetadata
} from './google-drive-client';

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
  await executeSQL(`
    UPDATE drive_sync_state
    SET page_token = '${pageToken.replace(/'/g, "''")}',
        last_updated = '${new Date().toISOString()}'
    WHERE id = 1
  `);
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
  const mimeType = metadata?.mimeType || null;
  const folderId = metadata?.folderId || null;
  const modifiedTime = metadata?.modifiedTime || null;
  const fileSize = metadata?.fileSize || null;
  const additionalData = metadata?.additionalData ? JSON.stringify(metadata.additionalData) : null;

  await executeSQL(`
    INSERT INTO drive_file_events (
      file_id,
      file_name,
      mime_type,
      folder_id,
      event_type,
      modified_time,
      file_size,
      metadata
    ) VALUES (
      '${fileId.replace(/'/g, "''")}',
      '${fileName.replace(/'/g, "''")}',
      ${mimeType ? `'${mimeType.replace(/'/g, "''")}'` : 'NULL'},
      ${folderId ? `'${folderId.replace(/'/g, "''")}'` : 'NULL'},
      '${eventType}',
      ${modifiedTime ? `'${modifiedTime}'` : 'NULL'},
      ${fileSize || 'NULL'},
      ${additionalData ? `'${additionalData.replace(/'/g, "''")}'` : 'NULL'}
    )
  `);

  console.log(`📝 Logged ${eventType} event: ${fileName} (${fileId})`);
}

/**
 * Mark file as downloaded in database
 */
export async function markFileDownloaded(
  fileId: string,
  downloadPath: string
): Promise<void> {
  await executeSQL(`
    UPDATE drive_file_events
    SET downloaded = 1,
        download_path = '${downloadPath.replace(/'/g, "''")}'
    WHERE file_id = '${fileId.replace(/'/g, "''")}' AND downloaded = 0
  `);
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
    'image/jpg'
  ];

  return downloadableTypes.includes(mimeType);
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

  // Get parent folder ID
  const folderId = file.parents && file.parents.length > 0 ? file.parents[0] : undefined;

  // Log the event
  await logFileEvent(fileId, file.name || 'Unknown', eventType, {
    mimeType: file.mimeType || undefined,
    folderId,
    modifiedTime: file.modifiedTime || undefined,
    fileSize: file.size ? parseInt(file.size) : undefined
  });

  // Download file if appropriate
  if (shouldDownloadFile(file.mimeType)) {
    try {
      const downloadPath = getDownloadPath(fileId, file.name || 'unknown');
      await downloadFile(drive, fileId, downloadPath);
      await markFileDownloaded(fileId, downloadPath);
    } catch (error: any) {
      console.error(`❌ Failed to download file ${fileId}: ${error.message}`);
      // Continue processing other files even if download fails
    }
  }
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
