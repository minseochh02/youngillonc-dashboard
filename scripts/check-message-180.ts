#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  const result = await executeSQL(`
    SELECT id, chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE DATE(chat_date) = '2024-03-11'
      AND user_name = '김건우'
      AND message LIKE '%한국지엠%'
  `);
  
  result.rows.forEach((row: any) => {
    console.log(`[${row.id}] ${row.chat_date} - ${row.user_name}`);
    console.log(row.message);
    console.log();
  });
  
  if (result.rows.length === 0) {
    console.log('❌ No message found with 한국지엠');
  }
}

main();
