import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';
import { 
  sqlAndEmployeeNotSpecialHandling, 
  sqlAndSalesRemarkNotExact
} from '../src/lib/special-handling-employees';

async function main() {
  const months = ['2026-01', '2026-02', '2026-03'];
  const category = 'IL';

  for (const month of months) {
    const query = `
      SELECT
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
      WHERE substr(s.일자, 1, 7) = '${month}'
        AND i.품목그룹1코드 = '${category}'
        ${sqlAndEmployeeNotSpecialHandling()}
        ${sqlAndSalesRemarkNotExact('s.적요')}
    `;

    console.log(`Checking main filtered IL sales for ${month}...`);
    const res = await executeSQL(query);
    console.table(res?.rows || []);
  }
}

main().catch(console.error);
