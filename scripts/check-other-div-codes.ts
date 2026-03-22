
import { executeSQL } from '../egdesk-helpers';

async function checkOtherDivisions() {
  try {
    const q = `
      SELECT 
        'east' as division,
        SUM(CASE WHEN i.품목그룹1코드 IS NULL THEN 1 ELSE 0 END) as null_codes,
        COUNT(*) as total
      FROM east_division_sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
      UNION ALL
      SELECT 
        'west' as division,
        SUM(CASE WHEN i.품목그룹1코드 IS NULL THEN 1 ELSE 0 END) as null_codes,
        COUNT(*) as total
      FROM west_division_sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
    `;
    const res = await executeSQL(q);
    console.table(res.rows);
  } catch (error) {
    console.error(error);
  }
}
checkOtherDivisions();
