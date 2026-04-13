/**
 * Monthly and period totals from unified sales (sales + east_division_sales + west_division_sales).
 * Ex-VAT uses 공급가액; gross uses 합계. Pass --include-vat for gross amounts.
 *
 * Run:
 *   npx tsx scripts/sales-range-totals.ts
 *   npx tsx scripts/sales-range-totals.ts 2026 01 03
 *   npx tsx scripts/sales-range-totals.ts 2026 01 03 --include-vat
 *   npx tsx scripts/sales-range-totals.ts 2026 01 03 --all-only
 *   npx tsx scripts/sales-range-totals.ts 2026 01 03 --exclude-kim-only
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { executeSQL } from '../egdesk-helpers';

config({ path: resolve(process.cwd(), '.env.local') });

const BASE_SALES_UNION = `
  (
    SELECT s.일자, s.거래처코드, s.실납업체, s.합계, s.공급가액, s.중량
    FROM sales s
    UNION ALL
    SELECT s.일자, s.거래처코드, s.실납업체, s.합계, s.공급가액, s.중량
    FROM east_division_sales s
    UNION ALL
    SELECT s.일자, s.거래처코드, s.실납업체, s.합계, s.공급가액, s.중량
    FROM west_division_sales s
  )
`;

function amountExpr(includeVat: boolean, alias = 's') {
  return includeVat
    ? `CAST(REPLACE(${alias}.합계, ',', '') AS NUMERIC)`
    : `CAST(REPLACE(${alias}.공급가액, ',', '') AS NUMERIC)`;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const includeVat = argv.includes('--include-vat');
  const allOnly = argv.includes('--all-only');
  const excludeKimOnly = argv.includes('--exclude-kim-only');
  const nums = argv.filter((a) => /^\d+$/.test(a));
  const year = nums[0] ?? '2026';
  const monthFrom = (nums[1] ?? '01').padStart(2, '0');
  const monthTo = (nums[2] ?? '03').padStart(2, '0');
  return {
    year,
    monthFrom,
    monthTo,
    fromYm: `${year}-${monthFrom}`,
    toYm: `${year}-${monthTo}`,
    includeVat,
    allOnly,
    excludeKimOnly,
  };
}

function buildQueries(includeVat: boolean, fromYm: string, toYm: string) {
  const line = amountExpr(includeVat, 's');
  const period = `substr(s.일자, 1, 7) >= '${fromYm}' AND substr(s.일자, 1, 7) <= '${toYm}'`;

  const allByMonth = `
    SELECT
      substr(s.일자, 1, 7) AS month,
      ROUND(SUM(${line})) AS total_amount,
      ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) AS total_weight
    FROM ${BASE_SALES_UNION} s
    WHERE ${period}
    GROUP BY 1
    ORDER BY 1
  `;

  const allPeriod = `
    SELECT
      ROUND(SUM(${line})) AS total_amount,
      ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) AS total_weight
    FROM ${BASE_SALES_UNION} s
    WHERE ${period}
  `;

  const excludeKim = `(e.사원_담당_명 IS NULL OR e.사원_담당_명 != '김도량')`;

  const exKimByMonth = `
    SELECT
      substr(s.일자, 1, 7) AS month,
      ROUND(SUM(${line})) AS total_amount,
      ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) AS total_weight
    FROM ${BASE_SALES_UNION} s
    LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    WHERE ${period}
      AND ${excludeKim}
    GROUP BY 1
    ORDER BY 1
  `;

  const exKimPeriod = `
    SELECT
      ROUND(SUM(${line})) AS total_amount,
      ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) AS total_weight
    FROM ${BASE_SALES_UNION} s
    LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    WHERE ${period}
      AND ${excludeKim}
  `;

  const uLine = amountExpr(includeVat, 'u');
  const byDivisionMonth = `
    SELECT
      substr(u.일자, 1, 7) AS month,
      u.division,
      ROUND(SUM(${uLine})) AS total_amount,
      ROUND(SUM(CAST(REPLACE(u.중량, ',', '') AS NUMERIC))) AS total_weight
    FROM (
      SELECT 'main' AS division, 일자, 합계, 공급가액, 중량 FROM sales
      UNION ALL
      SELECT 'east' AS division, 일자, 합계, 공급가액, 중량 FROM east_division_sales
      UNION ALL
      SELECT 'west' AS division, 일자, 합계, 공급가액, 중량 FROM west_division_sales
    ) u
    WHERE substr(u.일자, 1, 7) >= '${fromYm}' AND substr(u.일자, 1, 7) <= '${toYm}'
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;

  return { allByMonth, allPeriod, exKimByMonth, exKimPeriod, byDivisionMonth };
}

async function main() {
  const args = parseArgs();
  const { allByMonth, allPeriod, exKimByMonth, exKimPeriod, byDivisionMonth } = buildQueries(
    args.includeVat,
    args.fromYm,
    args.toYm
  );

  console.log(
    `Range: ${args.fromYm} .. ${args.toYm} | amount: ${args.includeVat ? '합계 (gross)' : '공급가액 (ex-VAT)'}\n`
  );

  if (args.excludeKimOnly) {
    const [byMonth, period] = await Promise.all([executeSQL(exKimByMonth), executeSQL(exKimPeriod)]);
    console.log(JSON.stringify({ excludeKimDoryang: { byMonth: byMonth?.rows, periodTotal: period?.rows?.[0] } }, null, 2));
    return;
  }

  if (args.allOnly) {
    const [byMonth, period, byDiv] = await Promise.all([
      executeSQL(allByMonth),
      executeSQL(allPeriod),
      executeSQL(byDivisionMonth),
    ]);
    console.log(
      JSON.stringify(
        {
          all: { byMonth: byMonth?.rows, periodTotal: period?.rows?.[0] },
          byDivisionMonth: byDiv?.rows,
        },
        null,
        2
      )
    );
    return;
  }

  const [aM, aP, eM, eP, dM] = await Promise.all([
    executeSQL(allByMonth),
    executeSQL(allPeriod),
    executeSQL(exKimByMonth),
    executeSQL(exKimPeriod),
    executeSQL(byDivisionMonth),
  ]);

  console.log(
    JSON.stringify(
      {
        all: { byMonth: aM?.rows, periodTotal: aP?.rows?.[0] },
        excludeKimDoryang: { byMonth: eM?.rows, periodTotal: eP?.rows?.[0] },
        byDivisionMonth: dM?.rows,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
