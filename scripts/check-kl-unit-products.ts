import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Check sales with unit = KL ===');
  const klSales = await executeSQL(`
    SELECT
      s.품목코드,
      i.품목명,
      s.단위,
      s.규격명,
      s.수량,
      s.중량,
      s.일자,
      CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as 수량_numeric,
      CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as 중량_numeric
    FROM sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE s.단위 = 'KL' OR s.단위 = 'kl' OR s.단위 = 'Kl'
    LIMIT 30
  `);
  console.log(JSON.stringify(klSales?.rows, null, 2));

  console.log('\n=== Summary: 수량 vs 중량 for KL units ===');
  const summary = await executeSQL(`
    SELECT
      s.단위,
      COUNT(*) as transaction_count,
      SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_수량,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_중량,
      AVG(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as avg_수량,
      AVG(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as avg_중량
    FROM sales s
    WHERE s.단위 LIKE '%KL%' OR s.단위 LIKE '%kl%'
    GROUP BY s.단위
  `);
  console.log(summary?.rows);

  console.log('\n=== Check distinct 단위 values that might be KL-related ===');
  const units = await executeSQL(`
    SELECT DISTINCT 단위, COUNT(*) as count
    FROM sales
    WHERE 단위 LIKE '%K%' OR 단위 LIKE '%k%'
    GROUP BY 단위
    ORDER BY count DESC
  `);
  console.log(units?.rows);

  console.log('\n=== Sample comparison: Products with different units ===');
  const comparison = await executeSQL(`
    SELECT
      단위,
      COUNT(*) as count,
      MIN(CAST(REPLACE(수량, ',', '') AS NUMERIC)) as min_수량,
      MAX(CAST(REPLACE(수량, ',', '') AS NUMERIC)) as max_수량,
      MIN(CAST(REPLACE(중량, ',', '') AS NUMERIC)) as min_중량,
      MAX(CAST(REPLACE(중량, ',', '') AS NUMERIC)) as max_중량
    FROM sales
    WHERE 단위 IN ('L', 'KL', 'Drum', 'box', 'ea')
    GROUP BY 단위
    ORDER BY 단위
  `);
  console.log(comparison?.rows);

  console.log('\n=== Check if 수량 and 중량 are the same for KL units ===');
  const klComparison = await executeSQL(`
    SELECT
      품목코드,
      단위,
      수량,
      중량,
      CASE
        WHEN CAST(REPLACE(수량, ',', '') AS NUMERIC) = CAST(REPLACE(중량, ',', '') AS NUMERIC)
        THEN 'SAME'
        ELSE 'DIFFERENT'
      END as comparison
    FROM sales
    WHERE 단위 = 'KL'
    LIMIT 20
  `);
  console.log(klComparison?.rows);

  console.log('\n=== Check products table for KL items ===');
  const klItems = await executeSQL(`
    SELECT
      품목코드,
      품목명,
      품목그룹1코드,
      규격정보
    FROM items
    WHERE 품목명 LIKE '%KL%'
       OR 규격정보 LIKE '%KL%'
    LIMIT 20
  `);
  console.log(klItems?.rows);
}

main().catch(console.error);
