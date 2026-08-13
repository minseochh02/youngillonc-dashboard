/**
 * Rebuild daily computed inventory rollup table.
 *
 * Run:
 *   npx tsx scripts/rebuild-computed-inventory-daily.ts [fromDate]
 *   Example: npx tsx scripts/rebuild-computed-inventory-daily.ts 2026-06-01
 */
import { config } from 'dotenv';
config({ path: '.env.development.local' });
config({ path: '.env.local' });

import { rebuildComputedInventoryDaily } from '../src/lib/computed-inventory-utils';

async function main() {
  const fromDate = process.argv[2];
  if (fromDate) {
    console.log(`Starting rebuild-computed-inventory-daily from date ${fromDate}...`);
  } else {
    console.log('Starting rebuild-computed-inventory-daily (full rebuild)...');
  }
  const result = await rebuildComputedInventoryDaily(fromDate);
  console.log(JSON.stringify(result, null, 2));
  console.log('Daily rebuild complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
