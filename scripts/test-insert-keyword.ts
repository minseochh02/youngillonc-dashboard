import { insertRows } from '../egdesk-helpers';

async function testInsertWithSQLKeywords() {
  console.log('🧪 Testing INSERT with SQL keywords in message content\n');

  const testMessage = {
    chat_room: "Test Room",
    chat_date: "2024-01-01T12:00:00",
    user_name: "Test User",
    message: "INSERT 사출 업체, DELETE command, UPDATE statement"
  };

  try {
    console.log('Attempting to insert message with SQL keywords...');
    console.log('Message:', testMessage.message);

    const result = await insertRows('kakaotalk_raw_messages', [testMessage]);

    console.log('✅ Success! Message inserted:', result);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

testInsertWithSQLKeywords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
