
import { executeSQL } from '../egdesk-helpers';

async function sample() {
  try {
    const q = "SELECT 품목코드, 품목명, 규격명 FROM south_division_sales LIMIT 10";
    const res = await executeSQL(q);
    console.table(res.rows);
    
    const codes = res.rows.map((r: any) => `'${r.품목코드}'`).join(',');
    const q2 = `SELECT 품목코드, 품목명, 품목그룹1코드 FROM items WHERE 품목코드 IN (${codes})`;
    const res2 = await executeSQL(q2);
    console.log('Matches in items table:');
    console.table(res2.rows);
  } catch (error) {
    console.error(error);
  }
}
sample();
