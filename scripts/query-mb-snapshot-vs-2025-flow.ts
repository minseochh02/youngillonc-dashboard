import { config } from 'dotenv';
import { executeSQL } from '../egdesk-helpers';
import { sqlAndPurchaseExcludeMeetingCounterpartyCodes } from '../src/lib/special-handling-employees';

config({ path: '.env.local' });

async function main() {
  const query = `
    SELECT
      COALESCE(ms.snapshot_weight, 0) AS snapshot_weight,
      COALESCE(mp.purchase_weight, 0) AS purchase_weight_2025,
      COALESCE(mx.sales_weight, 0) AS sales_weight_2025,
      COALESCE(ms.snapshot_weight, 0) + COALESCE(mp.purchase_weight, 0) AS snapshot_plus_purchase,
      COALESCE(ms.snapshot_weight, 0) + COALESCE(mp.purchase_weight, 0) - COALESCE(mx.sales_weight, 0) AS after_sales_balance
    FROM (
      SELECT SUM(CAST(COALESCE(inv.총중량, 0) AS NUMERIC)) AS snapshot_weight
      FROM (
        SELECT 품목코드, 창고코드, 재고수량, 중량, 총중량, imported_at
        FROM youngil_inventory_20251231
        WHERE DATE(imported_at) = DATE('2025-12-31')
        UNION ALL
        SELECT 품목코드, 창고코드, 재고수량, 중량, 총중량, imported_at
        FROM west_inventory_20251231
        WHERE DATE(imported_at) = DATE('2025-12-31')
        UNION ALL
        SELECT 품목코드, 창고코드, 재고수량, 중량, 총중량, imported_at
        FROM east_inventory_20251231
        WHERE DATE(imported_at) = DATE('2025-12-31')
      ) inv
      LEFT JOIN items i ON inv.품목코드 = i.품목코드
      WHERE i.품목그룹1코드 = 'MB'
    ) ms
    CROSS JOIN (
      SELECT SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) AS purchase_weight
      FROM purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      WHERE p.일자 IS NOT NULL
        AND p.일자 != ''
        AND substr(p.일자, 1, 4) = '2025'
        AND i.품목그룹1코드 = 'MB'
        ${sqlAndPurchaseExcludeMeetingCounterpartyCodes('p')}
    ) mp
    CROSS JOIN (
      SELECT SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) AS sales_weight
      FROM (
        SELECT 일자, 품목코드, 중량 FROM sales
        UNION ALL
        SELECT 일자, 품목코드, 중량 FROM east_division_sales
        UNION ALL
        SELECT 일자, 품목코드, 중량 FROM west_division_sales
      ) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE s.일자 IS NOT NULL
        AND s.일자 != ''
        AND substr(s.일자, 1, 4) = '2025'
        AND i.품목그룹1코드 = 'MB'
    ) mx
  `;

  const result = await executeSQL(query);
  const rows = result?.rows ?? result;
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
