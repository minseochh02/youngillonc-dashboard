import { executeSQL } from '../egdesk-helpers';

async function check() {
  // Check if Feb 7 exists
  const feb7 = await executeSQL("SELECT COUNT(*) as count FROM sales WHERE 일자 = '2026-02-07'");
  console.log('Feb 7, 2026 sales count:', feb7.rows[0].count);

  // Check what dates exist in Feb
  const dates = await executeSQL("SELECT DISTINCT 일자 FROM sales WHERE 일자 LIKE '2026-02%' ORDER BY 일자 LIMIT 20");
  console.log('\nFeb 2026 dates:', dates.rows.map((r: any) => r.일자));
}

check().catch(console.error);
