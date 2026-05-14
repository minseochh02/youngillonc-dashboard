import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      w.창고명,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM purchases p
    LEFT JOIN items i ON p.품목코드 = i.품목코드
    LEFT JOIN warehouses w ON p.창고코드 = w.창고코드
    WHERE substr(p.일자, 1, 7) = '2026-03'
      AND i.품목그룹1코드 = 'IL'
      AND p.거래처코드 = 'PR00061'
    GROUP BY 1
  `;

  console.log('Checking March IL purchases by warehouse...');
  const res = await executeSQL(query);
  console.table(res?.rows || []);
}

main().catch(console.error);
