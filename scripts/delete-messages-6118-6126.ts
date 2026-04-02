import { executeSQL, deleteRows } from '../egdesk-helpers';

async function deleteMessages() {
  console.log('🗑️  Deleting messages 6127-6135...\n');

  // First, check what we're deleting
  const before = await executeSQL(`
    SELECT id, chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE id >= 6127 AND id <= 6135
    ORDER BY id
  `);

  console.log('Messages to delete:');
  before.rows.forEach((row: any) => {
    console.log(`  ${row.id}: ${row.user_name} - ${row.message.substring(0, 50)}...`);
  });

  // Delete the messages using deleteRows
  const result = await deleteRows('kakaotalk_raw_messages', {
    ids: [6127, 6128, 6129, 6130, 6131, 6132, 6133, 6134, 6135]
  });

  console.log(`\n✅ Deleted ${before.rows.length} messages (IDs 6127-6135)`);
  console.log('\nYou can now upload the test EML file again to trigger activity generation!');
}

deleteMessages().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
