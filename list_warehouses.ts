import { executeSQL } from './egdesk-helpers';
async function run() {
  const result = await executeSQL("SELECT DISTINCT 창고명 FROM warehouses");
  console.log('Warehouse names:', JSON.stringify(result.rows, null, 2));
}
run();
