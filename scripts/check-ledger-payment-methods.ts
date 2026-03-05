/**
 * Check how to identify payment methods in ledger
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
  console.log('Checking payment method identification in ledger...\n');

  // Check distinct 적요 patterns for 외상매출금 credits
  const patternQuery = `
    SELECT DISTINCT 적요
    FROM ledger
    WHERE 계정명 = '외상매출금'
      AND CAST(REPLACE(대변금액, ',', '') AS NUMERIC) > 0
    ORDER BY 적요
    LIMIT 50
  `;
  const patternResult = await callEgdeskAPI('user_data_sql_query', { query: patternQuery });

  console.log('적요 patterns for 외상매출금 credits (payments):');
  patternResult.rows.forEach((row: any) => console.log(`  - ${row.적요}`));

  // Check if there are any 카드 related entries
  const cardQuery = `
    SELECT 일자, 적요, 거래처명, 대변금액
    FROM ledger
    WHERE 계정명 = '외상매출금'
      AND (적요 LIKE '%카드%' OR 적요 LIKE '%이니시스%')
      AND CAST(REPLACE(대변금액, ',', '') AS NUMERIC) > 0
    LIMIT 10
  `;
  const cardResult = await callEgdeskAPI('user_data_sql_query', { query: cardQuery });

  console.log('\n카드 related entries:');
  console.log(JSON.stringify(cardResult.rows, null, 2));

  // Check 받을어음 account (promissory notes)
  const noteQuery = `
    SELECT 일자, 적요, 거래처명, 차변금액, 대변금액
    FROM ledger
    WHERE 계정명 = '받을어음'
    ORDER BY 일자
    LIMIT 10
  `;
  const noteResult = await callEgdeskAPI('user_data_sql_query', { query: noteQuery });

  console.log('\n받을어음 (promissory notes) entries:');
  console.log(JSON.stringify(noteResult.rows, null, 2));
}

main().catch(console.error);
