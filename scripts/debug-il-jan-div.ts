import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const month = '2026-01';
  const category = 'IL';

  const queries = [
    { name: 'east_sales', table: 'east_division_sales' },
    { name: 'west_sales', table: 'west_division_sales' },
  ];

  for (const q of queries) {
    const sql = `
      SELECT SUM(CAST(REPLACE(t.중량, ',', '') AS NUMERIC)) as weight
      FROM ${q.table} t
      LEFT JOIN items i ON t.품목코드 = i.품목코드
      WHERE substr(t.일자, 1, 7) = '${month}'
        AND i.품목그룹1코드 = '${category}'
    `;
    const res = await executeSQL(sql);
    const weight = res?.rows?.[0]?.weight || 0;
    console.log(`${q.name}: ${weight}`);
  }
}

main().catch(console.error);
