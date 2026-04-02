import { deleteRows } from '../egdesk-helpers';

async function deleteTestMessages() {
  console.log('🗑️  Deleting test EML messages (IDs 6109-6117)...\n');

  try {
    const ids = [6109, 6110, 6111, 6112, 6113, 6114, 6115, 6116, 6117];

    const result = await deleteRows('kakaotalk_raw_messages', {
      ids
    });

    console.log('✅ Test messages deleted successfully');
    console.log('Result:', result);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

deleteTestMessages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
