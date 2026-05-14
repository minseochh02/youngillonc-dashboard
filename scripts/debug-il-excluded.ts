import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      s.적요,
      e.사원_담당_명,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (
      SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, s.담당자코드
      FROM sales s
      UNION ALL
      SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, s.담당자코드
      FROM east_division_sales s
      UNION ALL
      SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, s.담당자코드
      FROM west_division_sales s
    ) s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
    WHERE substr(s.일자, 1, 7) = '2026-03'
      AND i.품목그룹1코드 = 'IL'
      AND (e.사원_담당_명 = '김도량' OR s.적요 = '삼광')
    GROUP BY 1, 2
  `;

  console.log('Checking excluded IL sales for March 2026...');
  const res = await executeSQL(query);
  console.table(res?.rows || []);
}

main().catch(console.error);
