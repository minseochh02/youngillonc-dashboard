#!/usr/bin/env tsx
import { deleteRows, executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('🗑️  Clearing March 8-11 data...');
  
  // Get count first
  const actCount = await executeSQL(`
    SELECT COUNT(*) as count FROM employee_activity_log
    WHERE activity_date BETWEEN '2024-03-08' AND '2024-03-11'
  `);
  console.log(`Found ${actCount.rows[0].count} activities to delete`);
  
  const standupCount = await executeSQL(`
    SELECT COUNT(*) as count FROM daily_standup_log
    WHERE report_date BETWEEN '2024-03-08' AND '2024-03-11'
  `);
  console.log(`Found ${standupCount.rows[0].count} standups to delete`);
  
  // Get IDs
  const actIds = await executeSQL(`
    SELECT id FROM employee_activity_log
    WHERE activity_date BETWEEN '2024-03-08' AND '2024-03-11'
  `);
  
  const standupIds = await executeSQL(`
    SELECT id FROM daily_standup_log
    WHERE report_date BETWEEN '2024-03-08' AND '2024-03-11'
  `);
  
  if (actIds.rows.length > 0) {
    await deleteRows('employee_activity_log', {
      ids: actIds.rows.map((r: any) => r.id)
    });
    console.log(`✅ Deleted ${actIds.rows.length} activities`);
  }
  
  if (standupIds.rows.length > 0) {
    await deleteRows('daily_standup_log', {
      ids: standupIds.rows.map((r: any) => r.id)
    });
    console.log(`✅ Deleted ${standupIds.rows.length} standups`);
  }
}

main();
