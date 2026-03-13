#!/usr/bin/env tsx
import { createTable } from '../egdesk-helpers';

async function main() {
  console.log('🔨 Recreating kakaotalk_raw_messages table...');
  
  const result = await createTable(
    '카카오톡원본메시지',
    [
      { name: 'chat_room', type: 'TEXT', notNull: true },
      { name: 'chat_date', type: 'TEXT', notNull: true },
      { name: 'user_name', type: 'TEXT', notNull: true },
      { name: 'message', type: 'TEXT', notNull: true },
      { name: 'imported_at', type: 'TEXT', defaultValue: 'CURRENT_TIMESTAMP' }
    ],
    {
      tableName: 'kakaotalk_raw_messages',
      description: 'Raw KakaoTalk messages parsed from .eml export files (supports multi-line messages)',
      uniqueKeyColumns: ['chat_room', 'chat_date', 'user_name'],
      duplicateAction: 'replace',
      recreate: true
    }
  );
  
  console.log('✅ Table recreated');
}

main();
