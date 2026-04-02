import { deleteRows } from '../egdesk-helpers';

async function deleteMessages() {
  console.log('🗑️  Deleting messages 6136-6144...\n');

  const result = await deleteRows('kakaotalk_raw_messages', {
    ids: [6136, 6137, 6138, 6139, 6140, 6141, 6142, 6143, 6144]
  });

  console.log('✅ Deleted 9 messages (IDs 6136-6144)');
  console.log('\nNow upload the test EML file again to trigger activity generation!');
}

deleteMessages().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
