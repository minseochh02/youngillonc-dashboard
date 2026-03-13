#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  const result = await executeSQL(`
    SELECT id, chat_date, user_name, LENGTH(message) as msg_length, 
           SUBSTR(message, 1, 200) as preview
    FROM kakaotalk_raw_messages
    WHERE DATE(chat_date) = '2024-03-11'
      AND user_name = '김건우'
      AND message LIKE '%티케이엘리베이터%Spartan%'
    ORDER BY chat_date ASC
  `);
  
  result.rows.forEach((row: any) => {
    console.log(`[${row.id}] ${row.chat_date} - ${row.user_name} (${row.msg_length} chars)`);
    console.log(`Preview: ${row.preview}...`);
    console.log();
  });
}

main();
