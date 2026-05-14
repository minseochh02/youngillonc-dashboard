import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      month,
      SUM(inventory_weight) as total_inventory
    FROM computed_inventory_monthly
    WHERE month IN ('2026-02', '2026-03')
      AND category IN ('PVL', 'CVL', 'IL')
    GROUP BY 1
  `;

  console.log('Fetching total inventory for PVL+CVL+IL...');
  const result = await executeSQL(query);
  console.table(result?.rows || []);
}

main().catch(console.error);
