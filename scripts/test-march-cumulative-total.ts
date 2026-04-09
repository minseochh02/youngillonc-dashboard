/**
 * Validate cumulative totals up to March (01~03) directly from DB.
 * Run:
 *   npx tsx scripts/test-march-cumulative-total.ts
 *   npx tsx scripts/test-march-cumulative-total.ts 2025
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { executeSQL } from '../egdesk-helpers';

config({ path: resolve(process.cwd(), '.env.local') });

type Row = {
  year: string;
  category: string;
  sales_weight: number | string | null;
  purchase_weight: number | string | null;
};

const categories = ['MB', 'AVI', 'MAR', 'AUTO', 'IL', '기타'];

function toNumber(value: number | string | null | undefined): number {
  return Number(value) || 0;
}

async function getLatestYearFromSales(): Promise<number> {
  const result = await executeSQL(`
    SELECT MAX(substr(일자, 1, 4)) as latest_year
    FROM (
      SELECT 일자 FROM sales
      UNION ALL SELECT 일자 FROM east_division_sales
      UNION ALL SELECT 일자 FROM west_division_sales
    )
    WHERE 일자 IS NOT NULL
      AND 일자 != ''
      AND substr(일자, 1, 4) BETWEEN '2017' AND '2099'
  `);

  const latest = result?.rows?.[0]?.latest_year;
  return Number(latest) || new Date().getFullYear();
}

async function queryMarchCumulative(targetYear: number): Promise<Row[]> {
  const fromMonth = `${targetYear}-01`;
  const toMonth = `${targetYear}-03`;

  const baseSalesSubquery = `
    (
      SELECT s.일자, s.거래처코드, s.실납업체, s.품목코드, s.중량, i.품목그룹1코드
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      UNION ALL
      SELECT s.일자, s.거래처코드, s.실납업체, s.품목코드, s.중량, i.품목그룹1코드
      FROM east_division_sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      UNION ALL
      SELECT s.일자, s.거래처코드, s.실납업체, s.품목코드, s.중량, i.품목그룹1코드
      FROM west_division_sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
    )
  `;

  const basePurchasesSubquery = `
    (
      SELECT p.일자, p.품목코드, p.중량, i.품목그룹1코드
      FROM purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      UNION ALL
      SELECT p.일자, p.품목코드, p.중량, i.품목그룹1코드
      FROM east_division_purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      UNION ALL
      SELECT p.일자, p.품목코드, p.중량, i.품목그룹1코드
      FROM west_division_purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
    )
  `;

  const categoryCaseForSales = `
    CASE
      WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
      WHEN s.품목그룹1코드 = 'AVI' THEN 'AVI'
      WHEN s.품목그룹1코드 = 'MAR' THEN 'MAR'
      WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
      WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
      ELSE '기타'
    END
  `;

  const categoryCaseForPurchase = `
    CASE
      WHEN p.품목그룹1코드 = 'MB' THEN 'MB'
      WHEN p.품목그룹1코드 = 'AVI' THEN 'AVI'
      WHEN p.품목그룹1코드 = 'MAR' THEN 'MAR'
      WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
      WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
      ELSE '기타'
    END
  `;

  const salesQuery = `
    SELECT
      ${categoryCaseForSales} as category,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE s.일자 IS NOT NULL
      AND substr(s.일자, 1, 7) >= '${fromMonth}'
      AND substr(s.일자, 1, 7) <= '${toMonth}'
      AND e.사원_담당_명 != '김도량'
      AND ec.전체사업소 IS NOT NULL
    GROUP BY 1
  `;

  const purchaseQuery = `
    SELECT
      ${categoryCaseForPurchase} as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as purchase_weight
    FROM (${basePurchasesSubquery}) p
    WHERE p.일자 IS NOT NULL
      AND substr(p.일자, 1, 7) >= '${fromMonth}'
      AND substr(p.일자, 1, 7) <= '${toMonth}'
    GROUP BY 1
  `;

  const [salesResult, purchaseResult] = await Promise.all([
    executeSQL(salesQuery),
    executeSQL(purchaseQuery),
  ]);

  const salesRows = (salesResult?.rows || []) as Array<{ category: string; sales_weight: number | string | null }>;
  const purchaseRows = (purchaseResult?.rows || []) as Array<{ category: string; purchase_weight: number | string | null }>;
  const salesMap = new Map<string, number>();
  const purchaseMap = new Map<string, number>();

  salesRows.forEach((r) => salesMap.set(r.category, toNumber(r.sales_weight)));
  purchaseRows.forEach((r) => purchaseMap.set(r.category, toNumber(r.purchase_weight)));

  return categories.map((category) => ({
    year: String(targetYear),
    category,
    sales_weight: salesMap.get(category) || 0,
    purchase_weight: purchaseMap.get(category) || 0,
  }));
}

async function main() {
  const inputYear = process.argv[2] ? Number(process.argv[2]) : null;
  const targetYear = inputYear || (await getLatestYearFromSales());

  console.log(`\n[March cumulative test] Target year: ${targetYear}`);
  console.log(`Range: ${targetYear}-01 ~ ${targetYear}-03`);
  console.log('Scope: ALL teams (B2C+B2B), category includes 기타\n');

  const rows = await queryMarchCumulative(targetYear);

  let totalSales = 0;
  let totalPurchase = 0;
  for (const cat of categories) {
    const row = rows.find((r) => r.category === cat);
    const sales = toNumber(row?.sales_weight);
    const purchase = toNumber(row?.purchase_weight);
    totalSales += sales;
    totalPurchase += purchase;

    console.log(
      `${cat.padEnd(4, ' ')} | 판매: ${Math.round(sales).toLocaleString()} L | 구매: ${Math.round(purchase).toLocaleString()} L`
    );
  }

  console.log('\n--- TOTAL ---');
  console.log(`판매 합계: ${Math.round(totalSales).toLocaleString()} L`);
  console.log(`구매 합계: ${Math.round(totalPurchase).toLocaleString()} L\n`);
}

main().catch((error) => {
  console.error('Failed to run March cumulative test script:', error);
  process.exit(1);
});

