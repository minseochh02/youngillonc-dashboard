import { config } from 'dotenv';
import { executeSQL } from '../egdesk-helpers';

config({ path: '.env.local' });

async function main() {
  const query = `
    SELECT
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) AS mb_sales_weight
    FROM (
      SELECT 일자, 품목코드, 중량 FROM sales
      UNION ALL
      SELECT 일자, 품목코드, 중량 FROM east_division_sales
      UNION ALL
      SELECT 일자, 품목코드, 중량 FROM west_division_sales
    ) s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE s.일자 IS NOT NULL
      AND s.일자 != ''
      AND substr(s.일자, 1, 4) = '2025'
      AND i.품목그룹1코드 = 'MB'
  `;

  const result = await executeSQL(query);
  const rows = result?.rows ?? result;
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
