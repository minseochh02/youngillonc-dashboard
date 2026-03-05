/**
 * Check if ledger table has collection/deposit data with daily granularity
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
  console.log('Checking ledger table for collection data...\n');

  // Check what account names exist
  const accountsQuery = `SELECT DISTINCT 계정명 FROM ledger ORDER BY 계정명`;
  const accountsResult = await callEgdeskAPI('user_data_sql_query', { query: accountsQuery });

  console.log('Available account names in ledger:');
  accountsResult.rows.forEach((row: any) => console.log(`  - ${row.계정명}`));

  // Check for 외상매출금 entries
  const salesAccountQuery = `
    SELECT 일자, 적요, 계정명, 거래처명, 부서명, 차변금액, 대변금액
    FROM ledger
    WHERE 계정명 = '외상매출금'
    ORDER BY 일자
    LIMIT 20
  `;
  const salesAccountResult = await callEgdeskAPI('user_data_sql_query', { query: salesAccountQuery });

  console.log('\n외상매출금 sample entries:');
  console.log(JSON.stringify(salesAccountResult.rows, null, 2));

  // Check date range
  const dateRangeQuery = `
    SELECT
      MIN(일자) as min_date,
      MAX(일자) as max_date,
      COUNT(DISTINCT 일자) as unique_dates
    FROM ledger
    WHERE 계정명 = '외상매출금'
  `;
  const dateRangeResult = await callEgdeskAPI('user_data_sql_query', { query: dateRangeQuery });

  console.log('\n외상매출금 date range:');
  console.log(JSON.stringify(dateRangeResult.rows, null, 2));

  // Check if we have February 2026 data
  const febQuery = `
    SELECT 일자, COUNT(*) as count, SUM(CAST(REPLACE(대변금액, ',', '') AS NUMERIC)) as total_credit
    FROM ledger
    WHERE 계정명 = '외상매출금'
      AND 일자 >= '2026-02-01' AND 일자 <= '2026-02-04'
    GROUP BY 일자
    ORDER BY 일자
  `;
  const febResult = await callEgdeskAPI('user_data_sql_query', { query: febQuery });

  console.log('\nFebruary 1-4, 2026 외상매출금 entries by date:');
  console.log(JSON.stringify(febResult.rows, null, 2));
}

main().catch(console.error);
