import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const date = '2025-12-31';
  const category = 'IL';

  const queries = [
    {
      name: 'Purchases (PR00061)',
      sql: `SELECT SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight FROM purchases p LEFT JOIN items i ON p.품목코드 = i.품목코드 WHERE p.일자 = '${date}' AND i.품목그룹1코드 = '${category}' AND p.거래처코드 = 'PR00061'`
    },
    {
      name: 'Sales (Filtered)',
      sql: `
        SELECT SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight 
        FROM (SELECT 일자, 품목코드, 중량, 적요, 담당자코드 FROM sales UNION ALL SELECT 일자, 품목코드, 중량, 적요, 담당자코드 FROM east_division_sales UNION ALL SELECT 일자, 품목코드, 중량, 적요, 담당자코드 FROM west_division_sales) s 
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        WHERE s.일자 = '${date}' AND i.품목그룹1코드 = '${category}'
          AND (e.사원_담당_명 IS NULL OR e.사원_담당_명 != '김도량')
          AND (s.적요 IS NULL OR s.적요 != '삼광')
      `
    }
  ];

  console.log(`Checking IL transactions on ${date}...`);
  for (const q of queries) {
    const res = await executeSQL(q.sql);
    console.log(`${q.name}: ${res?.rows?.[0]?.weight || 0}`);
  }
}

main().catch(console.error);
