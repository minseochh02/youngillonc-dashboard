import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      substr(u.일자, 1, 7) as month,
      SUM(CAST(REPLACE(u.수량, ',', '') AS NUMERIC)) as qty
    FROM internal_uses u
    LEFT JOIN items i ON u.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 = 'IL'
      AND u.일자 LIKE '2026%'
    GROUP BY 1
  `;

  console.log('Checking internal_uses for IL in 2026...');
  const result = await executeSQL(query);
  const rows = result?.rows || [];
  console.table(rows);
}

main().catch(console.error);
