import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';
import { 
  sqlAndEmployeeNotSpecialHandling, 
  sqlAndSalesRemarkNotExact,
  sqlMeetingPurchaseIncludedClientPredicate
} from '../src/lib/special-handling-employees';

async function main() {
  const query = `
    SELECT
      (SELECT SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC))
       FROM purchases p
       LEFT JOIN items i ON p.품목코드 = i.품목코드
       WHERE substr(p.일자, 1, 4) = '2025'
         AND i.품목그룹1코드 = 'IL'
         AND ${sqlMeetingPurchaseIncludedClientPredicate('p.거래처코드')}
      ) as purchase,
      (SELECT SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))
       FROM (
         SELECT 일자, 품목코드, 중량, 적요, 거래처코드, 담당자코드 FROM sales
         UNION ALL
         SELECT 일자, 품목코드, 중량, 적요, 거래처코드, 담당자코드 FROM east_division_sales
         UNION ALL
         SELECT 일자, 품목코드, 중량, 적요, 거래처코드, 담당자코드 FROM west_division_sales
       ) s
       LEFT JOIN items i ON s.품목코드 = i.품목코드
       LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
       LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
       WHERE substr(s.일자, 1, 4) = '2025'
         AND i.품목그룹1코드 = 'IL'
         ${sqlAndEmployeeNotSpecialHandling()}
         ${sqlAndSalesRemarkNotExact('s.적요')}
      ) as sales
  `;

  console.log('Checking IL 2025 total flows...');
  const res = await executeSQL(query);
  console.table(res?.rows || []);
}

main().catch(console.error);
