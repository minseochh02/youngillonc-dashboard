import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Check 품목그룹3코드 (tier) values ===');
  const tier3 = await executeSQL(`
    SELECT DISTINCT 품목그룹3코드, COUNT(*) as count
    FROM items
    GROUP BY 품목그룹3코드
    ORDER BY count DESC
  `);
  console.log(tier3?.rows);

  console.log('\n=== Sample products for each tier ===');
  const samplesByTier = await executeSQL(`
    SELECT
      품목그룹3코드,
      품목코드,
      품목명,
      품목그룹1코드
    FROM items
    WHERE 품목그룹3코드 IN ('0', 'STA', 'PRE', 'FLA', 'ALL')
    ORDER BY 품목그룹3코드, 품목코드
    LIMIT 50
  `);
  console.log(JSON.stringify(samplesByTier?.rows, null, 2));

  console.log('\n=== Count products by 품목그룹3코드 for Mobil products (PVL, CVL, IL) ===');
  const mobilTiers = await executeSQL(`
    SELECT
      품목그룹3코드,
      품목그룹1코드,
      COUNT(*) as product_count
    FROM items
    WHERE 품목그룹1코드 IN ('PVL', 'CVL', 'IL', 'MB', 'AVI')
    GROUP BY 품목그룹3코드, 품목그룹1코드
    ORDER BY 품목그룹1코드, 품목그룹3코드
  `);
  console.log(mobilTiers?.rows);

  console.log('\n=== Check what products have 품목그룹3코드 = "0" or null ===');
  const zeroTier = await executeSQL(`
    SELECT
      품목코드,
      품목명,
      품목그룹1코드,
      품목그룹2코드,
      품목그룹3코드
    FROM items
    WHERE 품목그룹3코드 = '0' OR 품목그룹3코드 = 0
    LIMIT 20
  `);
  console.log(JSON.stringify(zeroTier?.rows, null, 2));

  console.log('\n=== Check for NULL 품목그룹3코드 ===');
  const nullTier = await executeSQL(`
    SELECT
      품목코드,
      품목명,
      품목그룹1코드,
      품목그룹2코드,
      품목그룹3코드
    FROM items
    WHERE 품목그룹3코드 IS NULL
    LIMIT 20
  `);
  console.log(nullTier?.rows);

  console.log('\n=== Sales volume by tier (for Mobil products) ===');
  const salesByTier = await executeSQL(`
    SELECT
      i.품목그룹3코드,
      i.품목그룹1코드,
      COUNT(s.id) as transaction_count,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
    FROM sales s
    JOIN items i ON s.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 IN ('PVL', 'CVL', 'IL', 'MB', 'AVI')
    GROUP BY i.품목그룹3코드, i.품목그룹1코드
    ORDER BY i.품목그룹1코드, total_weight DESC
  `);
  console.log(salesByTier?.rows);

  console.log('\n=== Check if "Alliance" exists ===');
  const alliance = await executeSQL(`
    SELECT *
    FROM items
    WHERE 품목그룹3코드 = 'ALL' OR 품목그룹3코드 LIKE '%Alliance%' OR 품목그룹3코드 LIKE '%alliance%'
    LIMIT 10
  `);
  console.log(alliance?.rows);
}

main().catch(console.error);
