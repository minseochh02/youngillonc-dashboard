#!/usr/bin/env tsx
/**
 * Find Busy Dates in KakaoTalk Messages
 *
 * Helps identify good test dates for extraction
 */

import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('📅 Finding busy dates in KakaoTalk messages...\n');

  // Get dates with most activity
  const busyDates = await executeSQL(`
    SELECT
      DATE(chat_date) as date,
      COUNT(*) as message_count,
      COUNT(DISTINCT user_name) as active_users,
      GROUP_CONCAT(DISTINCT user_name) as users
    FROM kakaotalk_raw_messages
    WHERE user_name != 'SYSTEM'
    GROUP BY DATE(chat_date)
    ORDER BY message_count DESC
    LIMIT 20
  `);

  if (!busyDates || !busyDates.rows) {
    console.log('❌ No data found');
    return;
  }

  console.log('🔥 Top 20 busiest dates:\n');
  busyDates.rows.forEach((row: any, idx: number) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${row.date}`);
    console.log(`    Messages: ${row.message_count}`);
    console.log(`    Active users: ${row.active_users}`);
    console.log();
  });

  // Pick a good test date (around middle of the list for variety)
  const testDate = busyDates.rows[5];
  console.log(`\n💡 Recommended test date: ${testDate.date}`);
  console.log(`   ${testDate.message_count} messages from ${testDate.active_users} employees`);
  console.log(`\n📝 To extract this date, run:`);
  console.log(`   npx tsx scripts/extract-single-date.ts ${testDate.date}`);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
