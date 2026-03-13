#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('Checking March 8 messages from 김건우...\n');
  
  const result = await executeSQL(`
    SELECT id, chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE user_name = '김건우'
      AND DATE(chat_date) = '2024-03-08'
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
