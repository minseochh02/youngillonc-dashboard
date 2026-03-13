#!/usr/bin/env tsx
/**
 * Add proper source message tracking to employee_activity_log
 *
 * Changes:
 * - Drop source_message_id (INTEGER, never used)
 * - Add source_message_ids (TEXT, JSON array of message IDs)
 */

import { createTable, deleteTable, insertRows, executeSQL } from '../egdesk-helpers';
import { config } from 'dotenv';
import * as fs from 'fs/promises';

config({ path: '.env.local' });

async function main() {
  console.log('🔧 Adding source message tracking to employee_activity_log\n');

  // Step 1: Backup existing data
  console.log('📦 Step 1: Backing up existing data...');
  const existingData = await executeSQL(`SELECT * FROM employee_activity_log`);
  const backupFile = `./backup-activity-log-source-tracking-${new Date().toISOString().split('T')[0]}.json`;

  await fs.writeFile(backupFile, JSON.stringify(existingData, null, 2));
  console.log(`✅ Backed up ${existingData.rows.length} rows to ${backupFile}\n`);

  // Step 2: Drop the table
  console.log('🗑️  Step 2: Dropping old table...');
  try {
    await deleteTable('employee_activity_log');
    console.log('✅ Table dropped\n');
  } catch (error: any) {
    console.error('❌ Error dropping table:', error.message);
    throw error;
  }

  // Step 3: Recreate with source_message_ids
  console.log('🏗️  Step 3: Creating new table with source_message_ids...');

  try {
    const result = await createTable(
      '직원활동로그',
      [
        // Source tracking (UPDATED!)
        { name: 'source_message_ids', type: 'TEXT' }, // JSON array of message IDs
        { name: 'extracted_at', type: 'TEXT', defaultValue: 'CURRENT_TIMESTAMP' },

        // Employee info
        { name: 'employee_name', type: 'TEXT', notNull: true },
        { name: 'activity_date', type: 'DATE', notNull: true },

        // Chat room
        { name: 'chat_room', type: 'TEXT' },

        // Activity categorization
        { name: 'activity_type', type: 'TEXT', notNull: true },

        // Structured activity data
        { name: 'activity_summary', type: 'TEXT', notNull: true },
        { name: 'activity_details', type: 'TEXT' },

        // Customer/Location tracking
        { name: 'customer_name', type: 'TEXT' },
        { name: 'location', type: 'TEXT' },

        // Product tracking
        { name: 'products_mentioned', type: 'TEXT' },

        // Task tracking
        { name: 'task_status', type: 'TEXT' },
        { name: 'task_priority', type: 'TEXT' },

        // Time tracking
        { name: 'time_spent_hours', type: 'REAL' },
        { name: 'planned_completion_date', type: 'DATE' },

        // Context & relationships
        { name: 'related_project', type: 'TEXT' },
        { name: 'related_department', type: 'TEXT' },
        { name: 'mentioned_employees', type: 'TEXT' },

        // Flags
        { name: 'requires_followup', type: 'INTEGER', defaultValue: 0 },
        { name: 'is_blocker', type: 'INTEGER', defaultValue: 0 },
        { name: 'sentiment', type: 'TEXT' },

        // Next action
        { name: 'next_action', type: 'TEXT' },
        { name: 'next_action_date', type: 'DATE' },

        // AI metadata
        { name: 'confidence_score', type: 'REAL', defaultValue: 0.0 },
        { name: 'extraction_model', type: 'TEXT' }
      ],
      {
        tableName: 'employee_activity_log',
        description: 'Employee activities extracted from KakaoTalk messages - tracks customer visits, sales activities, work completed',
        uniqueKeyColumns: ['employee_name', 'activity_date', 'activity_summary'],
        duplicateAction: 'skip'
      }
    );
    console.log('✅ Table created successfully\n');
  } catch (error: any) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  }

  // Step 4: Restore data (without source_message_ids for now - will be populated on re-extraction)
  console.log('📥 Step 4: Restoring old data (without source tracking)...');

  if (existingData.rows.length > 0) {
    const cleanedRows = existingData.rows.map((row: any) => {
      const { id, source_message_id, ...rest } = row;
      return {
        ...rest,
        source_message_ids: null // Will be populated on re-extraction
      };
    });

    // Insert in batches
    for (let i = 0; i < cleanedRows.length; i += 20) {
      const batch = cleanedRows.slice(i, i + 20);
      await insertRows('employee_activity_log', batch);
      console.log(`   Inserted batch ${Math.floor(i/20) + 1} (${batch.length} rows)`);
    }

    console.log(`✅ Restored ${cleanedRows.length} rows\n`);
  }

  // Step 5: Verify
  console.log('🔍 Step 5: Verifying new table...');
  const verify = await executeSQL(`SELECT COUNT(*) as count FROM employee_activity_log`);
  console.log(`✅ Table has ${verify.rows[0].count} rows`);

  const schema = await executeSQL(`PRAGMA table_info(employee_activity_log)`);
  const hasNewField = schema.rows?.some((col: any) => col.name === 'source_message_ids');
  const hasOldField = schema.rows?.some((col: any) => col.name === 'source_message_id');

  console.log(`✅ source_message_ids field exists: ${hasNewField}`);
  console.log(`✅ old source_message_id removed: ${!hasOldField}\n`);

  console.log('✅ Migration complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Update extraction script to populate source_message_ids');
  console.log('   2. Re-extract data to populate source tracking');
  console.log(`   3. Old backup saved to: ${backupFile}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
