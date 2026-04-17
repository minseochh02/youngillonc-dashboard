/**
 * Script to create the office_display_order table.
 * Run with: tsx scripts/create-office-display-order-table.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createTable } from '../egdesk-helpers.ts';

async function createOfficeDisplayOrderTable() {
  try {
    console.log('Creating office_display_order table...');

    const result = await createTable(
      '사업소 노출 순서',
      [
        { name: '사업소', type: 'TEXT', notNull: true },
        { name: '노출순서', type: 'INTEGER', notNull: true, defaultValue: 0 }
      ],
      {
        tableName: 'office_display_order',
        description: '대시보드 내 사업소 표시 순서 관리',
        uniqueKeyColumns: ['사업소'],
        duplicateAction: 'update'
      }
    );

    console.log('✅ Table created successfully!');
    console.log('Result:', result);
  } catch (error: any) {
    console.error('❌ Error creating table:', error.message);
    console.error('Full error:', error);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n🔴 EGdesk API is not running on port 8080');
      console.error('   Please start the EGdesk API server first.');
    }

    process.exit(1);
  }
}

createOfficeDisplayOrderTable();
