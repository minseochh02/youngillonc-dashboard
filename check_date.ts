import { executeSQL } from './egdesk-helpers';
async function run() {
  const r = await executeSQL("SELECT COUNT(*) as count FROM purchases WHERE 일자 = '2026-02-04'");
  console.log('Result for 2026-02-04:', r);
  const r2 = await executeSQL("SELECT COUNT(*) as count FROM purchases WHERE 일자 = '2026-02-03'");
  console.log('Result for 2026-02-03:', r2);
}
run();
