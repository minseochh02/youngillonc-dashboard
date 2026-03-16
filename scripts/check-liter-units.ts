import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== All unique 단위 values in sales ===');
  const allUnits = await executeSQL(`
    SELECT DISTINCT 단위, COUNT(*) as count
    FROM sales
    WHERE 단위 IS NOT NULL
    GROUP BY 단위
    ORDER BY count DESC
  `);
  console.log(allUnits?.rows);

  console.log('\n=== Sample sales with unit = "L" (liter) ===');
  const literSales = await executeSQL(`
    SELECT
      s.품목코드,
      i.품목명,
      s.단위,
      s.규격명,
      s.수량,
      s.중량,
      CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as 수량_numeric,
      CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as 중량_numeric
    FROM sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE s.단위 = 'L'
    LIMIT 20
  `);
  console.log(JSON.stringify(literSales?.rows, null, 2));

  console.log('\n=== Check relationship between 수량 and 중량 for different units ===');
  const relationship = await executeSQL(`
    SELECT
      단위,
      수량,
      중량,
      CAST(REPLACE(수량, ',', '') AS NUMERIC) as 수량_num,
      CAST(REPLACE(중량, ',', '') AS NUMERIC) as 중량_num,
      CASE
        WHEN CAST(REPLACE(중량, ',', '') AS NUMERIC) > 0
        THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) / CAST(REPLACE(수량, ',', '') AS NUMERIC)
        ELSE 0
      END as ratio_중량_per_수량
    FROM sales
    WHERE 단위 IN ('L', 'Drum', 'box')
      AND CAST(REPLACE(수량, ',', '') AS NUMERIC) > 0
    LIMIT 30
  `);
  console.log(JSON.stringify(relationship?.rows, null, 2));

  console.log('\n=== Check: For Drum units, is 중량 = 수량 * 200? ===');
  const drumCheck = await executeSQL(`
    SELECT
      품목코드,
      단위,
      수량,
      중량,
      CAST(REPLACE(수량, ',', '') AS NUMERIC) as 수량_num,
      CAST(REPLACE(중량, ',', '') AS NUMERIC) as 중량_num,
      CAST(REPLACE(수량, ',', '') AS NUMERIC) * 200 as expected_중량,
      CASE
        WHEN CAST(REPLACE(중량, ',', '') AS NUMERIC) = CAST(REPLACE(수량, ',', '') AS NUMERIC) * 200
        THEN 'MATCH'
        ELSE 'NO MATCH'
      END as check_result
    FROM sales
    WHERE 단위 = 'Drum'
      AND CAST(REPLACE(수량, ',', '') AS NUMERIC) > 0
    LIMIT 20
  `);
  console.log(drumCheck?.rows);

  console.log('\n=== Check: For box units (AIOP), what is the ratio? ===');
  const boxCheck = await executeSQL(`
    SELECT
      s.품목코드,
      i.품목명,
      s.단위,
      s.수량,
      s.중량,
      i.규격정보,
      CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as 수량_num,
      CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as 중량_num,
      CASE
        WHEN CAST(REPLACE(s.수량, ',', '') AS NUMERIC) > 0
        THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) / CAST(REPLACE(s.수량, ',', '') AS NUMERIC)
        ELSE 0
      END as liters_per_box
    FROM sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE s.단위 IN ('box', 'Box')
      AND CAST(REPLACE(s.수량, ',', '') AS NUMERIC) > 0
      AND i.제품군 = 'AIOP'
    LIMIT 20
  `);
  console.log(boxCheck?.rows);
}

main().catch(console.error);
