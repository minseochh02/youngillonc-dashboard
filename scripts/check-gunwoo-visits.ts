#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('Checking for 우신엔지어링, 삼성디스플레이, 정일제지 mentions by 김건우...\n');
  
  const result = await executeSQL(`
    SELECT id, chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE user_name = '김건우'
      AND DATE(chat_date) <= '2024-03-11'
      AND (
        message LIKE '%우신엔지어링%'
        OR message LIKE '%삼성디스플레이%'
        OR message LIKE '%정일제지%'
      )
    ORDER BY chat_date ASC
  `);
  
  console.log(`Found ${result.rows.length} messages:\n`);
  
  result.rows.forEach((row: any) => {
    console.log(`[${row.id}] ${row.chat_date}`);
    console.log(row.message);
    console.log('-'.repeat(80));
    console.log();
  });
}

main();
