/**
 * 영일 / 서부 / 동부 재고 스냅샷 테이블에 ESZ018R 엑셀 데이터 적재.
 *
 * Tables: youngil_inventory_20251231, west_inventory_20251231, east_inventory_20251231
 * Defaults: ESZ018R (1).xlsx, 서부ESZ018R (2).xlsx, 동부 ESZ018R (2).xlsx
 *
 * Run: npx tsx scripts/populate-inventory-snapshots-20251231.ts
 * Optional: npx tsx scripts/populate-inventory-snapshots-20251231.ts "<영일.xlsx>" "<서부.xlsx>" "<동부.xlsx>"
 *
 * Clears existing rows (by id) then batch-inserts.
 * 세 테이블 동일 컬럼: 품목코드, 창고코드, 재고수량, 중량, 총중량, imported_at
 * **총중량** = 재고수량 × 단위중량. 동·서부 단위중량은 combined 스냅샷/동부상세CSV + 판매비율과 동일 로직.
 *
 * 테이블에 `총중량`/`중량` 열이 없으면: `npm run reset-inventory-snapshots-20251231` 후 이 스크립트 재실행.
 */
import { config } from 'dotenv';
import * as path from 'path';
import * as XLSX from 'xlsx';

config({ path: '.env.local' });

import { deleteRows, executeSQL, insertRows } from '../egdesk-helpers';
import {
  loadUnitWeightFromEsz018r,
  loadUnitWeightFromSales,
  mergeUnitWeightFromEastDetailCsv,
  parseClassicInventorySheet,
  parseRegionInventorySheet
} from './esz018r-inventory-from-xlsx';

const SNAPSHOT_DATE = '2025-12-31';
const BATCH = 250;

const roundW = (n: number) => Math.round(n * 1000) / 1000;

async function regionalUnitWeightMap(
  codesUpper: string[],
  cwd: string
): Promise<Map<string, number>> {
  let map = await loadUnitWeightFromEsz018r();
  mergeUnitWeightFromEastDetailCsv(
    map,
    path.join(cwd, 'ESZ018R-재고-총중량-상세.csv')
  );
  const missing = [...new Set(codesUpper)].filter((c) => !map.has(c));
  if (missing.length > 0) {
    const fromSales = await loadUnitWeightFromSales(missing);
    for (const [k, v] of fromSales) map.set(k, v);
  }
  return map;
}

function loadMatrix(xlsxPath: string): unknown[][] {
  const wb = XLSX.readFile(xlsxPath);
  const name = wb.SheetNames.includes('재고현황') ? '재고현황' : wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as unknown[][];
}

async function clearByIds(tableName: string): Promise<void> {
  const res = await executeSQL(`SELECT id FROM ${tableName}`);
  const rows = (res as { rows?: { id: number }[] })?.rows ?? [];
  const ids = rows.map((r) => r.id).filter((id) => id != null);
  for (let i = 0; i < ids.length; i += BATCH) {
    await deleteRows(tableName, { ids: ids.slice(i, i + BATCH) });
  }
  if (ids.length) console.error(`Cleared ${ids.length} rows from ${tableName}`);
}

async function insertBatches(
  tableName: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await insertRows(tableName, chunk);
  }
  console.error(`Inserted ${rows.length} rows → ${tableName}`);
}

async function main() {
  const cwd = process.cwd();
  const argv = process.argv.slice(2);
  const youngilXlsx = path.resolve(
    argv[0] ?? path.join(cwd, 'ESZ018R (1).xlsx')
  );
  const westXlsx = path.resolve(
    argv[1] ?? path.join(cwd, '서부ESZ018R (2).xlsx')
  );
  const eastXlsx = path.resolve(
    argv[2] ?? path.join(cwd, '동부 ESZ018R (2).xlsx')
  );

  const classic = parseClassicInventorySheet(loadMatrix(youngilXlsx));
  const youngilRows = classic.map((r) => {
    const uw = roundW(r.unitWeight);
    const total = roundW(r.qty * r.unitWeight);
    return {
      품목코드: r.code,
      창고코드: r.warehouse,
      재고수량: r.qty,
      중량: uw,
      총중량: total,
      imported_at: SNAPSHOT_DATE
    };
  });

  const westParsed = parseRegionInventorySheet(loadMatrix(westXlsx));
  const westMap = await regionalUnitWeightMap(
    westParsed.map((r) => r.code.toUpperCase()),
    cwd
  );
  const westRows = westParsed.map((r) => {
    const rawUw = westMap.get(r.code.toUpperCase()) ?? 0;
    const uw = roundW(rawUw);
    const total = roundW(r.qty * rawUw);
    return {
      품목코드: r.code,
      창고코드: r.warehouse,
      재고수량: r.qty,
      중량: uw,
      총중량: total,
      imported_at: SNAPSHOT_DATE
    };
  });

  const eastParsed = parseRegionInventorySheet(loadMatrix(eastXlsx));
  const eastMap = await regionalUnitWeightMap(
    eastParsed.map((r) => r.code.toUpperCase()),
    cwd
  );
  const eastRows = eastParsed.map((r) => {
    const rawUw = eastMap.get(r.code.toUpperCase()) ?? 0;
    const uw = roundW(rawUw);
    const total = roundW(r.qty * rawUw);
    return {
      품목코드: r.code,
      창고코드: r.warehouse,
      재고수량: r.qty,
      중량: uw,
      총중량: total,
      imported_at: SNAPSHOT_DATE
    };
  });

  console.error('--- 영일 youngil_inventory_20251231 ---');
  await clearByIds('youngil_inventory_20251231');
  await insertBatches('youngil_inventory_20251231', youngilRows);

  console.error('--- 서부 west_inventory_20251231 ---');
  await clearByIds('west_inventory_20251231');
  await insertBatches('west_inventory_20251231', westRows);

  console.error('--- 동부 east_inventory_20251231 ---');
  await clearByIds('east_inventory_20251231');
  await insertBatches('east_inventory_20251231', eastRows);

  console.error('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
