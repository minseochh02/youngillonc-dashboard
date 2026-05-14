import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      month,
      category,
      purchase_weight,
      sales_weight,
      net_weight,
      inventory_weight
    FROM computed_inventory_monthly
    WHERE month = '2026-03'
      AND category = 'IL'
  `;

  console.log('Fetching computed inventory for IL in 2026-03...');
  const result = await executeSQL(query);
  const rows = result?.rows || [];
  
  console.table(rows.map((r: any) => ({
    Month: r.month,
    Category: r.category,
    Purchase: Number(r.purchase_weight).toLocaleString('ko-KR'),
    Sales: Number(r.sales_weight).toLocaleString('ko-KR'),
    Net: Number(r.net_weight).toLocaleString('ko-KR'),
    Inventory: Number(r.inventory_weight).toLocaleString('ko-KR')
  })));
}

main().catch(console.error);
