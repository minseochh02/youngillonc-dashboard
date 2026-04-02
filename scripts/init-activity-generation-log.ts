import { createTable } from '../egdesk-helpers';

async function initActivityGenerationLog() {
  console.log('🚀 Initializing Activity Generation Log table...\n');

  try {
    await createTable('Activity Generation Log', [
      { name: 'id', type: 'INTEGER', notNull: true },
      { name: 'eml_file_id', type: 'TEXT', notNull: true },
      { name: 'chat_room', type: 'TEXT', notNull: true },
      { name: 'start_date', type: 'TEXT' },
      { name: 'end_date', type: 'TEXT' },
      { name: 'status', type: 'TEXT', notNull: true },
      { name: 'activities_generated', type: 'INTEGER', defaultValue: 0 },
      { name: 'error_message', type: 'TEXT' },
      { name: 'started_at', type: 'TEXT' },
      { name: 'completed_at', type: 'TEXT' }
    ], {
      tableName: 'activity_generation_log'
    });

    console.log('✅ Activity Generation Log table created successfully');
    console.log('\nTable schema:');
    console.log('  - eml_file_id (TEXT): Reference to EML file that triggered generation');
    console.log('  - chat_room (TEXT): Chat room being processed');
    console.log('  - start_date (TEXT): Earliest message date processed');
    console.log('  - end_date (TEXT): Latest message date processed');
    console.log('  - status (TEXT): processing, completed, failed');
    console.log('  - activities_generated (INTEGER): Number of activities created');
    console.log('  - error_message (TEXT): Error details if failed');
    console.log('  - started_at (TEXT): Generation start timestamp');
    console.log('  - completed_at (TEXT): Generation end timestamp');
    console.log('\n✨ Setup complete! Ready for automatic activity generation.\n');

  } catch (error: any) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  }
}

initActivityGenerationLog()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
