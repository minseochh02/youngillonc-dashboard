/**
 * Shared: ESZ018R xlsx → 상세 CSV + 품목그룹별 CSV.
 * - Classic (예: ESZ018R (1).xlsx): 품목코드, 창고코드, 재고수량, 중량
 * - Regional (예: 동부/서부 ESZ018R (2).xlsx): 품목코드, 품목명, 창고코드, 창고명, 재고수량 — 단위중량은 DB/판매로 보강
 */
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';
import { combinedInventoryUnionSql } from '../src/lib/inventory-snapshot-combined';
import { writeProductGroupWeightCsv } from './esz018r-weight-by-product-group';

export function escCell(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sqlInList(codes: string[]): string {
  return codes.map((c) => `'${String(c).replace(/'/g, "''")}'`).join(', ');
}

export async function loadUnitWeightFromEsz018r(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await executeSQL(
      `SELECT 품목코드, MAX(중량) AS 중량 FROM (${combinedInventoryUnionSql()}) GROUP BY 품목코드`
    );
    const rows = (res as { rows?: { 품목코드: string; 중량: number }[] })?.rows ?? [];
    for (const r of rows) {
      const k = String(r.품목코드).trim().toUpperCase();
      const w = Number(r.중량);
      if (k && !Number.isNaN(w)) map.set(k, w);
    }
  } catch {
    console.error(
      '[loadUnitWeightFromEsz018r] combined inventory snapshots 없음 또는 조회 실패 — CSV·판매만으로 단위중량 보강'
    );
  }
  return map;
}

/** 기존 동부 상세 CSV에서 품목코드별 단위중량 (첫 유효 행). */
export function mergeUnitWeightFromEastDetailCsv(
  map: Map<string, number>,
  csvPath: string
): void {
  if (!fs.existsSync(csvPath)) return;
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const p = line.split(',');
    if (p.length < 5) continue;
    const wh = p[1].trim();
    if (!/^\d+$/.test(wh)) continue;
    const code = p[0].trim().toUpperCase();
    const uw = Number(p[3]);
    if (!code || code === '품목코드' || Number.isNaN(uw)) continue;
    if (!map.has(code)) map.set(code, uw);
  }
}

export async function loadUnitWeightFromSales(codes: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (codes.length === 0) return out;

  const q = `
    SELECT s.품목코드 AS c,
      AVG(
        ABS(CAST(s.중량 AS REAL)) / NULLIF(ABS(CAST(s.수량 AS REAL)), 0)
      ) AS uw
    FROM (
      SELECT 품목코드, 수량, 중량 FROM sales
      UNION ALL
      SELECT 품목코드, 수량, 중량 FROM east_division_sales
      UNION ALL
      SELECT 품목코드, 수량, 중량 FROM west_division_sales
    ) s
    WHERE s.품목코드 IN (${sqlInList(codes)})
      AND s.수량 IS NOT NULL
      AND s.중량 IS NOT NULL
      AND ABS(CAST(s.수량 AS REAL)) > 0
    GROUP BY s.품목코드
    HAVING uw IS NOT NULL AND uw = uw
  `;
  const res = await executeSQL(q);
  const rows = (res as { rows?: { c: string; uw: number }[] })?.rows ?? [];
  for (const r of rows) {
    const k = String(r.c).trim().toUpperCase();
    const w = Number(r.uw);
    if (k && !Number.isNaN(w) && w > 0) out.set(k, w);
  }
  return out;
}

export type RegionRow = {
  code: string;
  name: string;
  warehouse: string;
  /** 창고명 (엑셀 col3) */
  warehouseName: string;
  qty: number;
};

/** 동부/서부 ESZ018R (2) 형식: col0 품목코드, col1 품목명, col2 창고코드, col3 창고명, col4 재고수량 */
export function parseRegionInventorySheet(data: unknown[][]): RegionRow[] {
  const rows: RegionRow[] = [];
  for (let i = 2; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length < 5) continue;
    const code = String(r[0] ?? '').trim();
    const name = String(r[1] ?? '').trim();
    const wh = String(r[2] ?? '').trim();
    const whName = String(r[3] ?? '').trim();
    const qty = Number(r[4]);
    if (!code || !/^\d+$/.test(wh)) continue;
    if (code === '합계' || code === '소계') continue;
    if (Number.isNaN(qty)) continue;
    rows.push({ code, name, warehouse: wh, warehouseName: whName, qty });
  }
  return rows;
}

export type ExportRegionalResult = {
  detailPath: string;
  groupPath: string;
  rowCount: number;
};

export type ClassicRow = {
  code: string;
  warehouse: string;
  qty: number;
  unitWeight: number;
};

/** 본사/일반 ESZ018R: 헤더 row에 품목코드, 창고코드, 재고수량, 중량 (단위중량 열 포함). */
export function parseClassicInventorySheet(data: unknown[][]): ClassicRow[] {
  const rows: ClassicRow[] = [];
  for (let i = 2; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length < 4) continue;
    const code = String(r[0] ?? '').trim();
    const wh = String(r[1] ?? '').trim();
    const qty = Number(r[2]);
    const unitW = Number(r[3]);
    if (!code || !/^\d+$/.test(wh)) continue;
    if (code === '합계' || code === '소계') continue;
    if (Number.isNaN(qty) || Number.isNaN(unitW)) continue;
    rows.push({ code, warehouse: wh, qty, unitWeight: unitW });
  }
  return rows;
}

/** ESZ018R (1) 등 — 엑셀에 중량이 있어 DB 단위중량 조회 없음. */
export async function exportClassicInventoryFromXlsx(
  xlsxPath: string
): Promise<ExportRegionalResult> {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`File not found: ${xlsxPath}`);
  }

  const wb = XLSX.readFile(xlsxPath);
  const sheetName = wb.SheetNames.includes('재고현황') ? '재고현황' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
  const invRows = parseClassicInventorySheet(data);

  const base = path.basename(xlsxPath, path.extname(xlsxPath)).replace(/\s+/g, '_');
  const detailPath = path.join(process.cwd(), `${base}-재고-총중량-상세.csv`);
  const groupPath = path.join(process.cwd(), `${base}-재고-품목그룹별-총중량.csv`);

  const header = '품목코드,창고코드,재고수량,중량,총중량(중량×재고수량)';
  const roundW = (n: number) => Math.round(n * 1000) / 1000;

  const linesOut = [header];
  for (const r of invRows) {
    const uw = roundW(r.unitWeight);
    const total = roundW(r.qty * r.unitWeight);
    linesOut.push([escCell(r.code), r.warehouse, r.qty, uw, total].join(','));
  }
  fs.writeFileSync(detailPath, linesOut.join('\n'), 'utf8');
  console.error(`Wrote ${detailPath} (${invRows.length} rows)`);

  await writeProductGroupWeightCsv(detailPath, groupPath);
  return { detailPath, groupPath, rowCount: invRows.length };
}

/**
 * @param eastDetailCsvPath - 보조 단위중량 (예: ESZ018R-재고-총중량-상세.csv)
 */
export async function exportRegionalInventoryFromXlsx(
  xlsxPath: string,
  options: { eastDetailCsvPath?: string } = {}
): Promise<ExportRegionalResult> {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`File not found: ${xlsxPath}`);
  }

  const wb = XLSX.readFile(xlsxPath);
  const sheetName = wb.SheetNames.includes('재고현황') ? '재고현황' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
  const invRows = parseRegionInventorySheet(data);

  let unitW = await loadUnitWeightFromEsz018r();
  const eastDetail =
    options.eastDetailCsvPath ?? path.join(process.cwd(), 'ESZ018R-재고-총중량-상세.csv');
  mergeUnitWeightFromEastDetailCsv(unitW, eastDetail);

  const codesNeeded = [...new Set(invRows.map((r) => r.code.toUpperCase()))];
  const missing = codesNeeded.filter((c) => !unitW.has(c));
  if (missing.length > 0) {
    const fromSales = await loadUnitWeightFromSales(missing);
    for (const [k, v] of fromSales) unitW.set(k, v);
  }

  const stillMissing = codesNeeded.filter((c) => !unitW.has(c));
  if (stillMissing.length > 0) {
    console.error(
      `[${path.basename(xlsxPath)}] ${stillMissing.length} 품목코드 단위중량 없음 → 총중량 0:`,
      stillMissing.slice(0, 15).join(', '),
      stillMissing.length > 15 ? '...' : ''
    );
  }

  const base = path.basename(xlsxPath, path.extname(xlsxPath)).replace(/\s+/g, '_');
  const detailPath = path.join(process.cwd(), `${base}-재고-총중량-상세.csv`);
  const groupPath = path.join(process.cwd(), `${base}-재고-품목그룹별-총중량.csv`);

  const header = '품목코드,창고코드,재고수량,중량,총중량(중량×재고수량)';
  const roundW = (n: number) => Math.round(n * 1000) / 1000;

  const linesOut = [header];
  for (const r of invRows) {
    const k = r.code.toUpperCase();
    const uw = unitW.get(k) ?? 0;
    const total = roundW(r.qty * uw);
    linesOut.push([escCell(r.code), r.warehouse, r.qty, roundW(uw), total].join(','));
  }
  fs.writeFileSync(detailPath, linesOut.join('\n'), 'utf8');
  console.error(`Wrote ${detailPath} (${invRows.length} rows)`);

  await writeProductGroupWeightCsv(detailPath, groupPath);
  return { detailPath, groupPath, rowCount: invRows.length };
}
