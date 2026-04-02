/**
 * POST /api/drive/init-tables
 *
 * Initialize database tables for Google Drive webhook system.
 * This endpoint creates the tables if they don't exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTable, listTables } from '../../../../../egdesk-helpers';

export async function POST(req: NextRequest) {
  try {
    console.log('🗄️  Initializing Google Drive webhook database tables...');

    // Check existing tables
    const existingTables = await listTables();
    const tableNames = existingTables.tables?.map((t: any) => t.tableName) || [];

    const results = {
      drive_sync_state: 'exists',
      drive_file_events: 'exists'
    };

    // Create drive_sync_state table
    if (!tableNames.includes('drive_sync_state')) {
      console.log('Creating drive_sync_state table...');
      await createTable(
        'Drive Sync State',
        [
          { name: 'id', type: 'INTEGER', notNull: true },
          { name: 'page_token', type: 'TEXT', notNull: true },
          { name: 'channel_id', type: 'TEXT' },
          { name: 'channel_resource_id', type: 'TEXT' },
          { name: 'channel_expiration', type: 'TEXT' },
          { name: 'target_folder_ids', type: 'TEXT' },
          { name: 'last_updated', type: 'TEXT' },
          { name: 'created_at', type: 'TEXT' }
        ],
        {
          tableName: 'drive_sync_state',
          description: 'Stores Google Drive sync state and watch channel info',
          uniqueKeyColumns: ['id']
        }
      );
      console.log('✅ drive_sync_state table created');
      results.drive_sync_state = 'created';
    } else {
      console.log('✅ drive_sync_state table already exists');
    }

    // Create drive_file_events table
    if (!tableNames.includes('drive_file_events')) {
      console.log('Creating drive_file_events table...');
      await createTable(
        'Drive File Events',
        [
          { name: 'id', type: 'INTEGER', notNull: true },
          { name: 'file_id', type: 'TEXT', notNull: true },
          { name: 'file_name', type: 'TEXT', notNull: true },
          { name: 'mime_type', type: 'TEXT' },
          { name: 'folder_id', type: 'TEXT' },
          { name: 'event_type', type: 'TEXT', notNull: true },
          { name: 'modified_time', type: 'TEXT' },
          { name: 'detected_at', type: 'TEXT' },
          { name: 'downloaded', type: 'INTEGER', defaultValue: 0 },
          { name: 'download_path', type: 'TEXT' },
          { name: 'file_size', type: 'INTEGER' },
          { name: 'metadata', type: 'TEXT' }
        ],
        {
          tableName: 'drive_file_events',
          description: 'Logs all Google Drive file change events',
          duplicateAction: 'allow'
        }
      );
      console.log('✅ drive_file_events table created');
      results.drive_file_events = 'created';
    } else {
      console.log('✅ drive_file_events table already exists');
    }

    return NextResponse.json({
      status: 'success',
      message: 'Database tables initialized successfully',
      tables: results,
      nextSteps: [
        'Configure .env.local with Google service account credentials',
        'Initialize sync: GET /api/drive/init',
        'Register watch: POST /api/drive/watch'
      ]
    });

  } catch (error: any) {
    console.error('❌ Error initializing tables:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to initialize database tables',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/drive/init-tables
 *
 * Check which tables exist
 */
export async function GET(req: NextRequest) {
  try {
    const tables = await listTables();
    const driveTableNames = tables.tables
      ?.filter((t: any) => t.tableName.startsWith('drive_'))
      .map((t: any) => t.tableName) || [];

    return NextResponse.json({
      status: 'ok',
      driveTables: driveTableNames,
      hasRequiredTables: driveTableNames.includes('drive_sync_state') && driveTableNames.includes('drive_file_events'),
      message: driveTableNames.length === 0
        ? 'No drive tables found. Run POST /api/drive/init-tables to create them.'
        : `Found ${driveTableNames.length} drive table(s)`
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
