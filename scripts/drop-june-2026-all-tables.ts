import { config } from 'dotenv';
import { existsSync } from 'fs';
import { executeSQL, deleteRows } from '../egdesk-helpers';
import { rebuildComputedInventoryMonthly } from '../src/lib/computed-inventory-utils';

if (existsSync('.env.development.local')) {
  config({ path: '.env.development.local' });
} else {
  config({ path: '.env.local' });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const month = '2026-06';
  
  const tables = [
    'ledger',
    'sales',
    'west_division_sales',
    'east_division_sales',
    'purchases',
    'pending_purchases',
    'purchase_orders',
    'west_division_purchases',
    'east_division_purchases',
    'promissory_notes',
    'inventory_transfers',
    'internal_uses',
    'east_disposed_inventory'
  ];

  console.log(`=== Deleting June 2026 data across ALL targeted tables ===`);

  for (const t of tables) {
    try {
      console.log(`Processing table: ${t}`);
      
      // 1. Get IDs to delete
      const query = `SELECT id FROM \`${t}\` WHERE 일자 LIKE '${month}%'`;
      const res = await executeSQL(query);
      const idsToDelete = (res.rows || []).map((r: any) => r.id);
      const count = idsToDelete.length;

      if (count === 0) {
        console.log(`  - No June 2026 records found in ${t}.`);
        continue;
      }

      console.log(`  - Found ${count} records to delete.`);

      // 2. Delete rows in chunks of 500
      const CHUNK_SIZE = 500;
      for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
        const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
        await deleteRows(t, { ids: chunk });
        await sleep(100); // Give server breathing room
        process.stdout.write(`.`);
      }
      console.log(`\n  - Successfully deleted ${count} rows from ${t}.`);

    } catch (error: any) {
      console.error(`Error deleting from ${t}:`, error.message);
    }
  }

  // 3. Rebuild computed monthly inventory
  console.log(`\nWaiting 3 seconds before rebuilding computed monthly inventory...`);
  await sleep(3000);
  console.log(`Rebuilding computed monthly inventory snapshots...`);
  try {
    const rebuildRes = await rebuildComputedInventoryMonthly();
    console.log(`Computed inventory rebuild complete!`, JSON.stringify(rebuildRes, null, 2));
  } catch (err: any) {
    console.error(`Failed to rebuild computed inventory:`, err.message);
  }
}

main().catch(console.error);
