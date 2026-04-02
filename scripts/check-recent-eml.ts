import { executeSQL } from '../egdesk-helpers';

async function check() {
  const eml = await executeSQL(`
    SELECT file_name, chat_room, messages_found, messages_inserted,
           messages_duplicate, status, completed_at
    FROM eml_processing_log
    ORDER BY completed_at DESC
    LIMIT 3
  `);

  console.log('Recent EML Processing:');
  console.log(JSON.stringify(eml.rows, null, 2));

  try {
    const activityLog = await executeSQL(`
      SELECT * FROM activity_generation_log
      ORDER BY started_at DESC
      LIMIT 3
    `);

    console.log('\nActivity Generation Log:');
    console.log(JSON.stringify(activityLog.rows, null, 2));
  } catch (e: any) {
    console.log('\n⚠️ Activity generation log table not found or error:', e.message);
  }
}

check();
