import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      SUM(target_weight) as target_weight
    FROM sales_goals
    WHERE year = '2026'
      AND month = '03'
      AND category = 'IL'
  `;

  console.log('Checking IL goals for March 2026...');
  const result = await executeSQL(query);
  console.table(result?.rows || []);
}

main().catch(console.error);
