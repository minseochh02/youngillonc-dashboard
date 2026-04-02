/**
 * Initialize Google Drive Webhook Database Tables
 *
 * Creates:
 * - drive_sync_state: Stores page token and channel info
 * - drive_file_events: Logs all file change events
 */

import { createTable, listTables } from '../egdesk-helpers';

async function initTables() {
  console.log('🗄️  Initializing Google Drive webhook database tables...\n');

  try {
    // Check existing tables
    const existingTables = await listTables();
    const tableNames = existingTables.tables?.map((t: any) => t.tableName) || [];

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
      console.log('✅ drive_sync_state table created\n');
    } else {
      console.log('✅ drive_sync_state table already exists\n');
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
      console.log('✅ drive_file_events table created\n');
    } else {
      console.log('✅ drive_file_events table already exists\n');
    }

    // Verify tables exist
    console.log('Verifying tables...');
    const tables = await listTables();
    const driveTableNames = tables.tables
      ?.filter((t: any) => t.tableName.startsWith('drive_'))
      .map((t: any) => t.tableName) || [];

    console.log('📋 Drive tables found:');
    driveTableNames.forEach((name: string) => {
      console.log(`   - ${name}`);
    });

    console.log('\n✅ Database initialization complete!');
    console.log('\nNext steps:');
    console.log('1. Configure .env.local with your Google service account credentials');
    console.log('2. Start dev server: npm run dev');
    console.log('3. Start tunnel: ngrok http 3000');
    console.log('4. Initialize system: curl http://localhost:3000/api/drive/init');
    console.log('5. Register watch: curl -X POST http://localhost:3000/api/drive/watch\n');

  } catch (error: any) {
    console.error('❌ Error initializing tables:', error.message);
    process.exit(1);
  }
}

// Run initialization
initTables();
