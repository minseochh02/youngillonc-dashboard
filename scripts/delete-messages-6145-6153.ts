import { deleteRows } from '../egdesk-helpers';

async function deleteMessages() {
  console.log('🗑️  Deleting messages 6145-6153...\n');

  const result = await deleteRows('kakaotalk_raw_messages', {
    ids: [6145, 6146, 6147, 6148, 6149, 6150, 6151, 6152, 6153]
  });

  console.log('✅ Deleted 9 messages (IDs 6145-6153)');
  console.log('\nNow upload the test EML file again!');
}

deleteMessages().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
