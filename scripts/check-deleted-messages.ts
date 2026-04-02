import { executeSQL } from '../egdesk-helpers';

async function check() {
  // Check if those IDs still exist
  const byId = await executeSQL(`
    SELECT COUNT(*) as count
    FROM kakaotalk_raw_messages
    WHERE id >= 6127 AND id <= 6135
  `);

  console.log(`Messages with IDs 6127-6135: ${byId.rows[0].count}`);

  // Check if messages with that content exist (duplicates by content)
  const byContent = await executeSQL(`
    SELECT id, user_name, message
    FROM kakaotalk_raw_messages
    WHERE user_name IN ('Claude', '테스트유저', '개발자')
      AND message LIKE '%EML 자동 처리 테스트%'
    LIMIT 10
  `);

  console.log(`\nMessages with test content: ${byContent.rows.length}`);
  byContent.rows.forEach((row: any) => {
    console.log(`  ID ${row.id}: ${row.user_name} - ${row.message.substring(0, 50)}...`);
  });

  // Check what the UNIQUE constraint actually is
  const schema = await executeSQL(`
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='kakaotalk_raw_messages'
  `);

  console.log(`\nTable schema:`);
  console.log(schema.rows[0]?.sql);
}

check();
