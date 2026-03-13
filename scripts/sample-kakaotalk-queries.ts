#!/usr/bin/env tsx
/**
 * Sample KakaoTalk Queries
 *
 * Demonstrates useful queries on the kakaotalk_raw_messages table
 */

import { executeSQL, queryTable } from '../egdesk-helpers';

async function main() {
  console.log('📊 Sample KakaoTalk Queries\n');

  // Query 1: Messages by specific employee
  console.log('1️⃣  Recent messages from 정현우:');
  const jungMessages = await queryTable('kakaotalk_raw_messages', {
    filters: { user_name: '정현우' },
    limit: 5,
    orderBy: 'chat_date',
    orderDirection: 'DESC'
  });
  if (jungMessages?.rows) {
    jungMessages.rows.forEach((msg: any) => {
      console.log(`   [${msg.chat_date.substring(0, 10)}] ${msg.message.substring(0, 80)}...`);
    });
  }
  console.log();

  // Query 2: Messages mentioning specific customer
  console.log('2️⃣  Messages mentioning "삼표":');
  const sampyoMessages = await executeSQL(`
    SELECT chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE message LIKE '%삼표%'
      AND user_name != 'SYSTEM'
    ORDER BY chat_date DESC
    LIMIT 5
  `);
  if (sampyoMessages?.rows) {
    sampyoMessages.rows.forEach((msg: any) => {
      console.log(`   [${msg.chat_date.substring(0, 10)}] ${msg.user_name}: ${msg.message.substring(0, 60)}...`);
    });
  }
  console.log();

  // Query 3: Messages mentioning products
  console.log('3️⃣  Messages mentioning Mobil products:');
  const productMessages = await executeSQL(`
    SELECT chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE (message LIKE '%Mobil%' OR message LIKE '%모빌%')
      AND user_name != 'SYSTEM'
    ORDER BY chat_date DESC
    LIMIT 5
  `);
  if (productMessages?.rows) {
    productMessages.rows.forEach((msg: any) => {
      console.log(`   [${msg.chat_date.substring(0, 10)}] ${msg.user_name}: ${msg.message.substring(0, 60)}...`);
    });
  }
  console.log();

  // Query 4: Daily activity by date
  console.log('4️⃣  Message activity by date (last 10 days):');
  const dailyActivity = await executeSQL(`
    SELECT
      DATE(chat_date) as date,
      COUNT(*) as message_count,
      COUNT(DISTINCT user_name) as active_users
    FROM kakaotalk_raw_messages
    WHERE user_name != 'SYSTEM'
    GROUP BY DATE(chat_date)
    ORDER BY date DESC
    LIMIT 10
  `);
  if (dailyActivity?.rows) {
    dailyActivity.rows.forEach((row: any) => {
      console.log(`   ${row.date}: ${row.message_count} messages, ${row.active_users} active users`);
    });
  }
  console.log();

  // Query 5: Check-out reports (퇴근)
  console.log('5️⃣  Recent check-out reports:');
  const checkouts = await executeSQL(`
    SELECT chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE message LIKE '%퇴근%'
      AND user_name != 'SYSTEM'
    ORDER BY chat_date DESC
    LIMIT 5
  `);
  if (checkouts?.rows) {
    checkouts.rows.forEach((msg: any) => {
      console.log(`   [${msg.chat_date.substring(0, 16)}] ${msg.user_name}:`);
      console.log(`   ${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}`);
      console.log();
    });
  }

  // Query 6: Tomorrow's plans (내일)
  console.log('6️⃣  Messages with tomorrow\'s plans:');
  const tomorrowPlans = await executeSQL(`
    SELECT chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE message LIKE '%내일%'
      AND user_name != 'SYSTEM'
    ORDER BY chat_date DESC
    LIMIT 5
  `);
  if (tomorrowPlans?.rows) {
    tomorrowPlans.rows.forEach((msg: any) => {
      console.log(`   [${msg.chat_date.substring(0, 10)}] ${msg.user_name}:`);
      console.log(`   ${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}`);
      console.log();
    });
  }

  console.log('✅ Query examples complete!');
  console.log('\n💡 Tip: You can use these patterns to build your own queries');
  console.log('   Use executeSQL() for custom SQL or queryTable() for simple filters');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
