import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Purchases table full schema ===');
  const schema = await executeSQL(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='purchases'
  `);
  console.log(schema?.rows);

  console.log('\n=== All column names in purchases ===');
  const columns = await executeSQL(`
    SELECT * FROM purchases LIMIT 1
  `);
  if (columns?.rows?.[0]) {
    console.log('Columns:', Object.keys(columns.rows[0]));
  }

  console.log('\n=== Sample purchases with all fields ===');
  const fullSample = await executeSQL(`
    SELECT *
    FROM purchases
    WHERE CAST(REPLACE(수량, ',', '') AS NUMERIC) > 0
    LIMIT 5
  `);
  console.log(JSON.stringify(fullSample?.rows, null, 2));

  console.log('\n=== Check 적요 fields for rebate/discount info ===');
  const remarks = await executeSQL(`
    SELECT DISTINCT 적요, 적요1, 적요2, COUNT(*) as count
    FROM purchases
    WHERE 적요 IS NOT NULL OR 적요1 IS NOT NULL OR 적요2 IS NOT NULL
    GROUP BY 적요, 적요1, 적요2
    ORDER BY count DESC
    LIMIT 30
  `);
  console.log(remarks?.rows);

  console.log('\n=== Look for "DSP" or "ASP" keywords ===');
  const dspAsp = await executeSQL(`
    SELECT *
    FROM purchases
    WHERE 적요 LIKE '%DSP%'
       OR 적요 LIKE '%ASP%'
       OR 적요1 LIKE '%DSP%'
       OR 적요1 LIKE '%ASP%'
       OR 적요2 LIKE '%DSP%'
       OR 적요2 LIKE '%ASP%'
       OR 품목명 LIKE '%DSP%'
       OR 품목명 LIKE '%ASP%'
    LIMIT 20
  `);
  console.log(dspAsp?.rows);

  console.log('\n=== Check for price adjustment entries ===');
  const adjustments = await executeSQL(`
    SELECT *
    FROM purchases
    WHERE 적요 LIKE '%조정%'
       OR 적요 LIKE '%정정%'
       OR 적요 LIKE '%할인%'
       OR 적요 LIKE '%리베이트%'
       OR 적요1 LIKE '%조정%'
       OR 적요1 LIKE '%정정%'
       OR 적요1 LIKE '%할인%'
       OR 적요1 LIKE '%리베이트%'
    LIMIT 20
  `);
  console.log(adjustments?.rows);

  console.log('\n=== Check for negative purchase amounts (rebates?) ===');
  const negative = await executeSQL(`
    SELECT
      일자,
      구매처명,
      품목코드,
      품목명,
      수량,
      단가,
      공급가액,
      합_계,
      적요,
      적요1,
      적요2
    FROM purchases
    WHERE CAST(REPLACE(공급가액, ',', '') AS NUMERIC) < 0
    LIMIT 20
  `);
  console.log(JSON.stringify(negative?.rows, null, 2));

  console.log('\n=== Check purchases from Mobil Korea specifically ===');
  const mobilPurchases = await executeSQL(`
    SELECT
      일자,
      구매처명,
      품목코드,
      품목명,
      수량,
      단가,
      공급가액,
      적요,
      적요1,
      적요2
    FROM purchases
    WHERE 구매처명 LIKE '%모빌%'
      AND CAST(REPLACE(수량, ',', '') AS NUMERIC) > 0
    ORDER BY 일자 DESC
    LIMIT 20
  `);
  console.log(JSON.stringify(mobilPurchases?.rows, null, 2));
}

main().catch(console.error);
