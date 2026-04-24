import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      'main' as source,
      i.품목그룹1코드 as group1,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
    FROM sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE substr(s.일자, 1, 7) = '2026-01'
      AND i.품목그룹1코드 IN ('PVL', 'CVL')
    GROUP BY 1, 2

    UNION ALL

    SELECT
      'east' as source,
      i.품목그룹1코드 as group1,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
    FROM east_division_sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE substr(s.일자, 1, 7) = '2026-01'
      AND i.품목그룹1코드 IN ('PVL', 'CVL')
    GROUP BY 1, 2

    UNION ALL

    SELECT
      'west' as source,
      i.품목그룹1코드 as group1,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
    FROM west_division_sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE substr(s.일자, 1, 7) = '2026-01'
      AND i.품목그룹1코드 IN ('PVL', 'CVL')
    GROUP BY 1, 2
  `;

  console.log('Breaking down PVL/CVL sales for Jan 2026 by source table...');
  const result = await executeSQL(query);
  const rows = result?.rows || [];
  
  console.table(rows.map((r: any) => ({
    Source: r.source,
    Group: r.group1,
    'Sales Weight': Number(r.sales_weight).toLocaleString('ko-KR')
  })));
}

main().catch(console.error);
