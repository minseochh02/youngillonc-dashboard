/**
 * 일반(본사) ESZ018R + 동부 + 서부 엑셀 처리 후 상세를 합쳐 통합 품목그룹별 총중량 CSV 생성.
 *
 * Usage:
 *   npx tsx scripts/esz018r-combined-export.ts
 *     → 기본: ESZ018R (1).xlsx, 동부 ESZ018R (2).xlsx, 서부ESZ018R (2).xlsx
 *   npx tsx scripts/esz018r-combined-export.ts "<동부.xlsx>" "<서부.xlsx>"
 *     → 일반은 기본 ESZ018R (1).xlsx, 동·서만 경로 지정 (기존 호환)
 *   npx tsx scripts/esz018r-combined-export.ts "<일반.xlsx>" "<동부.xlsx>" "<서부.xlsx>"
 *     → 세 파일 모두 지정
 *
 * Outputs:
 *   ESZ018R_(1)-재고-총중량-상세.csv, …-품목그룹별-총중량.csv  (일반)
 *   동부_ESZ018R_(2)-… , 서부ESZ018R_(2)-…
 *   ESZ018R_통합-재고-총중량-상세.csv  (일반+동부+서부 상세 연결)
 *   ESZ018R_통합-재고-품목그룹별-총중량.csv
 */
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

import {
  exportClassicInventoryFromXlsx,
  exportRegionalInventoryFromXlsx
} from './esz018r-inventory-from-xlsx';
import { writeProductGroupWeightCsv } from './esz018r-weight-by-product-group';

function mergeDetailCsvs(paths: string[], outPath: string): number {
  const header =
    '품목코드,창고코드,재고수량,중량,총중량(중량×재고수량)';
  const lines: string[] = [header];
  for (const p of paths) {
    const all = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => l.trim());
    for (const line of all) {
      if (line.startsWith('품목코드')) continue;
      lines.push(line);
    }
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  return lines.length - 1;
}

function resolvePaths(cwd: string): {
  regularPath: string;
  eastPath: string;
  westPath: string;
} {
  const rest = process.argv.slice(2);
  if (rest.length === 0) {
    return {
      regularPath: path.join(cwd, 'ESZ018R (1).xlsx'),
      eastPath: path.join(cwd, '동부 ESZ018R (2).xlsx'),
      westPath: path.join(cwd, '서부ESZ018R (2).xlsx')
    };
  }
  if (rest.length === 2) {
    return {
      regularPath: path.join(cwd, 'ESZ018R (1).xlsx'),
      eastPath: path.resolve(rest[0]),
      westPath: path.resolve(rest[1])
    };
  }
  if (rest.length === 3) {
    return {
      regularPath: path.resolve(rest[0]),
      eastPath: path.resolve(rest[1]),
      westPath: path.resolve(rest[2])
    };
  }
  throw new Error(
    '인자 0개(기본 3파일), 2개(동부·서부 경로만), 또는 3개(일반·동부·서부)만 지원합니다.'
  );
}

async function main() {
  const cwd = process.cwd();
  const { regularPath, eastPath, westPath } = resolvePaths(cwd);

  console.error('--- 일반(ESZ018R 본사 형식) ---');
  const regular = await exportClassicInventoryFromXlsx(regularPath);
  console.error('--- 동부 ---');
  const east = await exportRegionalInventoryFromXlsx(eastPath);
  console.error('--- 서부 ---');
  const west = await exportRegionalInventoryFromXlsx(westPath);

  const mergedPath = path.join(cwd, 'ESZ018R_통합-재고-총중량-상세.csv');
  const mergedGroupPath = path.join(cwd, 'ESZ018R_통합-재고-품목그룹별-총중량.csv');

  const n = mergeDetailCsvs(
    [regular.detailPath, east.detailPath, west.detailPath],
    mergedPath
  );
  console.error(
    `Wrote ${mergedPath} (${n} rows, 일반+동부+서부 상세 합산)`
  );

  await writeProductGroupWeightCsv(mergedPath, mergedGroupPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
