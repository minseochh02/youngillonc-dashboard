#!/usr/bin/env tsx
/**
 * Create employee_knowledge table for state-based extraction
 */

import { createTable } from '../egdesk-helpers';

async function main() {
  console.log('🔨 Creating employee_knowledge table...\n');

  const result = await createTable(
    '직원지식베이스',
    [
      { name: 'employee_name', type: 'TEXT', notNull: true },
      { name: 'open_tasks', type: 'TEXT' },           // JSON array
      { name: 'recent_visits', type: 'TEXT' },        // JSON array
      { name: 'ongoing_issues', type: 'TEXT' },       // JSON array
      { name: 'last_updated', type: 'TEXT' },         // ISO timestamp
      { name: 'last_activity_date', type: 'TEXT' }    // ISO date
    ],
    {
      tableName: 'employee_knowledge',
      description: 'AI-maintained state of each employee\'s work context for intelligent extraction',
      uniqueKeyColumns: ['employee_name'],
      duplicateAction: 'update'
    }
  );

  console.log('✅ Table created successfully!\n');
  console.log('Table: employee_knowledge');
  console.log('Fields:');
  console.log('  - employee_name (PRIMARY KEY)');
  console.log('  - open_tasks (JSON)');
  console.log('  - recent_visits (JSON)');
  console.log('  - ongoing_issues (JSON)');
  console.log('  - last_updated');
  console.log('  - last_activity_date');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
