/**
 * Check the structure of the November ledger table
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
  console.log('Checking November ledger table structure...\n');

  // Get sample data
  const sampleQuery = `SELECT * FROM vpso3wu1if6yi7eo LIMIT 5`;
  const sampleResult = await callEgdeskAPI('user_data_sql_query', { query: sampleQuery });

  console.log('Sample rows from vpso3wu1if6yi7eo:');
  console.log(JSON.stringify(sampleResult.rows, null, 2));

  // Get column names
  if (sampleResult.rows.length > 0) {
    console.log('\nColumn names:');
    console.log(Object.keys(sampleResult.rows[0]).join(', '));
  }

  // Count rows
  const countQuery = `SELECT COUNT(*) as count FROM vpso3wu1if6yi7eo`;
  const countResult = await callEgdeskAPI('user_data_sql_query', { query: countQuery });
  console.log(`\nTotal rows in vpso3wu1if6yi7eo: ${countResult.rows[0].count}`);

  // Check date range
  const dateQuery = `SELECT MIN(일자) as min_date, MAX(일자) as max_date, COUNT(DISTINCT 일자) as unique_dates FROM vpso3wu1if6yi7eo`;
  const dateResult = await callEgdeskAPI('user_data_sql_query', { query: dateQuery });
  console.log('\nDate range:');
  console.log(JSON.stringify(dateResult.rows, null, 2));

  // Check if ledger already has November data
  const ledgerNovCheck = `SELECT COUNT(*) as count FROM ledger WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
  const ledgerNovResult = await callEgdeskAPI('user_data_sql_query', { query: ledgerNovCheck });
  console.log(`\nExisting November 2025 rows in ledger: ${ledgerNovResult.rows[0].count}`);
}

main().catch(console.error);
