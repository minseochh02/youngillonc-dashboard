import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';
import { combinedInventoryUnionSql } from '../src/lib/inventory-snapshot-combined';

async function main() {
  const query = `
    SELECT
      'Total' as type,
      SUM(CAST(COALESCE(inv.총중량, 0) AS NUMERIC)) as snapshot_weight
    FROM (${combinedInventoryUnionSql()}) inv
    LEFT JOIN items i ON inv.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 = 'IL'

    UNION ALL

    SELECT
      'Warehouse Filtered' as type,
      SUM(CAST(COALESCE(inv.총중량, 0) AS NUMERIC)) as snapshot_weight
    FROM (${combinedInventoryUnionSql()}) inv
    LEFT JOIN items i ON inv.품목코드 = i.품목코드
    LEFT JOIN warehouses w ON inv.창고코드 = w.창고코드 OR CAST(inv.창고코드 AS TEXT) = CAST(w.창고코드 AS TEXT)
    WHERE i.품목그룹1코드 = 'IL'
      AND (w.창고명 LIKE '%사업소%' OR w.창고명 LIKE '%지사%' OR w.창고명 = 'MB' OR w.창고명 LIKE '%화성%' OR w.창고명 LIKE '%창원%' OR w.창고명 LIKE '%남부%' OR w.창고명 LIKE '%중부%' OR w.창고명 LIKE '%서부%' OR w.창고명 LIKE '%동부%' OR w.창고명 LIKE '%제주%' OR w.창고명 LIKE '%부산%')
  `;

  console.log('Checking warehouse filter impact on IL snapshot baseline...');
  const result = await executeSQL(query);
  const rows = result?.rows || [];
  console.table(rows);
}

main().catch(console.error);
