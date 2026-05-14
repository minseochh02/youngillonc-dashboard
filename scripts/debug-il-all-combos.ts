import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';
import { 
  sqlAndEmployeeNotSpecialHandling, 
  sqlAndSalesRemarkNotExact,
  sqlMeetingPurchaseIncludedClientPredicate
} from '../src/lib/special-handling-employees';

async function main() {
  const category = 'IL';
  const warehouseFilter = `(w.창고명 LIKE '%사업소%' OR w.창고명 LIKE '%지사%' OR w.창고명 = 'MB' OR w.창고명 LIKE '%화성%' OR w.창고명 LIKE '%창원%' OR w.창고명 LIKE '%남부%' OR w.창고명 LIKE '%중부%' OR w.창고명 LIKE '%서부%' OR w.창고명 LIKE '%동부%' OR w.창고명 LIKE '%제주%' OR w.창고명 LIKE '%부산%')`;

  const combinations = [
    { name: 'Current Dashboard (Filtered Sales + PR00061)', wh: false, salesFiltered: true, purFiltered: true },
    { name: 'Raw Data (No Filters)', wh: false, salesFiltered: false, purFiltered: false },
    { name: 'Warehouse Filtered Only', wh: true, salesFiltered: false, purFiltered: false },
    { name: 'Everything Combined (Filters + WH)', wh: true, salesFiltered: true, purFiltered: true },
  ];

  const snapshotSql = (wh: boolean) => `
    SELECT SUM(CAST(COALESCE(inv.총중량, 0) AS NUMERIC)) as weight
    FROM (
      SELECT 품목코드, 창고코드, 총중량 FROM youngil_inventory_20251231
      UNION ALL
      SELECT 품목코드, 창고코드, 총중량 FROM west_inventory_20251231
      UNION ALL
      SELECT 품목코드, 창고코드, 총중량 FROM east_inventory_20251231
    ) inv
    LEFT JOIN items i ON inv.품목코드 = i.품목코드
    ${wh ? "LEFT JOIN warehouses w ON inv.창고코드 = w.창고코드 OR CAST(inv.창고코드 AS TEXT) = CAST(w.창고코드 AS TEXT)" : ""}
    WHERE i.품목그룹1코드 = '${category}'
    ${wh ? `AND ${warehouseFilter}` : ""}
  `;

  const flowsSql = (month: string, wh: boolean, salesFiltered: boolean, purFiltered: boolean) => `
    SELECT 
      (SELECT SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC))
       FROM purchases p
       LEFT JOIN items i ON p.품목코드 = i.품목코드
       ${wh ? "LEFT JOIN warehouses w ON p.창고코드 = w.창고코드" : ""}
       WHERE substr(p.일자, 1, 7) = '${month}'
         AND i.품목그룹1코드 = '${category}'
         ${purFiltered ? `AND ${sqlMeetingPurchaseIncludedClientPredicate('p.거래처코드')}` : ""}
         ${wh ? `AND ${warehouseFilter}` : ""}
      ) as purchase,
      (SELECT SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))
       FROM (
         SELECT 일자, 품목코드, 중량, 적요, 거래처코드, 담당자코드, 출하창고코드 FROM sales
         UNION ALL
         SELECT 일자, 품목코드, 중량, 적요, 거래처코드, 담당자코드, 출하창고코드 FROM east_division_sales
         UNION ALL
         SELECT 일자, 품목코드, 중량, 적요, 거래처코드, 담당자코드, 출하창고코드 FROM west_division_sales
       ) s
       LEFT JOIN items i ON s.품목코드 = i.품목코드
       ${salesFiltered ? "LEFT JOIN clients c ON s.거래처코드 = c.거래처코드" : ""}
       ${salesFiltered ? "LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드" : ""}
       ${wh ? "LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드" : ""}
       WHERE substr(s.일자, 1, 7) = '${month}'
         AND i.품목그룹1코드 = '${category}'
         ${salesFiltered ? sqlAndEmployeeNotSpecialHandling() : ""}
         ${salesFiltered ? sqlAndSalesRemarkNotExact('s.적요') : ""}
         ${wh ? `AND ${warehouseFilter}` : ""}
      ) as sales
  `;

  for (const c of combinations) {
    console.log(`--- ${c.name} ---`);
    const snapRes = await executeSQL(snapshotSql(c.wh));
    let inv = snapRes?.rows?.[0]?.weight || 0;
    
    for (const m of ['2026-01', '2026-02', '2026-03']) {
      const flowRes = await executeSQL(flowsSql(m, c.wh, c.salesFiltered, c.purFiltered));
      const p = flowRes?.rows?.[0]?.purchase || 0;
      const s = flowRes?.rows?.[0]?.sales || 0;
      inv = inv + p - s;
      if (m === '2026-03') {
        console.log(`March End Inventory: ${Math.round(inv).toLocaleString('ko-KR')}`);
      }
    }
  }
}

main().catch(console.error);
