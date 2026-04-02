import { deleteRows, queryTable } from '../egdesk-helpers';

async function deleteTestMessage() {
  console.log('🗑️  Deleting test message...\n');

  try {
    // First find the test message
    const testMessages = await queryTable('kakaotalk_raw_messages', {
      filters: {
        chat_room: 'Test Room',
        user_name: 'Test User'
      },
      limit: 10
    });

    if (!testMessages.rows || testMessages.rows.length === 0) {
      console.log('No test messages found to delete.');
      return;
    }

    console.log(`Found ${testMessages.rows.length} test message(s):`);
    testMessages.rows.forEach((msg: any, idx: number) => {
      console.log(`  ${idx + 1}. [${msg.chat_date}] ${msg.user_name}: ${msg.message}`);
    });

    // Delete them
    const result = await deleteRows('kakaotalk_raw_messages', {
      filters: {
        chat_room: 'Test Room',
        user_name: 'Test User'
      }
    });

    console.log('\n✅ Test message(s) deleted successfully');
    console.log('Result:', result);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

deleteTestMessage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
