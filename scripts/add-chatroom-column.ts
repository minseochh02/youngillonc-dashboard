#!/usr/bin/env tsx
/**
 * Add chat_room column to employee_activity_log table
 */

import { executeSQL } from '../egdesk-helpers';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔧 Adding chat_room column to employee_activity_log...\n');

  try {
    // Note: SQLite ALTER TABLE only supports adding columns, not modifying
    // Check if column already exists
    const schema = await executeSQL(`PRAGMA table_info(employee_activity_log)`);
    const hasColumn = schema.rows.some((row: any) => row.name === 'chat_room');

    if (hasColumn) {
      console.log('✅ Column already exists, nothing to do');
      return;
    }

    // Add the column
    await executeSQL(`
      ALTER TABLE employee_activity_log
      ADD COLUMN chat_room TEXT
    `);

    console.log('✅ Successfully added chat_room column');

    // Verify
    const newSchema = await executeSQL(`PRAGMA table_info(employee_activity_log)`);
    const verified = newSchema.rows.some((row: any) => row.name === 'chat_room');

    if (verified) {
      console.log('✅ Verified: chat_room column exists\n');
      console.log('📋 Column details:');
      const col = newSchema.rows.find((row: any) => row.name === 'chat_room');
      console.log(JSON.stringify(col, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

main().catch(console.error);
