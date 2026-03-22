
import { executeSQL } from '../egdesk-helpers';

async function fetchFebruaryMobilWeightAll() {
  try {
    const targetMonth = '2026-02';
    const mobilCodes = ["'IL'", "'PVL'", "'CVL'", "'MB'"].join(',');
    
    console.log(`Fetching Mobil total 중량 for ${targetMonth} (INCLUDING all employees)...`);
    
    const tables = [
      { name: 'sales', joinCol: '담당자코드', joinTo: 'e.사원_담당_코드' },
      { name: 'east_division_sales', joinCol: '담당자코드', joinTo: 'e.사원_담당_코드' },
      { name: 'west_division_sales', joinCol: '담당자코드', joinTo: 'e.사원_담당_코드' },
      { name: 'south_division_sales', joinCol: '담당자명', joinTo: 'e.사원_담당_명', nameFallback: true }
    ];

    let grandTotal = 0;
    const results = [];

    for (const table of tables) {
      console.log(`Querying ${table.name}...`);
      
      let filter = `i.품목그룹1코드 IN (${mobilCodes})`;
      if (table.nameFallback) {
        filter = `(i.품목그룹1코드 IN (${mobilCodes}) OR (i.품목그룹1코드 IS NULL AND (s.품목명 LIKE '%Mobil%' OR s.품목명 LIKE 'M SUP%' OR s.품목명 LIKE 'Special Plus%')))`;
      }

      const q = `
        SELECT 
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
        FROM ${table.name} s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE substr(s.일자, 1, 7) = '${targetMonth}'
          AND ${filter}
      `;
      
      const res = await executeSQL(q);
      const weight = Number(res.rows[0].total_weight) || 0;
      results.push({ table_name: table.name, total_weight: weight });
      grandTotal += weight;
    }

    console.log(`\n--- Mobil Weight Breakdown by Table (${targetMonth}, including all employees) ---`);
    console.table(results);
    console.log(`\nGrand Total Mobil Weight for February 2026: ${grandTotal.toLocaleString()} L`);

  } catch (error) {
    console.error('Error fetching Mobil weight:', error);
  }
}

fetchFebruaryMobilWeightAll();
