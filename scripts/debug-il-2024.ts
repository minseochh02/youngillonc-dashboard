import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      inventory_weight
    FROM computed_inventory_monthly
    WHERE month = '2024-12'
      AND category = 'IL'
  `;

  console.log('Checking IL inventory for December 2024...');
  const res = await executeSQL(query);
  console.table(res?.rows || []);
}

main().catch(console.error);
