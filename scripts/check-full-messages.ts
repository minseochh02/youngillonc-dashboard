#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  const result = await executeSQL(`
    SELECT id, chat_date, user_name, LENGTH(message) as msg_length, message
    FROM kakaotalk_raw_messages
    WHERE id = 178
  `);
  
  result.rows.forEach((row: any) => {
    console.log(`Message ID: ${row.id}`);
    console.log(`Date: ${row.chat_date}`);
    console.log(`User: ${row.user_name}`);
    console.log(`Length: ${row.msg_length} characters`);
    console.log(`Full content:`);
    console.log(row.message);
    console.log('---');
  });
}

main();
