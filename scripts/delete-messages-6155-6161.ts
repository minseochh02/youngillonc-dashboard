import { deleteRows } from '../egdesk-helpers';

async function deleteMessages() {
  console.log('🗑️  Deleting messages 6155-6161...\n');

  const result = await deleteRows('kakaotalk_raw_messages', {
    ids: [6155, 6156, 6157, 6158, 6159, 6160, 6161]
  });

  console.log('✅ Deleted 7 messages (IDs 6155-6161)');
}

deleteMessages().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
