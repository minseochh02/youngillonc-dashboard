#!/usr/bin/env tsx
/**
 * View Employee Master Data
 *
 * Shows employee information from the employee_master table
 */

import { queryTable, executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('👥 Employee Master Data\n');

  // Get all employees
  const employees = await queryTable('employee_master', {
    orderBy: 'total_messages',
    orderDirection: 'DESC',
    limit: 100
  });

  if (!employees || !employees.rows || employees.rows.length === 0) {
    console.log('⚠️  No employees found');
    return;
  }

  console.log(`📊 Total employees: ${employees.rows.length}\n`);

  // Group by region
  const byRegion = await executeSQL(`
    SELECT
      region,
      COUNT(*) as employee_count,
      SUM(total_messages) as total_messages,
      MIN(first_message_date) as earliest_activity,
      MAX(last_message_date) as latest_activity
    FROM employee_master
    GROUP BY region
    ORDER BY employee_count DESC
  `);

  console.log('🗺️  Employees by Region:');
  if (byRegion && byRegion.rows) {
    byRegion.rows.forEach((row: any) => {
      console.log(`   ${row.region}:`);
      console.log(`      - ${row.employee_count} employees`);
      console.log(`      - ${row.total_messages} total messages`);
      console.log(`      - Active from ${row.earliest_activity} to ${row.latest_activity}`);
      console.log();
    });
  }

  // Show all employees with details
  console.log('📋 All Employees:\n');
  employees.rows.forEach((emp: any, idx: number) => {
    const chatRooms = emp.chat_rooms ? JSON.parse(emp.chat_rooms) : [];
    console.log(`${(idx + 1).toString().padStart(2)}. ${emp.employee_name}`);
    console.log(`    Region: ${emp.region}`);
    console.log(`    Messages: ${emp.total_messages}`);
    console.log(`    Active: ${emp.first_message_date} to ${emp.last_message_date}`);
    console.log(`    Chat rooms: ${chatRooms.length > 0 ? chatRooms.join(', ') : 'None'}`);
    console.log(`    Status: ${emp.employment_status}`);
    console.log();
  });

  console.log('✅ Employee master view complete!');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
