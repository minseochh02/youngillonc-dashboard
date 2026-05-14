import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const tables = [
    'youngil_inventory_20251231',
    'west_inventory_20251231',
    'east_inventory_20251231'
  ];

  for (const t of tables) {
    const query = `
      SELECT SUM(CAST(COALESCE(inv.총중량, 0) AS NUMERIC)) as weight
      FROM ${t} inv
      LEFT JOIN items i ON inv.품목코드 = i.품목코드
      WHERE i.품목그룹1코드 = 'IL'
    `;
    const res = await executeSQL(query);
    console.log(`${t}: ${res?.rows?.[0]?.weight}`);
  }
}

main().catch(console.error);
