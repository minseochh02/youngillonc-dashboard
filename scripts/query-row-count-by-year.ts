/**
 * Row counts per calendar year for sales tables used in closing-meeting.
 * Usage: npx tsx scripts/query-row-count-by-year.ts
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const tables = ['sales', 'east_division_sales', 'west_division_sales'] as const;
  for (const t of tables) {
    const r = await executeSQL(`
      SELECT CAST(substr(일자, 1, 4) AS INTEGER) AS year, COUNT(*) AS row_count
      FROM ${t}
      WHERE 일자 IS NOT NULL AND 일자 != '' AND LENGTH(일자) >= 7
      GROUP BY 1
      ORDER BY 1
    `);
    console.log(`\n=== ${t} ===`);
    console.table(r?.rows ?? r);
  }

  const combined = await executeSQL(`
    SELECT year, SUM(c) AS row_count FROM (
      SELECT CAST(substr(일자, 1, 4) AS INTEGER) AS year, COUNT(*) AS c FROM sales
      WHERE 일자 IS NOT NULL AND 일자 != '' AND LENGTH(일자) >= 7 GROUP BY 1
      UNION ALL
      SELECT CAST(substr(일자, 1, 4) AS INTEGER), COUNT(*) FROM east_division_sales
      WHERE 일자 IS NOT NULL AND 일자 != '' AND LENGTH(일자) >= 7 GROUP BY 1
      UNION ALL
      SELECT CAST(substr(일자, 1, 4) AS INTEGER), COUNT(*) FROM west_division_sales
      WHERE 일자 IS NOT NULL AND 일자 != '' AND LENGTH(일자) >= 7 GROUP BY 1
    )
    GROUP BY year
    ORDER BY year
  `);
  console.log('\n=== Combined (sales + east + west, sum of row counts) ===');
  console.table(combined?.rows ?? combined);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
