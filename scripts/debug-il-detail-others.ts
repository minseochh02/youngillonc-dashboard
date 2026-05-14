import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      p.일자,
      c.거래처명,
      i.품목그룹1코드 as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM purchases p
    LEFT JOIN items i ON p.품목코드 = i.품목코드
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    WHERE p.거래처코드 != 'PR00061'
      AND i.품목그룹1코드 = 'IL'
      AND p.일자 LIKE '2026%'
    GROUP BY 1, 2, 3
    ORDER BY p.일자 DESC
  `;

  console.log('Detailed non-PR00061 IL purchases in 2026:');
  const result = await executeSQL(query);
  const rows = result?.rows || [];
  console.table(rows);
}

main().catch(console.error);
