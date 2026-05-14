import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';
import { 
  sqlAndEmployeeNotSpecialHandling, 
  sqlAndSalesRemarkNotExact,
  sqlMeetingPurchaseIncludedClientPredicate
} from '../src/lib/special-handling-employees';

async function main() {
  const months = ['2026-01', '2026-02', '2026-03'];
  const category = 'IL';

  const warehouseFilter = `(w.창고명 LIKE '%사업소%' OR w.창고명 LIKE '%지사%' OR w.창고명 = 'MB' OR w.창고명 LIKE '%화성%' OR w.창고명 LIKE '%창원%' OR w.창고명 LIKE '%남부%' OR w.창고명 LIKE '%중부%' OR w.창고명 LIKE '%서부%' OR w.창고명 LIKE '%동부%' OR w.창고명 LIKE '%제주%' OR w.창고명 LIKE '%부산%')`;

  for (const month of months) {
    const query = `
      SELECT
        'Purchase (Meeting + WH)' as type,
        SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
      FROM purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON p.창고코드 = w.창고코드
      WHERE substr(p.일자, 1, 7) = '${month}'
        AND i.품목그룹1코드 = '${category}'
        AND ${sqlMeetingPurchaseIncludedClientPredicate('p.거래처코드')}
        AND ${warehouseFilter}

      UNION ALL

      SELECT
        'Sales (Meeting + WH)' as type,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
      FROM (
        SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, s.담당자코드, s.출하창고코드 FROM sales s
        UNION ALL
        SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, s.담당자코드, s.출하창고코드 FROM east_division_sales s
        UNION ALL
        SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, s.담당자코드, s.출하창고코드 FROM west_division_sales s
      ) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
      LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
      WHERE substr(s.일자, 1, 7) = '${month}'
        AND i.품목그룹1코드 = '${category}'
        ${sqlAndEmployeeNotSpecialHandling()}
        ${sqlAndSalesRemarkNotExact('s.적요')}
        AND ${warehouseFilter}
    `;

    console.log(`Checking IL flows for ${month} with WH filter...`);
    const res = await executeSQL(query);
    console.table(res?.rows || []);
  }
}

main().catch(console.error);
