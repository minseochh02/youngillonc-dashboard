
import { executeSQL } from '../egdesk-helpers';

async function fetchFebruaryMobilWeightFinal() {
  try {
    const targetMonth = '2026-02';
    const excludedEmployee = '김도량';
    const mobilCodes = ["'IL'", "'PVL'", "'CVL'", "'MB'"].join(',');
    
    console.log(`Fetching Mobil total 중량 for ${targetMonth} (excluding ${excludedEmployee})...`);
    console.log(`Mobil Codes: IL, PVL, CVL, MB`);
    
    // For South division, we add a name-based fallback because its product codes are missing/null
    const query = `
      SELECT 
        table_name,
        SUM(weight) as total_weight
      FROM (
        SELECT 
          'sales' as table_name,
          CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as weight,
          s.일자,
          e.사원_담당_명,
          i.품목그룹1코드,
          s.품목명
        FROM sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        
        UNION ALL
        
        SELECT 
          'east_division_sales' as table_name,
          CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as weight,
          s.일자,
          e.사원_담당_명,
          i.품목그룹1코드,
          s.품목명
        FROM east_division_sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        
        UNION ALL
        
        SELECT 
          'west_division_sales' as table_name,
          CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as weight,
          s.일자,
          e.사원_담당_명,
          i.품목그룹1코드,
          s.품목명
        FROM west_division_sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        
        UNION ALL
        
        SELECT 
          'south_division_sales' as table_name,
          CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as weight,
          s.일자,
          e.사원_담당_명,
          i.품목그룹1코드,
          s.품목명
        FROM south_division_sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자명 = e.사원_담당_명
      )
      WHERE substr(일자, 1, 7) = '${targetMonth}'
        AND (사원_담당_명 IS NULL OR 사원_담당_명 != '${excludedEmployee}')
        AND (
          품목그룹1코드 IN (${mobilCodes})
          OR (table_name = 'south_division_sales' AND (품목명 LIKE '%Mobil%' OR 품목명 LIKE 'M SUP%' OR 품목명 LIKE 'Special Plus%'))
        )
      GROUP BY table_name
    `;
    
    const result = await executeSQL(query);
    console.log(`\n--- Mobil Weight Breakdown by Table (${targetMonth}, excluding ${excludedEmployee}) ---`);
    console.table(result.rows);
    
    const grandTotal = result.rows.reduce((sum: number, row: any) => sum + (Number(row.total_weight) || 0), 0);
    console.log(`\nGrand Total Mobil Weight for February 2026: ${grandTotal.toLocaleString()} L`);

  } catch (error) {
    console.error('Error fetching Mobil weight:', error);
  }
}

fetchFebruaryMobilWeightFinal();
