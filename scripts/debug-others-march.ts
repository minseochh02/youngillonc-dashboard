import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      *
    FROM computed_inventory_monthly
    WHERE month = '2026-03'
      AND category = '기타'
  `;

  console.log('Fetching computed inventory for 기타 in 2026-03...');
  const result = await executeSQL(query);
  console.table(result?.rows || []);
}

main().catch(console.error);
