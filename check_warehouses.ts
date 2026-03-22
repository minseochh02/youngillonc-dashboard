import { executeSQL } from './egdesk-helpers';

async function check() {
  try {
    const result = await executeSQL('SELECT * FROM warehouses LIMIT 5');
    console.log('Warehouses:', JSON.stringify(result, null, 2));
    
    const count = await executeSQL('SELECT COUNT(*) as count FROM purchases');
    console.log('Purchases count:', JSON.stringify(count, null, 2));
    
    const sample = await executeSQL('SELECT 창고코드 FROM purchases LIMIT 5');
    console.log('Purchases sample 창고코드:', JSON.stringify(sample, null, 2));
  } catch (e) {
    console.error(e);
  }
}

check();
