/**
 * ESZ018R 재고 상세 CSV + items 테이블 → 품목그룹1코드별 총중량 CSV
 *
 * Reads 총중량 from the detail file (재고수량×중량 per row), joins 품목코드 to
 * `items.품목그룹1코드` via executeSQL from egdesk-helpers.
 *
 * Usage:
 *   npx tsx scripts/esz018r-weight-by-product-group.ts [path/to/ESZ018R-재고-총중량-상세.csv]
 *
 * Requires .env.local (NEXT_PUBLIC_EGDESK_API_URL / KEY) and EGDesk user-data API reachable.
 */
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

type ItemRow = { 품목코드: string; 품목그룹1코드: string | null };

function escCell(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function parseDetailLine(line: string): { code: string; totalWeight: number } | null {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(',');
  if (parts.length < 5) return null;
  const code = parts[0].trim();
  const warehouse = parts[1].trim();
  const total = Number(parts[parts.length - 1]);
  if (code === '품목코드' || Number.isNaN(total)) return null;
  // Skip sheet footers (합계 / Excel print timestamp rows have no 창고코드)
  if (!warehouse || !/^\d+$/.test(warehouse)) return null;
  if (code === '합계' || code === '소계') return null;
  return { code, totalWeight: total };
}

async function loadItemGroupMap(): Promise<Map<string, string>> {
  const res = await executeSQL(
    `SELECT 품목코드, 품목그룹1코드 FROM items WHERE 품목코드 IS NOT NULL AND TRIM(품목코드) != ''`
  );
  const rows = (res as { rows?: ItemRow[] })?.rows ?? (Array.isArray(res) ? res : []);
  const map = new Map<string, string>();
  for (const r of rows as ItemRow[]) {
    const code = String(r.품목코드 ?? '').trim();
    if (!code) continue;
    const g = r.품목그룹1코드 != null ? String(r.품목그룹1코드).trim() : '';
    map.set(code.toUpperCase(), g);
  }
  return map;
}

/** Aggregate 총중량 by 품목그룹1코드 from a detail CSV (same format as ESZ018R-재고-총중량-상세). */
export async function writeProductGroupWeightCsv(
  detailCsvPath: string,
  outCsvPath: string
): Promise<void> {
  const text = fs.readFileSync(detailCsvPath, 'utf8');
  const lines = text.split(/\r?\n/);

  const byGroup = new Map<string, number>();

  const itemToGroup = await loadItemGroupMap();
  console.error(`Loaded ${itemToGroup.size} item → 품목그룹1 mappings from items`);

  for (const line of lines) {
    const parsed = parseDetailLine(line);
    if (!parsed) continue;
    const gRaw = itemToGroup.get(parsed.code.toUpperCase());
    const group =
      gRaw !== undefined && gRaw !== ''
        ? gRaw
        : gRaw === ''
          ? '(빈그룹)'
          : '(미매칭)';

    byGroup.set(group, (byGroup.get(group) ?? 0) + parsed.totalWeight);
  }

  const sorted = [...byGroup.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'ko')
  );

  const roundW = (n: number) => Math.round(n * 1000) / 1000;
  const out = ['품목그룹1코드,총중량']
    .concat(sorted.map(([g, w]) => `${escCell(g)},${roundW(w)}`))
    .join('\n');

  fs.writeFileSync(outCsvPath, out, 'utf8');
  console.error(`Wrote ${outCsvPath} (${sorted.length} groups)`);
  console.log(out);
}

async function main() {
  const defaultCsv = path.join(process.cwd(), 'ESZ018R-재고-총중량-상세.csv');
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultCsv;
  const outArg = process.argv[3];

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  let outPath = outArg;
  if (!outPath) {
    if (/-재고-총중량-상세\.csv$/i.test(csvPath)) {
      outPath = csvPath.replace(/-재고-총중량-상세\.csv$/i, '-재고-품목그룹별-총중량.csv');
    } else {
      outPath = csvPath.replace(/\.csv$/i, '-품목그룹별-총중량.csv');
    }
  }

  await writeProductGroupWeightCsv(csvPath, path.resolve(outPath));
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1]?.includes('esz018r-weight-by-product-group');

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
