#!/usr/bin/env tsx
import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('🗑️  Deleting all KakaoTalk messages...');
  
  const result = await executeSQL('DELETE FROM kakaotalk_raw_messages');
  console.log(`✅ Deleted all messages`);
  
  // Check count
  const count = await executeSQL('SELECT COUNT(*) as count FROM kakaotalk_raw_messages');
  console.log(`Remaining messages: ${count.rows[0].count}`);
}

main();
