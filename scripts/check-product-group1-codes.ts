import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== All 품목그룹1코드 values ===');
  const allGroup1 = await executeSQL(`
    SELECT DISTINCT 품목그룹1코드, COUNT(*) as product_count
    FROM items
    WHERE 품목그룹1코드 IS NOT NULL
    GROUP BY 품목그룹1코드
    ORDER BY product_count DESC
  `);
  console.log(allGroup1?.rows);

  console.log('\n=== Sales volume by 품목그룹1코드 ===');
  const salesByGroup1 = await executeSQL(`
    SELECT
      i.품목그룹1코드,
      COUNT(s.id) as transaction_count,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
    FROM sales s
    JOIN items i ON s.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 IS NOT NULL
    GROUP BY i.품목그룹1코드
    ORDER BY total_weight DESC
  `);
  console.log(salesByGroup1?.rows);

  console.log('\n=== Sample products for each major group ===');
  const samples = await executeSQL(`
    SELECT
      품목그룹1코드,
      품목코드,
      품목명
    FROM items
    WHERE 품목그룹1코드 IN ('MB', 'AVI', 'PVL', 'CVL', 'IL', 'MAR', 'FU', 'SH', 'GS', 'CA', 'BL', 'AA', 'AL')
    GROUP BY 품목그룹1코드
    HAVING 품목코드 = MIN(품목코드)
    ORDER BY 품목그룹1코드
  `);
  console.log(samples?.rows);

  console.log('\n=== Check what AUTO means ===');
  const autoProducts = await executeSQL(`
    SELECT
      품목그룹1코드,
      품목코드,
      품목명,
      품목그룹2코드,
      품목그룹3코드
    FROM items
    WHERE 품목그룹1코드 = 'AUTO'
    LIMIT 10
  `);
  console.log(autoProducts?.rows);

  console.log('\n=== Breakdown: Mobil vs Other brands ===');
  const breakdown = await executeSQL(`
    SELECT
      CASE
        WHEN 품목그룹1코드 IN ('PVL', 'CVL', 'IL', 'MB', 'AVI', 'MAR') THEN 'Mobil'
        WHEN 품목그룹1코드 IN ('FU', 'SH', 'GS', 'CA', 'BL') THEN 'Other Brands'
        ELSE 'Accessories/Other'
      END as category,
      COUNT(*) as product_count
    FROM items
    WHERE 품목그룹1코드 IS NOT NULL
    GROUP BY category
    ORDER BY product_count DESC
  `);
  console.log(breakdown?.rows);

  console.log('\n=== All brand codes (for "etc") ===');
  const brands = await executeSQL(`
    SELECT
      품목그룹1코드,
      COUNT(*) as count,
      GROUP_CONCAT(DISTINCT SUBSTR(품목명, 1, 30), ' | ') as sample_names
    FROM items
    WHERE 품목그룹1코드 NOT IN ('PVL', 'CVL', 'IL', 'MB')
      AND 품목그룹1코드 IS NOT NULL
    GROUP BY 품목그룹1코드
    ORDER BY count DESC
  `);
  console.log(JSON.stringify(brands?.rows, null, 2));
}

main().catch(console.error);
