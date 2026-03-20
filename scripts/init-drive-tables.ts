#!/usr/bin/env tsx
/**
 * Initialize Google Drive webhook system database tables
 *
 * Creates:
 * - drive_sync_state: Singleton table for page token and channel info
 * - drive_file_events: Log of all detected file changes
 */

import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('🔨 Initializing Google Drive webhook tables...\n');

  try {
    // Create drive_sync_state table (singleton for state management)
    console.log('Creating drive_sync_state table...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS drive_sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        page_token TEXT NOT NULL,
        channel_id TEXT,
        channel_resource_id TEXT,
        channel_expiration TEXT,
        target_folder_ids TEXT,
        last_updated TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ drive_sync_state table created\n');

    // Create drive_file_events table
    console.log('Creating drive_file_events table...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS drive_file_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT,
        folder_id TEXT,
        event_type TEXT NOT NULL,
        modified_time TEXT,
        detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        downloaded INTEGER DEFAULT 0,
        download_path TEXT,
        file_size INTEGER,
        metadata TEXT
      )
    `);
    console.log('✅ drive_file_events table created\n');

    // Create indexes for performance
    console.log('Creating indexes...');
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_drive_events_file_id
      ON drive_file_events(file_id)
    `);
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_drive_events_detected_at
      ON drive_file_events(detected_at)
    `);
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_drive_events_downloaded
      ON drive_file_events(downloaded)
    `);
    console.log('✅ Indexes created\n');

    console.log('✅ All tables initialized successfully!\n');
    console.log('Tables created:');
    console.log('  📊 drive_sync_state - Stores page token and channel info');
    console.log('  📊 drive_file_events - Logs all file change events\n');
    console.log('Next steps:');
    console.log('  1. Configure Google service account credentials in .env.local');
    console.log('  2. Share target Drive folders with service account email');
    console.log('  3. Run: npx tsx scripts/setup-drive-watch.ts\n');

  } catch (error: any) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
