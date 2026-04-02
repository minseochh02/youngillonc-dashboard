import { createTable } from '../egdesk-helpers';

async function initEMLTables() {
  console.log('🚀 Initializing EML Processing tables...\n');

  try {
    await createTable('EML Processing Log', [
      { name: 'id', type: 'INTEGER', notNull: true },
      { name: 'file_id', type: 'TEXT', notNull: true },
      { name: 'file_name', type: 'TEXT', notNull: true },
      { name: 'chat_room', type: 'TEXT', notNull: true },
      { name: 'download_path', type: 'TEXT', notNull: true },
      { name: 'status', type: 'TEXT', notNull: true },
      { name: 'messages_found', type: 'INTEGER', defaultValue: 0 },
      { name: 'messages_inserted', type: 'INTEGER', defaultValue: 0 },
      { name: 'messages_duplicate', type: 'INTEGER', defaultValue: 0 },
      { name: 'error_message', type: 'TEXT' },
      { name: 'started_at', type: 'TEXT' },
      { name: 'completed_at', type: 'TEXT' },
      { name: 'deleted_from_drive', type: 'INTEGER', defaultValue: 0 },
      { name: 'deleted_from_local', type: 'INTEGER', defaultValue: 0 }
    ], {
      tableName: 'eml_processing_log',
      uniqueKeyColumns: ['file_id']
    });

    console.log('✅ EML Processing Log table created successfully');
    console.log('\nTable schema:');
    console.log('  - file_id (TEXT, UNIQUE): Google Drive file ID');
    console.log('  - file_name (TEXT): Original filename');
    console.log('  - chat_room (TEXT): Extracted chat room name');
    console.log('  - download_path (TEXT): Local file path');
    console.log('  - status (TEXT): processing, completed, failed');
    console.log('  - messages_found (INTEGER): Total messages in file');
    console.log('  - messages_inserted (INTEGER): Successfully inserted');
    console.log('  - messages_duplicate (INTEGER): Skipped duplicates');
    console.log('  - error_message (TEXT): Error details if failed');
    console.log('  - started_at (TEXT): Processing start timestamp');
    console.log('  - completed_at (TEXT): Processing end timestamp');
    console.log('  - deleted_from_drive (INTEGER): 1 if deleted from Drive');
    console.log('  - deleted_from_local (INTEGER): 1 if deleted locally');
    console.log('\n✨ Setup complete! Ready for EML processing.\n');

  } catch (error: any) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  }
}

initEMLTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
