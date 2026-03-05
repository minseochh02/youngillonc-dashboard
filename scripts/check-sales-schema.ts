/**
 * Check the sales table schema
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
  console.log('Checking sales data...\n');

  // Check sample of actual data
  const sampleQuery = `SELECT 일자, 판매처명, 품목그룹1코드 FROM sales WHERE 일자 LIKE '2025-11%' LIMIT 10`;
  const sampleResult = await callEgdeskAPI('user_data_sql_query', { query: sampleQuery });

  console.log('Sample data from November 2025:');
  console.log(JSON.stringify(sampleResult.rows, null, 2));

  // Check date distribution in November
  const dateDistQuery = `SELECT 일자, COUNT(*) as count FROM sales WHERE 일자 LIKE '2025-11%' GROUP BY 일자 ORDER BY 일자`;
  const dateDistResult = await callEgdeskAPI('user_data_sql_query', { query: dateDistQuery });

  console.log('\nDate distribution in November 2025:');
  console.log(JSON.stringify(dateDistResult.rows, null, 2));
}

main().catch(console.error);
