import { executeSQL } from './egdesk-helpers';

async function checkSchema() {
  try {
    const res = await executeSQL('PRAGMA table_info(ledger)');
    console.log('Ledger Schema:', JSON.stringify(res, null, 2));
    
    const sample = await executeSQL('SELECT * FROM ledger LIMIT 1');
    console.log('Sample Row:', JSON.stringify(sample, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

checkSchema();
