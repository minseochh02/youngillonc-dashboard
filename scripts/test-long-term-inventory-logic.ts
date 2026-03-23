import { executeSQL } from '../egdesk-helpers';

async function main() {
  const inactiveDays = 180;
  const today = new Date().toISOString().split('T')[0];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  console.log(`--- Testing Long-term Inventory Logic ---`);
  console.log(`Reference Date: ${today}`);
  console.log(`Inactive Cutoff: ${cutoffDateStr} (${inactiveDays} days ago)\n`);

  // 1. Inactive Items Analysis
  const inactiveItemsQuery = `
    SELECT 
      i.품목코드,
      i.품목명_규격_,
      SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) as current_inventory,
      MAX(last_sales.일자) as last_sold_date
    FROM inventory i
    LEFT JOIN (
      SELECT 품목코드, 일자 FROM sales
      UNION ALL SELECT 품목코드, 일자 FROM east_division_sales
      UNION ALL SELECT 품목코드, 일자 FROM west_division_sales
      UNION ALL SELECT 품목코드, 일자 FROM south_division_sales
    ) last_sales ON i.품목코드 = last_sales.품목코드
    WHERE i.imported_at = (SELECT MAX(imported_at) FROM inventory)
    GROUP BY i.품목코드, i.품목명_규격_
    HAVING last_sold_date IS NULL OR last_sold_date < '${cutoffDateStr}'
    ORDER BY current_inventory DESC
    LIMIT 10
  `;

  console.log(`[1] Top 10 Inactive Items (No sales for >${inactiveDays} days)`);
  const inactiveResult = await executeSQL(inactiveItemsQuery);
  console.table(inactiveResult.rows || []);

  // 2. Inventory Turnover Analysis
  const turnoverQuery = `
    SELECT 
      i.품목코드,
      i.품목명_규격_,
      SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) as current_inventory,
      COALESCE(sales_sum.qty, 0) as sales_qty_6m,
      CASE 
        WHEN SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL)) > 0 
        THEN COALESCE(sales_sum.qty, 0) / SUM(CAST(REPLACE(i.재고수량, ',', '') AS REAL))
        ELSE 0 
      END as turnover_ratio
    FROM inventory i
    LEFT JOIN (
      SELECT 품목코드, SUM(CAST(REPLACE(수량, ',', '') AS REAL)) as qty
      FROM (
        SELECT 품목코드, 수량, 일자 FROM sales
        UNION ALL SELECT 품목코드, 수량, 일자 FROM east_division_sales
        UNION ALL SELECT 품목코드, 수량, 일자 FROM west_division_sales
        UNION ALL SELECT 품목코드, 수량, 일자 FROM south_division_sales
      ) all_sales
      WHERE 일자 >= '${cutoffDateStr}'
      GROUP BY 품목코드
    ) sales_sum ON i.품목코드 = sales_sum.품목코드
    WHERE i.imported_at = (SELECT MAX(imported_at) FROM inventory)
    GROUP BY i.품목코드, i.품목명_규격_
    HAVING current_inventory > 0
    ORDER BY turnover_ratio ASC
    LIMIT 10
  `;

  console.log(`\n[2] Top 10 Low-Turnover Items (Turnover Ratio = Sales Qty / Current Stock)`);
  const turnoverResult = await executeSQL(turnoverQuery);
  console.table(turnoverResult.rows || []);
}

main().catch(console.error);
