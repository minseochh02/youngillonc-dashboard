import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as non_pr_weight
    FROM purchases p
    LEFT JOIN items i ON p.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 = 'IL'
      AND p.거래처코드 != 'PR00061'
      AND substr(p.일자, 1, 7) <= '2026-03'
      AND substr(p.일자, 1, 4) = '2026'
  `;

  console.log('Checking cumulative non-PR00061 IL purchases in 2026...');
  const res = await executeSQL(query);
  const weight = res?.rows?.[0]?.non_pr_weight || 0;
  console.log(`Weight: ${weight}`);
}

main().catch(console.error);
