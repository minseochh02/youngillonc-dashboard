#!/usr/bin/env tsx
/**
 * Verify KakaoTalk Import
 * Quick script to check the imported data
 */

import { queryTable, executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('🔍 Verifying KakaoTalk import...\n');

  // Get total count
  const result = await queryTable('kakaotalk_raw_messages', {
    limit: 10,
    orderBy: 'chat_date',
    orderDirection: 'ASC'
  });

  console.log(`📊 Total messages: ${result.totalRows || result.rows?.length || 0}`);
  console.log();

  // Get unique chat rooms
  const rooms = await executeSQL(`
    SELECT DISTINCT chat_room, COUNT(*) as message_count
    FROM kakaotalk_raw_messages
    GROUP BY chat_room
  `);

  console.log('💬 Chat rooms:');
  if (rooms && rooms.rows) {
    rooms.rows.forEach((row: any) => {
      console.log(`   - ${row.chat_room}: ${row.message_count} messages`);
    });
  }
  console.log();

  // Get unique users
  const users = await executeSQL(`
    SELECT user_name, COUNT(*) as message_count
    FROM kakaotalk_raw_messages
    WHERE user_name != 'SYSTEM'
    GROUP BY user_name
    ORDER BY message_count DESC
    LIMIT 20
  `);

  console.log('👥 Top 20 active users:');
  if (users && users.rows) {
    users.rows.forEach((row: any, idx: number) => {
      console.log(`   ${(idx + 1).toString().padStart(2)}. ${row.user_name.padEnd(15)} - ${row.message_count} messages`);
    });
  }
  console.log();

  // Show date range
  const dateRange = await executeSQL(`
    SELECT
      MIN(chat_date) as earliest,
      MAX(chat_date) as latest
    FROM kakaotalk_raw_messages
  `);

  console.log('📅 Date range:');
  if (dateRange && dateRange.rows && dateRange.rows[0]) {
    console.log(`   From: ${dateRange.rows[0].earliest}`);
    console.log(`   To:   ${dateRange.rows[0].latest}`);
  }
  console.log();

  // Show sample messages
  console.log('📝 Sample messages (first 5):');
  if (result && result.rows) {
    result.rows.slice(0, 5).forEach((msg: any) => {
      console.log(`\n   [${msg.chat_date}] ${msg.user_name}:`);
      console.log(`   ${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}`);
    });
  }

  console.log('\n✅ Verification complete!');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
