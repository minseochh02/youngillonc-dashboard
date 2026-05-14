import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';
import { 
  sqlAndEmployeeNotSpecialHandling, 
  sqlAndSalesRemarkNotExact
} from '../src/lib/special-handling-employees';

async function main() {
  const month = '2026-03';
  const category = 'IL';

  const queries = [
    {
      name: 'Unfiltered Sales (Raw)',
      sql: `
        SELECT SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
        FROM (
          SELECT 일자, 품목코드, 중량, 적요, 거래처코드 FROM sales
          UNION ALL
          SELECT 일자, 품목코드, 중량, 적요, 거래처코드 FROM east_division_sales
          UNION ALL
          SELECT 일자, 품목코드, 중량, 적요, 거래처코드 FROM west_division_sales
        ) s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE substr(s.일자, 1, 7) = '${month}'
          AND i.품목그룹1코드 = '${category}'
      `
    },
    {
      name: 'Dashboard Filtered Sales',
      sql: `
        SELECT SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
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
        WHERE substr(s.일자, 1, 7) = '${month}'
          AND i.품목그룹1코드 = '${category}'
          ${sqlAndEmployeeNotSpecialHandling()}
          ${sqlAndSalesRemarkNotExact('s.적요')}
      `
    }
  ];

  console.log(`Analyzing IL sales for ${month}...`);
  for (const q of queries) {
    const res = await executeSQL(q.sql);
    const weight = res?.rows?.[0]?.weight || 0;
    console.log(`${q.name}: ${Number(weight).toLocaleString('ko-KR')}`);
  }
}

main().catch(console.error);
