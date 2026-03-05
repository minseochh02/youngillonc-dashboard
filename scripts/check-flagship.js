const { executeSQL } = require('../egdesk-helpers.ts');

async function checkFlagship() {
  const date = '2025-11-01';
  const startDate = '2025-11-01';

  const flagshipQuery = `
    SELECT
      SUM(CASE WHEN type = 'sales' AND 일자 = '${date}' THEN volume ELSE 0 END) as salesToday,
      SUM(CASE WHEN type = 'purchase' AND 일자 = '${date}' THEN volume ELSE 0 END) as purchaseToday,
      SUM(CASE WHEN type = 'sales' THEN volume ELSE 0 END) as salesMTD,
      SUM(CASE WHEN type = 'purchase' THEN volume ELSE 0 END) as purchaseMTD
    FROM (
      SELECT CAST(REPLACE(중량, ',', '') AS NUMERIC) as volume, 'sales' as type, 일자, 판매처명, 품목그룹3코드, 창고명
      FROM sales
      WHERE 일자 >= '${startDate}' AND 일자 <= '${date}'
        AND 품목그룹3코드 = 'FLA'
        AND (창고명 = '창원' OR 판매처명 = '테크젠 주식회사')
      UNION ALL
      SELECT CAST(REPLACE(중량, ',', '') AS NUMERIC) as volume, 'purchase' as type, 일자, 구매처명 as 판매처명, 품목그룹3코드, 창고명
      FROM purchases
      WHERE 일자 >= '${startDate}' AND 일자 <= '${date}'
        AND 품목그룹3코드 = 'FLA'
        AND 창고명 LIKE '%창원%'
    )
  `;

  console.log('Query:', flagshipQuery);
  console.log('\n');

  const result = await executeSQL(flagshipQuery);
  console.log('Flagship Results:', JSON.stringify(result, null, 2));

  // Also check raw sales data
  const rawSalesQuery = `
    SELECT 일자, 판매처명, 품목명, 품목그룹3코드, 중량, 창고명
    FROM sales
    WHERE 일자 = '${date}'
      AND 품목그룹3코드 = 'FLA'
      AND (창고명 = '창원' OR 판매처명 = '테크젠 주식회사')
    ORDER BY 중량 DESC
  `;

  const rawSales = await executeSQL(rawSalesQuery);
  console.log('\nRaw Flagship Sales on Nov 1:', JSON.stringify(rawSales, null, 2));
}

checkFlagship().catch(console.error);
