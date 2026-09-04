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
  const tableName = 'sales';

  console.log(`=== Deleting June 2026 sales data ===`);

  try {
    // 1. Query the IDs to delete
    const query = `SELECT id FROM \`${tableName}\` WHERE 일자 LIKE '${month}%'`;
    console.log(`Fetching IDs to delete from ${tableName} for ${month}...`);
    const queryRes = await executeSQL(query);
    const idsToDelete = (queryRes.rows || []).map((r: any) => r.id);
    const count = idsToDelete.length;

    if (count === 0) {
      console.log(`No records found for ${month} in ${tableName} table.`);
      return;
    }

    console.log(`Found ${count} rows to delete in ${tableName}.`);

    // 2. Perform deletion in chunked batches
    console.log(`Deleting ${count} rows in chunks of 500...`);
    const CHUNK_SIZE = 500;
    for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
      const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
      await deleteRows(tableName, { ids: chunk });
      await sleep(100); // Give server breathing room between batches
      process.stdout.write(`.`);
    }
    console.log(`\nSuccessfully deleted ${count} rows from ${tableName}.`);

    // 3. Rebuild computed inventory
    console.log(`Waiting 3 seconds before rebuilding computed inventory...`);
    await sleep(3000);
    console.log(`Rebuilding computed inventory monthly snapshots...`);
    const rebuildRes = await rebuildComputedInventoryMonthly();
    console.log(`Computed inventory rebuild complete!`, JSON.stringify(rebuildRes, null, 2));

  } catch (error: any) {
    console.error(`Error during deletion:`, error.message);
  }
}

main().catch(console.error);
