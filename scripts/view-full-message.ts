#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  const result = await executeSQL(`
    SELECT id, chat_date, user_name, message
    FROM kakaotalk_raw_messages
    WHERE id = 175
  `);
  
  const row = result.rows[0];
  console.log(`Message ID: ${row.id}`);
  console.log(`Date: ${row.chat_date}`);
  console.log(`User: ${row.user_name}`);
  console.log(`\nFull Message:`);
  console.log('='.repeat(80));
  console.log(row.message);
  console.log('='.repeat(80));
}

main();
