/**
 * Check deposits table date format
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
  console.log('Checking deposits table date format...\n');

  // Sample deposits data
  const sampleQuery = `SELECT 전표번호, 계정명, 부서명, 금액, 계좌 FROM deposits WHERE 계정명 = '외상매출금' LIMIT 20`;
  const sampleResult = await callEgdeskAPI('user_data_sql_query', { query: sampleQuery });

  console.log('Sample deposits data:');
  console.log(JSON.stringify(sampleResult.rows, null, 2));

  // Check unique 전표번호 patterns
  const dateQuery = `SELECT DISTINCT 전표번호 FROM deposits ORDER BY 전표번호 LIMIT 30`;
  const dateResult = await callEgdeskAPI('user_data_sql_query', { query: dateQuery });

  console.log('\n전표번호 samples:');
  console.log(JSON.stringify(dateResult.rows, null, 2));
}

main().catch(console.error);
