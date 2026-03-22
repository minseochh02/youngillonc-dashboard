
import { executeSQL } from '../egdesk-helpers';

async function checkSouthMobilNames() {
  try {
    const q = `
      SELECT 
        SUM(CASE WHEN (품목명 LIKE '%Mobil%' OR 품목명 LIKE 'M SUP%' OR 품목명 LIKE 'Special Plus%') THEN 1 ELSE 0 END) as mobil_count,
        SUM(CASE WHEN (품목명 LIKE '%Mobil%' OR 품목명 LIKE 'M SUP%' OR 품목명 LIKE 'Special Plus%') THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as mobil_weight,
        COUNT(*) as total_count,
        SUM(CAST(REPLACE(중량, ',', '') AS NUMERIC)) as total_weight
      FROM south_division_sales
      WHERE substr(일자, 1, 7) = '2026-02'
    `;
    const res = await executeSQL(q);
    console.table(res.rows);
  } catch (error) {
    console.error(error);
  }
}
checkSouthMobilNames();
