import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Sales table columns ===');
  const schema = await executeSQL(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='sales'
  `);
  console.log(schema?.rows);

  console.log('\n=== Sample sales data with pricing info ===');
  const pricingSample = await executeSQL(`
    SELECT
      일자,
      거래처코드,
      품목코드,
      수량,
      중량,
      단가,
      공급가액,
      부가세,
      합계,
      적요,
      적요2
    FROM sales
    WHERE CAST(REPLACE(수량, ',', '') AS NUMERIC) > 0
    LIMIT 20
  `);
  console.log(JSON.stringify(pricingSample?.rows, null, 2));

  console.log('\n=== Check for discount/rebate keywords in 적요 fields ===');
  const rebateKeywords = await executeSQL(`
    SELECT
      적요,
      적요2,
      COUNT(*) as count
    FROM sales
    WHERE 적요 LIKE '%리베이트%'
       OR 적요 LIKE '%할인%'
       OR 적요 LIKE '%rebate%'
       OR 적요 LIKE '%discount%'
       OR 적요 LIKE '%MPP%'
       OR 적요2 LIKE '%리베이트%'
       OR 적요2 LIKE '%할인%'
       OR 적요2 LIKE '%rebate%'
       OR 적요2 LIKE '%discount%'
       OR 적요2 LIKE '%MPP%'
    GROUP BY 적요, 적요2
    LIMIT 20
  `);
  console.log(rebateKeywords?.rows);

  console.log('\n=== Check for negative amounts (returns/adjustments) ===');
  const negativeTransactions = await executeSQL(`
    SELECT
      일자,
      거래처코드,
      품목코드,
      수량,
      단가,
      공급가액,
      합계,
      적요,
      적요2
    FROM sales
    WHERE CAST(REPLACE(공급가액, ',', '') AS NUMERIC) < 0
       OR CAST(REPLACE(합계, ',', '') AS NUMERIC) < 0
    LIMIT 20
  `);
  console.log(JSON.stringify(negativeTransactions?.rows, null, 2));

  console.log('\n=== Calculate unit price from 공급가액/수량 vs 단가 ===');
  const priceComparison = await executeSQL(`
    SELECT
      품목코드,
      수량,
      단가,
      공급가액,
      CAST(REPLACE(수량, ',', '') AS NUMERIC) as 수량_num,
      CAST(REPLACE(단가, ',', '') AS NUMERIC) as 단가_num,
      CAST(REPLACE(공급가액, ',', '') AS NUMERIC) as 공급가액_num,
      CASE
        WHEN CAST(REPLACE(수량, ',', '') AS NUMERIC) > 0
        THEN CAST(REPLACE(공급가액, ',', '') AS NUMERIC) / CAST(REPLACE(수량, ',', '') AS NUMERIC)
        ELSE 0
      END as calculated_unit_price
    FROM sales
    WHERE CAST(REPLACE(수량, ',', '') AS NUMERIC) > 0
    LIMIT 20
  `);
  console.log(priceComparison?.rows);

  console.log('\n=== Check if there are other tables with rebate/discount info ===');
  const allTables = await executeSQL(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
  `);
  console.log(allTables?.rows);

  console.log('\n=== Sample 적요 values to understand patterns ===');
  const remarksPatterns = await executeSQL(`
    SELECT DISTINCT 적요, COUNT(*) as count
    FROM sales
    WHERE 적요 IS NOT NULL AND 적요 != ''
    GROUP BY 적요
    ORDER BY count DESC
    LIMIT 30
  `);
  console.log(remarksPatterns?.rows);

  console.log('\n=== Check same product sold to different clients - price variance ===');
  const priceVariance = await executeSQL(`
    SELECT
      품목코드,
      거래처코드,
      COUNT(*) as transaction_count,
      AVG(CAST(REPLACE(단가, ',', '') AS NUMERIC)) as avg_unit_price,
      MIN(CAST(REPLACE(단가, ',', '') AS NUMERIC)) as min_unit_price,
      MAX(CAST(REPLACE(단가, ',', '') AS NUMERIC)) as max_unit_price
    FROM sales
    WHERE 품목코드 = '144255'  -- AIOP product
      AND CAST(REPLACE(수량, ',', '') AS NUMERIC) > 0
    GROUP BY 품목코드, 거래처코드
    ORDER BY transaction_count DESC
    LIMIT 10
  `);
  console.log(priceVariance?.rows);
}

main().catch(console.error);
