import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== All AIOP products (제품군 = AIOP) ===');
  const aiopProducts = await executeSQL(`
    SELECT
      품목코드,
      품목명,
      품목그룹1코드,
      품목그룹2코드,
      품목그룹3코드,
      규격정보,
      제품군
    FROM items
    WHERE 제품군 = 'AIOP'
    ORDER BY 품목명
  `);
  console.log(JSON.stringify(aiopProducts?.rows, null, 2));

  console.log('\n=== Count of AIOP products ===');
  const count = await executeSQL(`
    SELECT COUNT(*) as total_aiop_products
    FROM items
    WHERE 제품군 = 'AIOP'
  `);
  console.log(count?.rows);

  console.log('\n=== AIOP product categories ===');
  const categories = await executeSQL(`
    SELECT
      품목그룹1코드,
      품목그룹2코드,
      품목그룹3코드,
      COUNT(*) as count
    FROM items
    WHERE 제품군 = 'AIOP'
    GROUP BY 품목그룹1코드, 품목그룹2코드, 품목그룹3코드
  `);
  console.log(categories?.rows);

  console.log('\n=== AIOP sales data - check units ===');
  const aiopSales = await executeSQL(`
    SELECT
      s.품목코드,
      i.품목명,
      s.단위,
      s.규격명,
      COUNT(*) as transaction_count,
      SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity,
      MIN(s.일자) as first_sale,
      MAX(s.일자) as last_sale
    FROM sales s
    JOIN items i ON s.품목코드 = i.품목코드
    WHERE i.제품군 = 'AIOP'
    GROUP BY s.품목코드, i.품목명, s.단위, s.규격명
    ORDER BY total_quantity DESC
  `);
  console.log(JSON.stringify(aiopSales?.rows, null, 2));

  console.log('\n=== Check if AIOP uses CTN (carton/box) packaging ===');
  const ctnPattern = await executeSQL(`
    SELECT
      품목코드,
      품목명,
      규격정보
    FROM items
    WHERE 제품군 = 'AIOP'
      AND 품목명 LIKE '%CTN%'
    LIMIT 10
  `);
  console.log(ctnPattern?.rows);

  console.log('\n=== Compare: Regular products vs AIOP products unit ===');
  const unitComparison = await executeSQL(`
    SELECT
      CASE WHEN 제품군 = 'AIOP' THEN 'AIOP' ELSE 'Regular' END as product_type,
      품목그룹1코드,
      COUNT(*) as product_count
    FROM items
    WHERE 품목그룹1코드 IN ('PVL', 'CVL', 'IL')
    GROUP BY product_type, 품목그룹1코드
    ORDER BY product_type, 품목그룹1코드
  `);
  console.log(unitComparison?.rows);
}

main().catch(console.error);
