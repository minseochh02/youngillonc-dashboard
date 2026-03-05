/**
 * Check if there are any November 2025 deposits
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
  console.log('Checking for November 2025 deposits...\n');

  // Check if any November 2025 deposits exist
  const novQuery = `SELECT COUNT(*) as count FROM deposits WHERE 전표번호 LIKE '2025-11%'`;
  const novResult = await callEgdeskAPI('user_data_sql_query', { query: novQuery });
  console.log('November 2025 deposits count:', novResult.rows[0].count);

  // Check all unique dates
  const allDatesQuery = `SELECT DISTINCT 전표번호 FROM deposits ORDER BY 전표번호`;
  const allDatesResult = await callEgdeskAPI('user_data_sql_query', { query: allDatesQuery });
  console.log('\nAll unique 전표번호 in deposits table:');
  console.log(JSON.stringify(allDatesResult.rows, null, 2));

  // Test the exact query from the API
  const date = '2025-11-01';
  const startDate = '2025-11-01';
  const testQuery = `
    SELECT COUNT(*) as count, SUM(CAST(REPLACE(금액, ',', '') AS NUMERIC)) as total
    FROM deposits
    WHERE 계정명 = '외상매출금'
      AND 전표번호 >= '${startDate}' AND 전표번호 <= '${date}'
  `;
  const testResult = await callEgdeskAPI('user_data_sql_query', { query: testQuery });
  console.log('\nTest query for Nov 2025 range:');
  console.log(JSON.stringify(testResult.rows, null, 2));
}

main().catch(console.error);
