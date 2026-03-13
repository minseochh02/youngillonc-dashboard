#!/usr/bin/env tsx
/**
 * View Extracted Activities
 *
 * Shows activities and standups for a specific date
 */

import { executeSQL, queryTable } from '../egdesk-helpers';

async function main() {
  const date = process.argv[2] || '2024-03-11';

  console.log(`📊 Viewing extracted activities for ${date}\n`);

  // Get activities
  const activities = await executeSQL(`
    SELECT *
    FROM employee_activity_log
    WHERE activity_date = '${date}'
    ORDER BY employee_name, id
  `);

  console.log(`📋 Activities (${activities?.rows?.length || 0} total):\n`);
  if (activities && activities.rows) {
    activities.rows.forEach((activity: any, idx: number) => {
      console.log(`${(idx + 1).toString().padStart(2)}. [${activity.employee_name}] ${activity.activity_type}`);
      console.log(`    ${activity.activity_summary}`);
      if (activity.customer_name) console.log(`    Customer: ${activity.customer_name}`);
      if (activity.location) console.log(`    Location: ${activity.location}`);
      if (activity.products_mentioned) {
        const products = JSON.parse(activity.products_mentioned);
        if (products.length > 0) console.log(`    Products: ${products.join(', ')}`);
      }
      if (activity.next_action) console.log(`    Next: ${activity.next_action} (${activity.next_action_date})`);
      console.log();
    });
  }

  // Get standups
  const standups = await executeSQL(`
    SELECT *
    FROM daily_standup_log
    WHERE report_date = '${date}'
    ORDER BY employee_name
  `);

  console.log(`\n📊 Daily Standups (${standups?.rows?.length || 0} total):\n`);
  if (standups && standups.rows) {
    standups.rows.forEach((standup: any, idx: number) => {
      console.log(`${(idx + 1).toString().padStart(2)}. ${standup.employee_name}`);
      if (standup.checkout_location) console.log(`    Checkout: ${standup.checkout_location}`);

      const completed = JSON.parse(standup.completed_today || '[]');
      if (completed.length > 0) {
        console.log(`    Completed (${completed.length}):`);
        completed.forEach((t: any) => console.log(`       - ${t.task}${t.customer ? ` (${t.customer})` : ''}`));
      }

      const planned = JSON.parse(standup.planned_tasks || '[]');
      if (planned.length > 0) {
        console.log(`    Planned (${planned.length}):`);
        planned.forEach((t: any) => console.log(`       - ${t.task}${t.customer ? ` (${t.customer})` : ''}`));
      }

      const customers = JSON.parse(standup.customers_visited || '[]');
      if (customers.length > 0) console.log(`    Customers: ${customers.join(', ')}`);

      console.log();
    });
  }

  // Summary stats
  console.log('\n📈 Summary Stats:\n');

  const customerStats = await executeSQL(`
    SELECT
      customer_name,
      COUNT(*) as activity_count,
      GROUP_CONCAT(DISTINCT employee_name) as employees
    FROM employee_activity_log
    WHERE activity_date = '${date}'
      AND customer_name IS NOT NULL
    GROUP BY customer_name
    ORDER BY activity_count DESC
  `);

  if (customerStats && customerStats.rows && customerStats.rows.length > 0) {
    console.log('Top Customers:');
    customerStats.rows.forEach((row: any) => {
      console.log(`   ${row.customer_name}: ${row.activity_count} activities`);
    });
  }

  console.log('\n✅ View complete!');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
