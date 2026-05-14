import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      substr(p.일자, 1, 7) as month,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as non_pr_weight
    FROM purchases p
    LEFT JOIN items i ON p.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 = 'IL'
      AND p.거래처코드 != 'PR00061'
      AND p.일자 LIKE '2026%'
    GROUP BY 1
  `;

  console.log('Checking IL purchases from non-PR00061 vendors in 2026...');
  const res = await executeSQL(query);
  console.table(res?.rows || []);
}

main().catch(console.error);
