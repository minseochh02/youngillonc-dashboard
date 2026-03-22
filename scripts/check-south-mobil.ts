
import { executeSQL } from '../egdesk-helpers';

async function checkSouth() {
  try {
    const q = "SELECT COUNT(*) as count FROM south_division_sales WHERE substr(일자, 1, 7) = '2026-02'";
    const res = await executeSQL(q);
    console.log('South division sales Feb 2026 count:', res.rows[0].count);

    const q2 = `
      SELECT i.품목그룹1코드, COUNT(*) as count
      FROM south_division_sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
      GROUP BY 1
    `;
    const res2 = await executeSQL(q2);
    console.table(res2.rows);
  } catch (error) {
    console.error(error);
  }
}
checkSouth();
