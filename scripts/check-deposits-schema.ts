import { executeSQL } from '../egdesk-helpers';

async function checkDepositsSchema() {
  console.log('Checking deposits table structure...\n');

  // Get a sample row to see all columns
  const sample = await executeSQL("SELECT * FROM deposits LIMIT 1");

  console.log('Sample row:');
  console.log(JSON.stringify(sample.rows[0], null, 2));

  console.log('\nAll columns:', sample.columns);

  // Check if there's any date-like column
  const hasDateCol = sample.columns.some((col: string) =>
    col.includes('일자') || col.includes('날짜') || col.includes('date')
  );

  console.log('\nHas date column?', hasDateCol);
}

checkDepositsSchema().catch(console.error);
