import { executeSQL } from '../egdesk-helpers';

async function testDailyInventoryQuery() {
  const date = '2026-02-26';

  console.log('🔍 Testing Daily Inventory Query for date:', date);
  console.log('');

  try {
    // Test 1: Check raw data from each source
    console.log('=== TEST 1: Raw Data Counts ===');

    const inventoryCount = await executeSQL(`
      SELECT COUNT(*) as count FROM inventory
      WHERE (창고명 LIKE '%사업소%' OR 창고명 LIKE '%지사%' OR 창고명 = 'MB' OR 창고명 LIKE '%화성%' OR 창고명 LIKE '%창원%')
    `);
    console.log('Inventory rows:', inventoryCount.rows[0].count);

    const salesCount = await executeSQL(`
      SELECT COUNT(*) as count FROM sales
      WHERE 일자 = '${date}'
        AND (거래처그룹1코드명 LIKE '%사업소%' OR 거래처그룹1코드명 LIKE '%지사%' OR 거래처그룹1코드명 = 'MB')
    `);
    console.log('Sales rows for ${date}:', salesCount.rows[0].count);

    const purchasesCount = await executeSQL(`
      SELECT COUNT(*) as count FROM purchases
      WHERE 일자 = '${date}'
        AND (거래처그룹1명 LIKE '%사업소%' OR 거래처그룹1명 LIKE '%지사%' OR 거래처그룹1명 = 'MB')
    `);
    console.log('Purchases rows for ${date}:', purchasesCount.rows[0].count);

    const transfersCount = await executeSQL(`
      SELECT COUNT(*) as count FROM inventory_transfers
      WHERE (월_일 = '${date}' OR 월_일 = SUBSTR('${date}', 6, 5) OR 월_일 = REPLACE(SUBSTR('${date}', 6, 5), '-', '/'))
    `);
    console.log('Transfers rows for ${date}:', transfersCount.rows[0].count);

    console.log('');

    // Test 2: Sample branch names from each source
    console.log('=== TEST 2: Sample Branch Names ===');

    const invBranches = await executeSQL(`
      SELECT DISTINCT 창고명 FROM inventory LIMIT 10
    `);
    console.log('Sample inventory 창고명:', invBranches.rows.map(r => r.창고명).join(', '));

    const salesBranches = await executeSQL(`
      SELECT DISTINCT 거래처그룹1코드명 FROM sales WHERE 일자 = '${date}' LIMIT 10
    `);
    console.log('Sample sales 거래처그룹1코드명:', salesBranches.rows.map(r => r.거래처그룹1코드명).join(', '));

    const purchasesBranches = await executeSQL(`
      SELECT DISTINCT 거래처그룹1명 FROM purchases WHERE 일자 = '${date}' LIMIT 10
    `);
    console.log('Sample purchases 거래처그룹1명:', purchasesBranches.rows.map(r => r.거래처그룹1명).join(', '));

    console.log('');

    // Test 3: Run the actual query (simplified)
    console.log('=== TEST 3: Simplified Union Query ===');

    const branchCase = (column: string) => `
      CASE
        WHEN ${column} = 'MB' THEN 'MB'
        WHEN ${column} LIKE '%화성%' THEN '화성'
        WHEN ${column} LIKE '%창원%' THEN '창원'
        WHEN ${column} LIKE '%남부%' THEN '남부'
        WHEN ${column} LIKE '%중부%' THEN '중부'
        WHEN ${column} LIKE '%서부%' THEN '서부'
        WHEN ${column} LIKE '%동부%' THEN '동부'
        WHEN ${column} LIKE '%제주%' THEN '제주'
        WHEN ${column} LIKE '%부산%' THEN '부산'
        ELSE REPLACE(REPLACE(REPLACE(REPLACE(${column}, '사업소', ''), '지사', ''), '본사', ''), ' ', '')
      END
    `;

    const unionQuery = `
      SELECT
        branch,
        품목코드,
        SUM(inv_qty) as inventory,
        SUM(sales_qty) as sales,
        SUM(purchase_qty) as purchase,
        SUM(transfer_qty) as transfer
      FROM (
        SELECT
          ${branchCase('창고명')} as branch,
          품목코드,
          CAST(REPLACE(재고수량, ',', '') AS NUMERIC) as inv_qty,
          0 as sales_qty,
          0 as purchase_qty,
          0 as transfer_qty
        FROM inventory
        WHERE (창고명 LIKE '%사업소%' OR 창고명 LIKE '%지사%' OR 창고명 = 'MB' OR 창고명 LIKE '%화성%' OR 창고명 LIKE '%창원%')

        UNION ALL

        SELECT
          ${branchCase('거래처그룹1코드명')} as branch,
          품목코드,
          0 as inv_qty,
          CAST(REPLACE(수량, ',', '') AS NUMERIC) as sales_qty,
          0 as purchase_qty,
          0 as transfer_qty
        FROM sales
        WHERE 일자 = '${date}'
          AND (거래처그룹1코드명 LIKE '%사업소%' OR 거래처그룹1코드명 LIKE '%지사%' OR 거래처그룹1코드명 = 'MB')

        UNION ALL

        SELECT
          ${branchCase('거래처그룹1명')} as branch,
          품목코드,
          0 as inv_qty,
          0 as sales_qty,
          CAST(REPLACE(수량, ',', '') AS NUMERIC) as purchase_qty,
          0 as transfer_qty
        FROM purchases
        WHERE 일자 = '${date}'
          AND (거래처그룹1명 LIKE '%사업소%' OR 거래처그룹1명 LIKE '%지사%' OR 거래처그룹1명 = 'MB')
      ) r
      GROUP BY branch, 품목코드
      LIMIT 10
    `;

    const unionResult = await executeSQL(unionQuery);
    console.log('Union query returned', unionResult.rows.length, 'rows');
    if (unionResult.rows.length > 0) {
      console.table(unionResult.rows);
    }

    console.log('');

    // Test 4: Full query with product_mapping join
    console.log('=== TEST 4: Full Query with Product Mapping ===');

    const fullQuery = `
      SELECT
        branch,
        COALESCE(category, 'Others') as category,
        COALESCE(tier, 'Others') as tier,
        SUM(inv_qty) as inventory,
        SUM(sales_qty) as sales,
        SUM(purchase_qty) as purchase,
        SUM(transfer_qty) as transfer
      FROM (
        SELECT
          ${branchCase('창고명')} as branch,
          품목코드,
          CAST(REPLACE(재고수량, ',', '') AS NUMERIC) as inv_qty,
          0 as sales_qty,
          0 as purchase_qty,
          0 as transfer_qty
        FROM inventory
        WHERE (창고명 LIKE '%사업소%' OR 창고명 LIKE '%지사%' OR 창고명 = 'MB' OR 창고명 LIKE '%화성%' OR 창고명 LIKE '%창원%' OR 창고명 LIKE '%남부%' OR 창고명 LIKE '%중부%' OR 창고명 LIKE '%서부%' OR 창고명 LIKE '%동부%' OR 창고명 LIKE '%제주%' OR 창고명 LIKE '%부산%')

        UNION ALL

        SELECT
          ${branchCase('거래처그룹1코드명')} as branch,
          품목코드,
          0 as inv_qty,
          CAST(REPLACE(수량, ',', '') AS NUMERIC) as sales_qty,
          0 as purchase_qty,
          0 as transfer_qty
        FROM sales
        WHERE 일자 = '${date}'
          AND (거래처그룹1코드명 LIKE '%사업소%' OR 거래처그룹1코드명 LIKE '%지사%' OR 거래처그룹1코드명 = 'MB' OR 거래처그룹1코드명 LIKE '%화성%' OR 거래처그룹1코드명 LIKE '%창원%' OR 거래처그룹1코드명 LIKE '%남부%' OR 거래처그룹1코드명 LIKE '%중부%' OR 거래처그룹1코드명 LIKE '%서부%' OR 거래처그룹1코드명 LIKE '%동부%' OR 거래처그룹1코드명 LIKE '%제주%' OR 거래처그룹1코드명 LIKE '%부산%')

        UNION ALL

        SELECT
          ${branchCase('거래처그룹1명')} as branch,
          품목코드,
          0 as inv_qty,
          0 as sales_qty,
          CAST(REPLACE(수량, ',', '') AS NUMERIC) as purchase_qty,
          0 as transfer_qty
        FROM purchases
        WHERE 일자 = '${date}'
          AND (거래처그룹1명 LIKE '%사업소%' OR 거래처그룹1명 LIKE '%지사%' OR 거래처그룹1명 = 'MB' OR 거래처그룹1명 LIKE '%화성%' OR 거래처그룹1명 LIKE '%창원%' OR 거래처그룹1명 LIKE '%남부%' OR 거래처그룹1명 LIKE '%중부%' OR 거래처그룹1명 LIKE '%서부%' OR 거래처그룹1명 LIKE '%동부%' OR 거래처그룹1명 LIKE '%제주%' OR 거래처그룹1명 LIKE '%부산%')
      ) r
      LEFT JOIN (
        SELECT
          품목코드,
          CASE
            WHEN 품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
            WHEN 품목그룹1코드 = 'IL' THEN 'IL'
            WHEN 품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
            ELSE 'Others'
          END as category,
          CASE
            WHEN 품목그룹3코드 = 'FLA' THEN 'Flagship'
            ELSE 'Others'
          END as tier
        FROM product_mapping
      ) p ON r.품목코드 = p.품목코드
      GROUP BY 1, 2, 3
      LIMIT 20
    `;

    const fullResult = await executeSQL(fullQuery);
    console.log('Full query returned', fullResult.rows.length, 'rows');
    if (fullResult.rows.length > 0) {
      console.table(fullResult.rows);
    } else {
      console.log('❌ No rows returned from full query!');
    }

    console.log('\n✅ Query test complete');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

testDailyInventoryQuery()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
