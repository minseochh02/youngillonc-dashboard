
import { executeSQL } from './egdesk-helpers';

async function main() {
  try {
    console.log('Fetching first 10 rows from ledger to check format...');
    const result = await executeSQL('SELECT * FROM ledger LIMIT 10');
    console.log('Result:', JSON.stringify(result, null, 2));

    console.log('\nSearching for invalid date rows in ledger...');
    // Finding rows where '일자' doesn't match YYYY-MM-DD pattern
    // In SQLite GLOB, [0-9] works for digits.
    const invalidQuery = `
      SELECT * FROM ledger 
      WHERE 일자 NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      OR 일자 IS NULL
    `;
    const invalidRows = await executeSQL(invalidQuery);
    console.log('Invalid Rows Found:', JSON.stringify(invalidRows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
