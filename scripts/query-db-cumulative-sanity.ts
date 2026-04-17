/**
 * Sanity check: YTD sales weight by calendar year (through April) using the same
 * sales union as closing-meeting, via executeSQL from egdesk-helpers.
 *
 * Usage: npx tsx scripts/query-db-cumulative-sanity.ts
 * Requires .env.local (NEXT_PUBLIC_EGDESK_API_URL) and EGDesk user-data API reachable.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

const baseSalesSubquery = `
  (
    SELECT s.일자, s.거래처코드, s.실납업체, s.담당자코드, s.품목코드, s.수량, s.중량, s.단가, s.합계, s.공급가액, s.출하창고코드, i.품목그룹1코드
    FROM sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    UNION ALL
    SELECT s.일자, s.거래처코드, s.실납업체, s.담당자코드, s.품목코드, s.수량, s.중량, s.단가, s.합계, s.공급가액, s.출하창고코드, i.품목그룹1코드
    FROM east_division_sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    UNION ALL
    SELECT s.일자, s.거래처코드, s.실납업체, s.담당자코드, s.품목코드, s.수량, s.중량, s.단가, s.합계, s.공급가액, s.출하창고코드, i.품목그룹1코드
    FROM west_division_sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
  )
`;

/** Same YTD window as cumulative view: each listed year, months 01..monthNum inclusive */
function ytdFilter(years: number[], monthNum: string, alias: string) {
  return years
    .map(
      (y) =>
        `(substr(${alias}.일자, 1, 4) = '${y}' AND substr(${alias}.일자, 6, 2) <= '${monthNum}')`
    )
    .join(' OR ');
}

async function main() {
  const monthNum = '04';
  const years = [2023, 2024, 2025, 2026];

  const qRaw = `
    SELECT
      CAST(substr(s.일자, 1, 4) AS INTEGER) AS year,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) AS weight
    FROM (${baseSalesSubquery}) s
    WHERE ${ytdFilter(years, monthNum, 's')}
      AND s.일자 IS NOT NULL AND s.일자 != ''
    GROUP BY 1
    ORDER BY 1
  `;

  const qB2c = `
    SELECT
      CAST(substr(s.일자, 1, 4) AS INTEGER) AS year,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) AS weight
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE ${ytdFilter(years, monthNum, 's')}
      AND (ec.b2c_팀 IS NULL OR ec.b2c_팀 != 'B2B')
      AND e.사원_담당_명 != '김도량'
      AND ec.b2c_팀 IS NOT NULL AND TRIM(ec.b2c_팀) != ''
    GROUP BY 1
    ORDER BY 1
  `;

  console.log('--- Raw YTD sales weight by year (all rows in union, Jan–Apr each year) ---');
  const raw = await executeSQL(qRaw);
  console.table(raw?.rows ?? raw);

  console.log('\n--- B2C-channel YTD (matches cumulative B2C sales filter) ---');
  const b2c = await executeSQL(qB2c);
  console.table(b2c?.rows ?? b2c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
