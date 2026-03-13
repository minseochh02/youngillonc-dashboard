#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  const result = await executeSQL(`
    SELECT id, chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE id IN (178, 180, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191)
    ORDER BY chat_date ASC
  `);
  
  result.rows.forEach((row: any) => {
    console.log(`[${row.id}] ${row.chat_date} - ${row.user_name}:`);
    console.log(`   ${row.message}`);
    console.log();
  });
}

main();
