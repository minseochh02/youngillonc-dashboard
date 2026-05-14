import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      'Unfiltered Sales' as type,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (
      SELECT 일자, 품목코드, 중량, 적요, 거래처코드 FROM sales
      UNION ALL
      SELECT 일자, 품목코드, 중량, 적요, 거래처코드 FROM east_division_sales
      UNION ALL
      SELECT 일자, 품목코드, 중량, 적요, 거래처코드 FROM west_division_sales
    ) s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE substr(s.일자, 1, 7) = '2026-02'
      AND i.품목그룹1코드 = 'IL'
  `;

  console.log(`Checking IL raw sales for Feb 2026...`);
  const res = await executeSQL(query);
  const weight = res?.rows?.[0]?.weight || 0;
  console.log(`Weight: ${Number(weight).toLocaleString('ko-KR')}`);
}

main().catch(console.error);
