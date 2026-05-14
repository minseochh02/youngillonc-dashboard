import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      substr(d.일자, 1, 7) as month,
      SUM(CAST(REPLACE(d.수량, ',', '') AS NUMERIC)) as qty,
      SUM(CAST(REPLACE(d.수량, ',', '') AS NUMERIC) * 0.18) as weight_approx -- Just a rough guess of 180ml/kg for IL
    FROM disposed_inventory d
    LEFT JOIN items i ON d.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 = 'IL'
      AND d.일자 LIKE '2026%'
    GROUP BY 1
  `;

  console.log('Checking disposed_inventory for IL in 2026...');
  const result = await executeSQL(query);
  const rows = result?.rows || [];
  console.table(rows);
}

main().catch(console.error);
