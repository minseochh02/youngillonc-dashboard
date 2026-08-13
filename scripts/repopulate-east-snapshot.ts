import * as path from 'path';
import { config } from 'dotenv';
config({ path: '.env.development.local' });
config({ path: '.env.local' });
import { deleteRows, executeSQL, insertRows } from '../egdesk-helpers';
import {
  loadUnitWeightFromEsz018r,
  loadUnitWeightFromSales,
  mergeUnitWeightFromEastDetailCsv,
  parseRegionInventorySheet
} from './esz018r-inventory-from-xlsx';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const SNAPSHOT_DATE = '2025-12-31';
const BATCH = 250;
const roundW = (n: number) => Math.round(n * 1000) / 1000;

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
  if (ids.length) console.log(`Cleared ${ids.length} rows from ${tableName}`);
}

async function insertBatches(
  tableName: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await insertRows(tableName, chunk);
  }
  console.log(`Inserted ${rows.length} rows → ${tableName}`);
}

async function regionalUnitWeightMap(
  codesUpper: string[],
  cwd: string
): Promise<Map<string, number>> {
  let map = await loadUnitWeightFromEsz018r();
  const csvPath = path.join(cwd, 'ESZ018R-재고-총중량-상세.csv');
  if (fs.existsSync(csvPath)) {
    mergeUnitWeightFromEastDetailCsv(map, csvPath);
  } else {
    console.log(`Warning: CSV weight file not found at ${csvPath}, skipping merge.`);
  }
  const missing = [...new Set(codesUpper)].filter((c) => !map.has(c));
  if (missing.length > 0) {
    const fromSales = await loadUnitWeightFromSales(missing);
    for (const [k, v] of fromSales) map.set(k, v);
  }
  return map;
}

async function main() {
  const cwd = process.cwd();
  const eastXlsx = path.join(cwd, '20251231동부재고(종).xlsx');

  console.log(`Loading and parsing ${eastXlsx}...`);
  const eastParsed = parseRegionInventorySheet(loadMatrix(eastXlsx));
  console.log(`Parsed ${eastParsed.length} rows.`);

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

  console.log('Clearing old database snapshot rows...');
  await clearByIds('east_inventory_20251231');

  console.log('Inserting new database snapshot rows...');
  await insertBatches('east_inventory_20251231', eastRows);

  console.log('Success! Database snapshot updated.');
}

main().catch(console.error);
