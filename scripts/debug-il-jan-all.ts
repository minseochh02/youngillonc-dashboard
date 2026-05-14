import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      p.거래처코드,
      c.거래처명,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM purchases p
    LEFT JOIN items i ON p.품목코드 = i.품목코드
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    WHERE substr(p.일자, 1, 7) = '2026-01'
      AND i.품목그룹1코드 = 'IL'
    GROUP BY 1, 2
    ORDER BY weight DESC
  `;

  console.log('All IL purchases for Jan 2026:');
  const result = await executeSQL(query);
  const rows = result?.rows || [];
  
  console.table(rows.map((r: any) => ({
    'Vendor Code': r.거래처코드,
    'Vendor Name': r.거래처명,
    'Weight': Number(r.weight).toLocaleString('ko-KR')
  })));
}

main().catch(console.error);
