/**
 * GET /api/drive/init
 *
 * Initialize Google Drive sync system:
 * - Get initial page token from Google Drive API
 * - Store target folder IDs
 * - Create initial sync state in database
 *
 * Query params:
 * - reset: If 'true', reinitialize even if already set up
 * - folderIds: Comma-separated list of folder IDs (optional, falls back to env var)
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeSQL, insertRows, updateRows } from '../../../../../egdesk-helpers';
import { createDriveClient, getStartPageToken } from '../../../../lib/google-drive-client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const reset = searchParams.get('reset') === 'true';
    const folderIdsParam = searchParams.get('folderIds');

    // Get target folder IDs from query param or env var
    const envFolderIds = process.env.DRIVE_TARGET_FOLDER_IDS;
    let targetFolderIds: string[];

    if (folderIdsParam) {
      targetFolderIds = folderIdsParam.split(',').map(id => id.trim()).filter(Boolean);
    } else if (envFolderIds) {
      targetFolderIds = envFolderIds.split(',').map(id => id.trim()).filter(Boolean);
    } else {
      return NextResponse.json(
        {
          error: 'No target folder IDs provided. Add DRIVE_TARGET_FOLDER_IDS to .env.local or pass ?folderIds query param.'
        },
        { status: 400 }
      );
    }

    if (targetFolderIds.length === 0) {
      return NextResponse.json(
        { error: 'Target folder IDs cannot be empty' },
        { status: 400 }
      );
    }

    // Check if already initialized
    const existingState = await executeSQL('SELECT * FROM drive_sync_state WHERE id = 1');

    if (!reset && existingState.rows && existingState.rows.length > 0) {
      return NextResponse.json({
        status: 'already_initialized',
        message: 'Sync state already exists. Use ?reset=true to reinitialize.',
        state: existingState.rows[0]
      });
    }

    // Get initial page token from Google Drive
    console.log('🔄 Getting initial page token from Google Drive...');
    const drive = createDriveClient();
    const pageToken = await getStartPageToken(drive);

    console.log(`✅ Received page token: ${pageToken.substring(0, 20)}...`);

    // Store in database (upsert)
    const targetFolderIdsJson = JSON.stringify(targetFolderIds);
    const now = new Date().toISOString();

    if (existingState.rows && existingState.rows.length > 0) {
      // Update existing
      await updateRows(
        'drive_sync_state',
        {
          page_token: pageToken,
          target_folder_ids: targetFolderIdsJson,
          last_updated: now
        },
        { filters: { id: '1' } }
      );
    } else {
      // Insert new
      await insertRows('drive_sync_state', [
        {
          id: 1,
          page_token: pageToken,
          target_folder_ids: targetFolderIdsJson,
          last_updated: now,
          created_at: now
        }
      ]);
    }

    console.log(`✅ Sync state initialized with ${targetFolderIds.length} target folder(s)`);

    return NextResponse.json({
      status: 'initialized',
      pageToken: pageToken.substring(0, 20) + '...',
      targetFolderIds,
      message: 'Drive sync initialized successfully. Next: Register webhook with POST /api/drive/watch'
    });

  } catch (error: any) {
    console.error('❌ Error initializing Drive sync:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize Drive sync',
        details: error.message
      },
      { status: 500 }
    );
  }
}
