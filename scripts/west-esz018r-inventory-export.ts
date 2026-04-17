/**
 * 서부 ESZ018R 엑셀 → 재고 상세 + 품목그룹별 총중량 CSV
 *
 * Usage:
 *   npx tsx scripts/west-esz018r-inventory-export.ts [서부ESZ018R (2).xlsx]
 *
 * Requires .env.local and EGDesk API (executeSQL).
 */
import { config } from 'dotenv';
import * as path from 'path';

config({ path: '.env.local' });

import { exportRegionalInventoryFromXlsx } from './esz018r-inventory-from-xlsx';

async function main() {
  const xlsxPath = path.resolve(
    process.argv[2] ?? path.join(process.cwd(), '서부ESZ018R (2).xlsx')
  );
  await exportRegionalInventoryFromXlsx(xlsxPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
