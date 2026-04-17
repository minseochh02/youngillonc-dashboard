/**
 * 본사/일반 ESZ018R 엑셀 (품목코드, 창고코드, 재고수량, 중량 열 포함)
 *
 * Usage:
 *   npx tsx scripts/regular-esz018r-inventory-export.ts ["ESZ018R (1).xlsx"]
 */
import { config } from 'dotenv';
import * as path from 'path';

config({ path: '.env.local' });

import { exportClassicInventoryFromXlsx } from './esz018r-inventory-from-xlsx';

async function main() {
  const xlsxPath = path.resolve(
    process.argv[2] ?? path.join(process.cwd(), 'ESZ018R (1).xlsx')
  );
  await exportClassicInventoryFromXlsx(xlsxPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
