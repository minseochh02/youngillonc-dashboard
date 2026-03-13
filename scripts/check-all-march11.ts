#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  const result = await executeSQL(`
    SELECT id, chat_date, user_name, LENGTH(message) as msg_length, 
           SUBSTR(message, 1, 100) as preview
    FROM kakaotalk_raw_messages
    WHERE DATE(chat_date) = '2024-03-11'
    ORDER BY chat_date ASC
  `);
  
  console.log('March 11 Messages - Length Check:');
  console.log('='.repeat(80));
  result.rows.forEach((row: any) => {
    console.log(`[${row.id}] ${row.chat_date} - ${row.user_name} (${row.msg_length} chars)`);
    console.log(`   ${row.preview}${row.msg_length > 100 ? '...' : ''}`);
    console.log();
  });
}

main();
