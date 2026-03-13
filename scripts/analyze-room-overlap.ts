#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('\n📊 Analyzing overlapping employees across chat rooms\n');

  const overlapping = ['감우균', '김철주', '석이', '신형철', '조성래', '조성호', '조종복'];

  // Message distribution per employee
  console.log('Message distribution (B2B vs 경남부산):\n');

  for (const emp of overlapping) {
    const dist = await executeSQL(`
      SELECT
        chat_room,
        COUNT(*) as msg_count
      FROM kakaotalk_raw_messages
      WHERE user_name = '${emp}'
      GROUP BY chat_room
    `);

    const b2b = dist.rows.find((r: any) => r.chat_room.includes('B2B'))?.msg_count || 0;
    const regional = dist.rows.find((r: any) => r.chat_room.includes('부산'))?.msg_count || 0;
    const total = b2b + regional;
    const b2bPct = total > 0 ? ((b2b / total) * 100).toFixed(0) : 0;

    console.log(`   ${emp.padEnd(8)}: B2B=${b2b.toString().padStart(4)} (${b2bPct}%), 경남부산=${regional.toString().padStart(4)} (${100-parseInt(b2bPct as string)}%)`);
  }

  // Check for duplicate posting (same day, both rooms)
  console.log('\n\nDays where employees posted in BOTH rooms:\n');

  for (const emp of overlapping) {
    const dualDates = await executeSQL(`
      SELECT
        DATE(chat_date) as date,
        COUNT(DISTINCT chat_room) as room_count
      FROM kakaotalk_raw_messages
      WHERE user_name = '${emp}'
      GROUP BY DATE(chat_date)
      HAVING COUNT(DISTINCT chat_room) = 2
    `);

    console.log(`   ${emp.padEnd(8)}: ${dualDates.rows.length} days`);
  }

  // Sample a dual-posting day from 조종복
  console.log('\n\n📅 Sample: 조종복 on a day they posted in both rooms:\n');

  const sampleDates = await executeSQL(`
    SELECT DATE(chat_date) as date
    FROM kakaotalk_raw_messages
    WHERE user_name = '조종복'
    GROUP BY DATE(chat_date)
    HAVING COUNT(DISTINCT chat_room) = 2
    LIMIT 1
  `);

  if (sampleDates.rows.length > 0) {
    const sampleDate = sampleDates.rows[0].date;

    const messages = await executeSQL(`
      SELECT chat_room, message, chat_date
      FROM kakaotalk_raw_messages
      WHERE user_name = '조종복'
        AND DATE(chat_date) = '${sampleDate}'
      ORDER BY chat_date
    `);

    let currentRoom = '';
    messages.rows.forEach((row: any) => {
      if (row.chat_room !== currentRoom) {
        currentRoom = row.chat_room;
        const roomName = row.chat_room.includes('B2B') ? 'B2B Room' : '경남부산 Room';
        console.log(`\n${roomName}:`);
      }
      console.log(`   [${row.chat_date}] ${row.message}`);
    });
  } else {
    console.log('   No dual-posting days found for 조종복');
  }
}

main().catch(console.error);
