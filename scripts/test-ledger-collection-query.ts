/**
 * Test the updated collection query using ledger
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
  const date = '2026-02-04';
  const startDate = '2026-02-01';
  const division = '창원';

  const getDepBranchFilter = () => {
    if (division === '전체') return "(부서명 LIKE '%사업소%' OR 부서명 LIKE '%지사%')";
    if (division === 'MB') return "부서명 = 'MB'";
    return `부서명 LIKE '%${division}%'`;
  };

  console.log(`Testing collection query for ${division} on ${date}\n`);

  const collectionQuery = `
    SELECT
      method,
      SUM(CASE WHEN 일자 < '${date}' THEN amount ELSE 0 END) as prevTotal,
      SUM(CASE WHEN 일자 = '${date}' THEN amount ELSE 0 END) as today,
      SUM(amount) as total
    FROM (
      SELECT
        CASE
          WHEN 적요 LIKE '%이니시스%' THEN '카드'
          ELSE 'Cash'
        END as method,
        CAST(REPLACE(대변금액, ',', '') AS NUMERIC) as amount,
        일자
      FROM ledger
      WHERE 계정명 = '외상매출금'
        AND ${getDepBranchFilter()}
        AND CAST(REPLACE(대변금액, ',', '') AS NUMERIC) > 0
        AND 일자 >= '${startDate}' AND 일자 <= '${date}'

      UNION ALL

      SELECT
        '어음' as method,
        CAST(REPLACE(대변금액, ',', '') AS NUMERIC) as amount,
        일자
      FROM ledger
      WHERE 계정명 = '받을어음'
        AND ${getDepBranchFilter()}
        AND CAST(REPLACE(대변금액, ',', '') AS NUMERIC) > 0
        AND 일자 >= '${startDate}' AND 일자 <= '${date}'
    )
    GROUP BY method
  `;

  const result = await callEgdeskAPI('user_data_sql_query', { query: collectionQuery });

  console.log('Collection breakdown:');
  console.log(JSON.stringify(result.rows, null, 2));

  console.log('\nFormatted:');
  result.rows.forEach((row: any) => {
    console.log(`${row.method}:`);
    console.log(`  전일누계: ₩${Number(row.prevTotal || 0).toLocaleString()}`);
    console.log(`  당일: ₩${Number(row.today || 0).toLocaleString()}`);
    console.log(`  누계: ₩${Number(row.total || 0).toLocaleString()}`);
  });
}

main().catch(console.error);
