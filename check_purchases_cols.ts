import { executeSQL } from './egdesk-helpers';
async function run() {
  const r = await executeSQL("SELECT * FROM purchases LIMIT 1");
  console.log('Purchases sample row:', r.rows[0]);
}
run();
