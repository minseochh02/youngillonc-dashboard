#!/usr/bin/env tsx
/**
 * Drop and recreate employee_activity_log with state-tracking fields
 *
 * New fields:
 * - is_repeat_visit: Flag if this visit was to a recently visited customer
 * - context_notes: AI-generated notes about historical context
 * - is_followup_to: Links to previous activity ID
 */

import { createTable, deleteTable } from '../egdesk-helpers';

async function main() {
  console.log('🔨 Dropping and recreating employee_activity_log with state-tracking fields...\n');

  // Drop existing table
  try {
    console.log('  Dropping existing table...');
    await deleteTable('employee_activity_log');
    console.log('  ✅ Table dropped\n');
  } catch (error: any) {
    console.log('  ⚠️  Could not drop table:', error.message);
    console.log();
  }

  // Create new table
  console.log('  Creating new table...');
  const result = await createTable(
    '직원활동로그',
    [
      // Existing fields
      { name: 'employee_name', type: 'TEXT', notNull: true },
      { name: 'activity_date', type: 'TEXT', notNull: true },
      { name: 'activity_type', type: 'TEXT' },
      { name: 'activity_summary', type: 'TEXT' },

      // Customer/location
      { name: 'customer_name', type: 'TEXT' },
      { name: 'location', type: 'TEXT' },

      // Products
      { name: 'products_mentioned', type: 'TEXT' },

      // Task status
      { name: 'task_status', type: 'TEXT' },

      // Follow-up tracking
      { name: 'next_action', type: 'TEXT' },
      { name: 'next_action_date', type: 'TEXT' },
      { name: 'requires_followup', type: 'INTEGER', defaultValue: 0 },
      { name: 'is_blocker', type: 'INTEGER', defaultValue: 0 },

      // NEW: State-based context fields
      { name: 'is_followup_to', type: 'INTEGER' },
      { name: 'context_notes', type: 'TEXT' },
      { name: 'is_repeat_visit', type: 'INTEGER', defaultValue: 0 },

      // Source tracking
      { name: 'source_message_ids', type: 'TEXT' },
      { name: 'chat_room', type: 'TEXT' },

      // Metadata
      { name: 'confidence_score', type: 'REAL' },
      { name: 'sentiment', type: 'TEXT' },
      { name: 'extraction_model', type: 'TEXT' },
      { name: 'activity_details', type: 'TEXT' }
    ],
    {
      tableName: 'employee_activity_log',
      description: 'Employee activity log with state-based context tracking'
    }
  );

  console.log('✅ Table recreated successfully!\n');
  console.log('New fields added:');
  console.log('  - is_followup_to: Links to previous activity ID');
  console.log('  - context_notes: AI-generated historical context');
  console.log('  - is_repeat_visit: Boolean flag for repeat customer visits');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
