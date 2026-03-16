import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Check purchases table for cost data ===');
  const purchaseSchema = await executeSQL(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='purchases'
  `);
  console.log(purchaseSchema?.rows);

  console.log('\n=== Sample purchases data ===');
  const purchaseSample = await executeSQL(`
    SELECT
      일자,
      거래처코드,
      구매처명,
      품목코드,
      품목명,
      수량,
      중량,
      단가,
      공급가액,
      합_계
    FROM purchases
    WHERE CAST(REPLACE(수량, ',', '') AS NUMERIC) > 0
    LIMIT 10
  `);
  console.log(JSON.stringify(purchaseSample?.rows, null, 2));

  console.log('\n=== Compare: Same product purchase vs sale price ===');
  const priceComparison = await executeSQL(`
    SELECT
      'Purchase' as type,
      p.품목코드,
      p.품목명,
      p.일자,
      AVG(CAST(REPLACE(p.단가, ',', '') AS NUMERIC)) as avg_price
    FROM purchases p
    WHERE p.품목코드 = '144255'
      AND CAST(REPLACE(p.수량, ',', '') AS NUMERIC) > 0
    GROUP BY p.품목코드, p.품목명, p.일자

    UNION ALL

    SELECT
      'Sale' as type,
      s.품목코드,
      i.품목명,
      s.일자,
      AVG(s.단가) as avg_price
    FROM sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE s.품목코드 = '144255'
      AND CAST(REPLACE(s.수량, ',', '') AS NUMERIC) > 0
    GROUP BY s.품목코드, i.품목명, s.일자

    ORDER BY 일자, type
    LIMIT 20
  `);
  console.log(priceComparison?.rows);

  console.log('\n=== Check if purchases has 원가 or cost columns ===');
  const purchaseColumns = await executeSQL(`
    PRAGMA table_info(purchases)
  `);
  console.log(purchaseColumns?.rows);

  console.log('\n=== Check items table for standard cost ===');
  const itemsSchema = await executeSQL(`
    PRAGMA table_info(items)
  `);
  console.log(itemsSchema?.rows);

  console.log('\n=== Check ledger for cost entries ===');
  const costLedger = await executeSQL(`
    SELECT DISTINCT 계정명
    FROM ledger
    WHERE 계정명 LIKE '%원가%'
       OR 계정명 LIKE '%매출원가%'
       OR 계정명 LIKE '%cost%'
    LIMIT 20
  `);
  console.log(costLedger?.rows);
}

main().catch(console.error);
