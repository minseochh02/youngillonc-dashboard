/**
 * Verify employee activity tables were created successfully
 */

import { EGDESK_CONFIG } from '../egdesk.config';

async function callEgdeskAPI(tool: string, args: any) {
  const apiUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EGDESK_API_URL) ||
    EGDESK_CONFIG.apiUrl;
  const apiKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EGDESK_API_KEY) ||
    EGDESK_CONFIG.apiKey;

  const response = await fetch(`${apiUrl}/user-data/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      tool,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Tool call failed');
  }

  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

async function main() {
  console.log('Verifying employee activity tables...\n');

  // Check if tables exist
  const tablesQuery = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('employee_activity_log', 'daily_standup_log', 'employee_master')
    ORDER BY table_name
  `;

  try {
    const tablesResult = await callEgdeskAPI('user_data_sql_query', { query: tablesQuery });
    console.log('Tables found:');
    tablesResult.rows.forEach((row: any) => console.log(`  ✓ ${row.table_name}`));
    console.log();

    // Check views
    const viewsQuery = `
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name LIKE 'v_%'
      ORDER BY table_name
    `;

    const viewsResult = await callEgdeskAPI('user_data_sql_query', { query: viewsQuery });
    console.log('Views found:');
    viewsResult.rows.forEach((row: any) => console.log(`  ✓ ${row.table_name}`));
    console.log();

    // Check employee_master data
    const employeesQuery = `SELECT COUNT(*) as count FROM employee_master`;
    const employeesResult = await callEgdeskAPI('user_data_sql_query', { query: employeesQuery });
    console.log(`Employee master records: ${employeesResult.rows[0].count}`);

    if (employeesResult.rows[0].count > 0) {
      const sampleEmployeesQuery = `SELECT employee_name, department, employment_status FROM employee_master LIMIT 5`;
      const sampleResult = await callEgdeskAPI('user_data_sql_query', { query: sampleEmployeesQuery });
      console.log('\nSample employees:');
      console.log(JSON.stringify(sampleResult.rows, null, 2));
    }

    console.log('\n✓ Verification complete!');
  } catch (error) {
    console.error('Error during verification:', error);
    console.log('\nTables may not be created yet. Run migrations first:');
    console.log('  npx tsx scripts/run-migration.ts 001_create_employee_activity_tables.sql');
    console.log('  npx tsx scripts/run-migration.ts 002_seed_employee_master.sql');
  }
}

main().catch(console.error);
