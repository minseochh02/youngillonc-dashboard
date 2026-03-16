import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Search for AIOP in items table (품목명) ===');
  const aiopItems = await executeSQL(`
    SELECT *
    FROM items
    WHERE 품목명 LIKE '%AIOP%'
       OR 품목명 LIKE '%aiop%'
       OR 품목명 LIKE '%A.I.O.P%'
    LIMIT 50
  `);
  console.log(JSON.stringify(aiopItems?.rows, null, 2));

  console.log('\n=== Search for AIOP in 품목그룹 codes ===');
  const aiopGroups = await executeSQL(`
    SELECT DISTINCT 품목그룹1코드, 품목그룹2코드, 품목그룹3코드, COUNT(*) as count
    FROM items
    WHERE 품목그룹1코드 LIKE '%AIOP%'
       OR 품목그룹2코드 LIKE '%AIOP%'
       OR 품목그룹3코드 LIKE '%AIOP%'
    GROUP BY 품목그룹1코드, 품목그룹2코드, 품목그룹3코드
  `);
  console.log(aiopGroups?.rows);

  console.log('\n=== Search for "box" or "박스" in items ===');
  const boxItems = await executeSQL(`
    SELECT
      품목코드,
      품목명,
      품목그룹1코드,
      품목그룹2코드,
      품목그룹3코드,
      단위,
      규격정보
    FROM items
    WHERE 품목명 LIKE '%박스%'
       OR 품목명 LIKE '%BOX%'
       OR 품목명 LIKE '%Box%'
       OR 단위 LIKE '%박스%'
       OR 단위 LIKE '%BOX%'
    LIMIT 30
  `);
  console.log(JSON.stringify(boxItems?.rows, null, 2));

  console.log('\n=== Check unique 단위 (unit) values in items ===');
  const units = await executeSQL(`
    SELECT DISTINCT 단위, COUNT(*) as count
    FROM items
    WHERE 단위 IS NOT NULL
    GROUP BY 단위
    ORDER BY count DESC
  `);
  console.log(units?.rows);

  console.log('\n=== Search in sales for AIOP pattern ===');
  const aiopSales = await executeSQL(`
    SELECT
      s.품목코드,
      i.품목명,
      s.단위,
      s.수량,
      s.중량,
      COUNT(*) as transaction_count
    FROM sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE i.품목명 LIKE '%AIOP%'
       OR i.품목명 LIKE '%aiop%'
    GROUP BY s.품목코드, i.품목명, s.단위, s.수량, s.중량
    LIMIT 20
  `);
  console.log(aiopSales?.rows);

  console.log('\n=== Check 제품군 field for AIOP ===');
  const productFamily = await executeSQL(`
    SELECT DISTINCT 제품군, COUNT(*) as count
    FROM items
    WHERE 제품군 IS NOT NULL
    GROUP BY 제품군
    ORDER BY count DESC
  `);
  console.log(productFamily?.rows);

  console.log('\n=== Search for AIOP in 제품군 ===');
  const aiopFamily = await executeSQL(`
    SELECT *
    FROM items
    WHERE 제품군 LIKE '%AIOP%'
       OR 제품군 LIKE '%aiop%'
    LIMIT 20
  `);
  console.log(aiopFamily?.rows);
}

main().catch(console.error);
