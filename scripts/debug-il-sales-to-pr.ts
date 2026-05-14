import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (
      SELECT 일자, 품목코드, 중량, 거래처코드 FROM sales
      UNION ALL
      SELECT 일자, 품목코드, 중량, 거래처코드 FROM east_division_sales
      UNION ALL
      SELECT 일자, 품목코드, 중량, 거래처코드 FROM west_division_sales
    ) s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE s.거래처코드 = 'PR00061'
      AND i.품목그룹1코드 = 'IL'
  `;

  console.log('Checking for IL sales to PR00061...');
  const res = await executeSQL(query);
  const weight = res?.rows?.[0]?.weight || 0;
  console.log(`Weight: ${weight}`);
}

main().catch(console.error);
