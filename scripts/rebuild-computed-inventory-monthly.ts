/**
 * Rebuild month-end computed inventory by category.
 *
 * 기준:
 * - 기준 스냅샷: 2025-12-31 (youngil/west/east_inventory_20251231 합산)
 * - 월별 순변동: 매입 - 매출 - 자가사용 - 재고폐기
 * - 월말 재고(카테고리별):
 *   - snapshot 이후 월: snapshot + 누적(순변동)
 *   - snapshot 이전 월: snapshot - 역누적(순변동)
 *
 * Run:
 *   npx tsx scripts/rebuild-computed-inventory-monthly.ts
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

import { rebuildComputedInventoryMonthly } from '../src/lib/computed-inventory-utils';

async function main() {
  const fromMonth = process.argv[2];
  if (fromMonth) {
    console.log(`Starting rebuild-computed-inventory-monthly from month ${fromMonth}...`);
  } else {
    console.log('Starting rebuild-computed-inventory-monthly (full rebuild)...');
  }
  const result = await rebuildComputedInventoryMonthly(fromMonth);
  console.log(JSON.stringify(result, null, 2));
  console.log('Rebuild complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
