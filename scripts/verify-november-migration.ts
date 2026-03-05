/**
 * Verify November 2025 ledger migration
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
  console.log('Verifying November 2025 migration...\n');

  // Check row count
  const countQuery = `SELECT COUNT(*) as count FROM ledger WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
  const countResult = await callEgdeskAPI('user_data_sql_query', { query: countQuery });
  console.log(`Total November 2025 rows in ledger: ${countResult.rows[0].count}`);

  // Check date range
  const rangeQuery = `SELECT MIN(일자) as min_date, MAX(일자) as max_date, COUNT(DISTINCT 일자) as unique_dates FROM ledger WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
  const rangeResult = await callEgdeskAPI('user_data_sql_query', { query: rangeQuery });
  console.log(`Date range: ${rangeResult.rows[0].min_date} to ${rangeResult.rows[0].max_date}`);
  console.log(`Unique dates: ${rangeResult.rows[0].unique_dates}`);

  // Sample some rows
  const sampleQuery = `SELECT 일자, 일자_no, 적요, 거래처명, 부서명, 계정명, 차변금액, 대변금액 FROM ledger WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30' LIMIT 5`;
  const sampleResult = await callEgdeskAPI('user_data_sql_query', { query: sampleQuery });
  console.log('\nSample rows:');
  console.log(JSON.stringify(sampleResult.rows, null, 2));

  // Check 외상매출금 count
  const salesQuery = `SELECT COUNT(*) as count FROM ledger WHERE 계정명 = '외상매출금' AND 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
  const salesResult = await callEgdeskAPI('user_data_sql_query', { query: salesQuery });
  console.log(`\n외상매출금 rows: ${salesResult.rows[0].count}`);
}

main().catch(console.error);
