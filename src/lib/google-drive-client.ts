/**
 * Google Drive API Client
 *
 * Handles authentication and Drive API operations using service account credentials.
 */

import { google } from 'googleapis';
import { drive_v3 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create an authenticated Google Drive client using service account
 */
export function createDriveClient(): drive_v3.Drive {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!credentialsJson) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set. ' +
      'Please add your service account credentials to .env.local'
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch (error) {
    throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON. Ensure it is valid JSON.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ]
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * List files in a specific folder
 */
export async function listFolderContents(
  drive: drive_v3.Drive,
  folderId: string,
  pageSize: number = 100
): Promise<drive_v3.Schema$File[]> {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      pageSize,
      fields: 'files(id, name, mimeType, modifiedTime, size, parents)',
      orderBy: 'modifiedTime desc'
    });

    return response.data.files || [];
  } catch (error: any) {
    throw new Error(`Failed to list folder contents: ${error.message}`);
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(
  drive: drive_v3.Drive,
  fileId: string
): Promise<drive_v3.Schema$File> {
  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, modifiedTime, size, parents, createdTime, owners'
    });

    return response.data;
  } catch (error: any) {
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

/**
 * Download file content to local path
 *
 * @param drive - Authenticated Drive client
 * @param fileId - Google Drive file ID
 * @param destPath - Local filesystem destination path
 * @param maxSize - Maximum file size in bytes (default: 100MB)
 */
export async function downloadFile(
  drive: drive_v3.Drive,
  fileId: string,
  destPath: string,
  maxSize: number = 100 * 1024 * 1024 // 100MB default limit
): Promise<void> {
  try {
    // Get file metadata to check size
    const metadata = await getFileMetadata(drive, fileId);
    const fileSize = metadata.size ? parseInt(metadata.size) : 0;

    if (fileSize > maxSize) {
      throw new Error(
        `File size (${fileSize} bytes) exceeds maximum (${maxSize} bytes). Skipping download.`
      );
    }

    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Download file content
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Write to file
    const dest = fs.createWriteStream(destPath);

    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => {
          console.log(`✅ Downloaded: ${destPath}`);
          resolve();
        })
        .on('error', (err: any) => {
          reject(new Error(`Download stream error: ${err.message}`));
        })
        .pipe(dest);
    });
  } catch (error: any) {
    throw new Error(`Failed to download file ${fileId}: ${error.message}`);
  }
}

/**
 * Check if file is in target folders (including nested folders)
 *
 * @param drive - Authenticated Drive client
 * @param fileId - File ID to check
 * @param targetFolderIds - Array of folder IDs to check against
 */
export async function isFileInTargetFolders(
  drive: drive_v3.Drive,
  fileId: string,
  targetFolderIds: string[]
): Promise<boolean> {
  try {
    const metadata = await getFileMetadata(drive, fileId);
    const parents = metadata.parents || [];

    // Direct parent match
    if (parents.some(parentId => targetFolderIds.includes(parentId))) {
      return true;
    }

    // Check parent folders recursively (limit depth to avoid infinite loops)
    for (const parentId of parents) {
      const isInTarget = await isFileInTargetFolders(drive, parentId, targetFolderIds);
      if (isInTarget) {
        return true;
      }
    }

    return false;
  } catch (error: any) {
    console.error(`Error checking file ancestry: ${error.message}`);
    return false;
  }
}

/**
 * Get the initial page token for the changes API
 */
export async function getStartPageToken(drive: drive_v3.Drive): Promise<string> {
  try {
    const response = await drive.changes.getStartPageToken();
    return response.data.startPageToken || '';
  } catch (error: any) {
    throw new Error(`Failed to get start page token: ${error.message}`);
  }
}

/**
 * List changes since a given page token
 */
export async function listChanges(
  drive: drive_v3.Drive,
  pageToken: string,
  pageSize: number = 100
): Promise<{
  changes: drive_v3.Schema$Change[];
  newStartPageToken?: string;
  nextPageToken?: string;
}> {
  try {
    const response = await drive.changes.list({
      pageToken,
      pageSize,
      fields: 'changes(fileId,file(id,name,mimeType,modifiedTime,size,parents,trashed),removed,time),newStartPageToken,nextPageToken',
      includeRemoved: true
    });

    return {
      changes: response.data.changes || [],
      newStartPageToken: response.data.newStartPageToken,
      nextPageToken: response.data.nextPageToken
    };
  } catch (error: any) {
    throw new Error(`Failed to list changes: ${error.message}`);
  }
}
