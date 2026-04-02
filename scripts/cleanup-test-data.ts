import { executeSQL, deleteRows } from '../egdesk-helpers';

async function cleanup() {
  console.log('🧹 Cleaning up test data...\n');

  // 1. Find and delete test messages
  console.log('1. Finding test messages...');
  const testMessages = await executeSQL(`
    SELECT id, user_name, message
    FROM kakaotalk_raw_messages
    WHERE user_name IN ('Claude', '테스트유저', '개발자')
      AND (message LIKE '%EML 자동 처리 테스트%' OR message LIKE '%테스트 완료%')
    ORDER BY id
  `);

  if (testMessages.rows.length > 0) {
    console.log(`   Found ${testMessages.rows.length} test messages:`);
    testMessages.rows.forEach((row: any) => {
      console.log(`   - ID ${row.id}: ${row.user_name}`);
    });

    const messageIds = testMessages.rows.map((row: any) => row.id);
    await deleteRows('kakaotalk_raw_messages', { ids: messageIds });
    console.log(`   ✅ Deleted ${testMessages.rows.length} test messages\n`);
  } else {
    console.log('   No test messages found\n');
  }

  // 2. Find and delete test activities
  console.log('2. Finding test activities...');
  const testActivities = await executeSQL(`
    SELECT id, employee_name, activity_label, activity_date
    FROM employee_activity_log
    WHERE employee_name = 'Claude'
      OR activity_date = '2026-04-02'
    ORDER BY id DESC
    LIMIT 10
  `);

  if (testActivities.rows.length > 0) {
    console.log(`   Found ${testActivities.rows.length} potential test activities:`);
    testActivities.rows.forEach((row: any) => {
      console.log(`   - ID ${row.id}: ${row.employee_name} - ${row.activity_label} (${row.activity_date})`);
    });

    console.log('\n   ⚠️  Please manually review and delete test activities if needed');
    console.log('   Example: npx tsx -e "import {deleteRows} from \'./egdesk-helpers\'; await deleteRows(\'employee_activity_log\', {ids: [41669]})"');
  } else {
    console.log('   No test activities found\n');
  }

  // 3. Find test activity generation logs
  console.log('\n3. Finding test activity generation logs...');
  const testLogs = await executeSQL(`
    SELECT id, eml_file_id, chat_room, status, activities_generated, started_at
    FROM activity_generation_log
    ORDER BY started_at DESC
    LIMIT 5
  `);

  if (testLogs.rows.length > 0) {
    console.log(`   Found ${testLogs.rows.length} recent activity generation logs:`);
    testLogs.rows.forEach((row: any) => {
      console.log(`   - ID ${row.id}: ${row.status}, ${row.activities_generated} activities (${row.started_at})`);
    });
    console.log('\n   ℹ️  These logs are for tracking only - safe to keep or delete');
  }

  // 4. Find test EML processing logs
  console.log('\n4. Finding test EML processing logs...');
  const testEMLLogs = await executeSQL(`
    SELECT id, file_name, messages_inserted, status, completed_at
    FROM eml_processing_log
    WHERE messages_inserted < 100
    ORDER BY completed_at DESC
    LIMIT 5
  `);

  if (testEMLLogs.rows.length > 0) {
    console.log(`   Found ${testEMLLogs.rows.length} recent small EML processing logs:`);
    testEMLLogs.rows.forEach((row: any) => {
      console.log(`   - ID ${row.id}: ${row.file_name} (${row.messages_inserted} inserted)`);
    });
    console.log('\n   ℹ️  These logs are for tracking only - safe to keep or delete');
  }

  console.log('\n✨ Cleanup complete!\n');
}

cleanup().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
