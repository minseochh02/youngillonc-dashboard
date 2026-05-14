import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      substr(p.일자, 1, 7) as month,
      p.거래처코드,
      c.거래처명,
      i.품목그룹1코드 as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM purchases p
    LEFT JOIN items i ON p.품목코드 = i.품목코드
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    WHERE p.일자 LIKE '2026-03%'
      AND p.거래처코드 != 'PR00061'
      AND i.품목그룹1코드 = 'IL'
    GROUP BY 1, 2, 3, 4
  `;

  console.log('IL purchases outside of PR00061 for March 2026:');
  const result = await executeSQL(query);
  const rows = result?.rows || [];
  
  console.table(rows);
}

main().catch(console.error);
