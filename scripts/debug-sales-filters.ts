import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';
import { 
  sqlAndEmployeeNotSpecialHandling, 
  sqlAndSalesRemarkNotExact,
  sqlAndClientKeyNotAssignedToSpecialHandling
} from '../src/lib/special-handling-employees';

async function main() {
  const categories = ['PVL', 'CVL'];
  
  for (const cat of categories) {
    const query = `
      SELECT
        'Unfiltered' as type,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
      FROM (
        SELECT 일자, 품목코드, 중량, 적요, 거래처코드 FROM sales
        UNION ALL
        SELECT 일자, 품목코드, 중량, 적요, 거래처코드 FROM east_division_sales
        UNION ALL
        SELECT 일자, 품목코드, 중량, 적요, 거래처코드 FROM west_division_sales
      ) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-01'
        AND i.품목그룹1코드 = '${cat}'

      UNION ALL

      SELECT
        'With Dashboard Filters' as type,
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
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      WHERE substr(s.일자, 1, 7) = '2026-01'
        AND i.품목그룹1코드 = '${cat}'
        ${sqlAndEmployeeNotSpecialHandling()}
        ${sqlAndSalesRemarkNotExact('s.적요')}
    `;

    console.log(`Checking filters for ${cat} in Jan 2026...`);
    const result = await executeSQL(query);
    const rows = result?.rows || [];
    console.table(rows.map((r: any) => ({
      Type: r.type,
      Weight: Number(r.weight).toLocaleString('ko-KR')
    })));
  }
}

main().catch(console.error);
