import { executeSQL } from './egdesk-helpers';

async function main() {
  // Check for snapshots in the inventory table
  const snapshots = await executeSQL(`
    SELECT DISTINCT DATE(imported_at) as import_date, COUNT(*) as row_count
    FROM inventory
    GROUP BY import_date
    ORDER BY import_date DESC
  `);
  console.log('Available snapshots in inventory table:', JSON.stringify(snapshots.rows, null, 2));

  // Check baseline for Jan 31st for Auto Flagship
  const date = '2026-01-31';
  const baselineQuery = `
    SELECT 
      SUM(CAST(REPLACE(i.재고수량, ',', '') AS NUMERIC)) as total_qty
    FROM inventory i
    LEFT JOIN items p ON i.품목코드 = p.품목코드
    WHERE (i.창고명 LIKE '%사업소%' OR i.창고명 LIKE '%지사%' OR i.창고명 = 'MB' OR i.창고명 LIKE '%화성%' OR i.창고명 LIKE '%창원%' OR i.창고명 LIKE '%남부%' OR i.창고명 LIKE '%중부%' OR i.창고명 LIKE '%서부%' OR i.창고명 LIKE '%동부%' OR i.창고명 LIKE '%제주%' OR i.창고명 LIKE '%부산%')
      AND p.품목그룹1코드 IN ('PVL', 'CVL')
      AND p.품목그룹3코드 = 'FLA'
      AND i.imported_at = (
        SELECT MAX(imported_at) 
        FROM inventory 
        WHERE DATE(imported_at) <= '${date}'
      )
  `;

  const result = await executeSQL(baselineQuery);
  console.log('Auto Flagship Baseline on Jan 31st:', JSON.stringify(result.rows[0], null, 2));
}

main().catch(console.error);
