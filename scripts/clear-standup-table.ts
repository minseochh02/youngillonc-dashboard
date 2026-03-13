#!/usr/bin/env tsx
import { deleteTable, createTable } from '../egdesk-helpers';

async function main() {
  console.log('🗑️  Dropping daily_standup_log table...');
  await deleteTable('daily_standup_log');
  console.log('✅ Table dropped');

  console.log('🔨 Recreating daily_standup_log table...');
  await createTable(
    '일일업무요약',
    [
      { name: 'employee_name', type: 'TEXT', notNull: true },
      { name: 'report_date', type: 'DATE', notNull: true },
      { name: 'completed_today', type: 'TEXT' },
      { name: 'planned_tasks', type: 'TEXT' },
      { name: 'blockers', type: 'TEXT' },
      { name: 'customers_visited', type: 'TEXT' },
      { name: 'products_discussed', type: 'TEXT' },
      { name: 'checkout_location', type: 'TEXT' },
      { name: 'work_region', type: 'TEXT' },
      { name: 'notes', type: 'TEXT' },
      { name: 'source_messages', type: 'TEXT' },
      { name: 'confidence_score', type: 'REAL' }
    ],
    {
      tableName: 'daily_standup_log',
      description: 'Daily standup-style summary of employee work activities aggregated by date',
      uniqueKeyColumns: ['employee_name', 'report_date'],
      duplicateAction: 'update'
    }
  );
  console.log('✅ Table recreated');
}

main();
