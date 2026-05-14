import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      substr(p.일자, 1, 7) as month,
      p.거래처코드,
      c.거래처명,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM purchases p
    LEFT JOIN items i ON p.품목코드 = i.품목코드
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    WHERE p.일자 BETWEEN '2026-01-01' AND '2026-03-31'
      AND p.거래처코드 != 'PR00061'
      AND i.품목그룹1코드 = 'IL'
    GROUP BY 1, 2, 3
    ORDER BY month, weight DESC
  `;

  console.log('IL purchases outside of PR00061 for Q1 2026:');
  const result = await executeSQL(query);
  const rows = result?.rows || [];
  
  console.table(rows.map((r: any) => ({
    Month: r.month,
    'Vendor Code': r.거래처코드,
    'Vendor Name': r.거래처명,
    'Weight': Number(r.weight).toLocaleString('ko-KR')
  })));

  const total = rows.reduce((sum: number, r: any) => sum + Number(r.weight), 0);
  console.log(`\nGrand Total Weight (Non-PR00061): ${Number(total).toLocaleString('ko-KR')}`);
}

main().catch(console.error);
