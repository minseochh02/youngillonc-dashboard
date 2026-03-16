import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== employee_category table (has b2b사업소, 전체사업소) ===');
  const empCat = await executeSQL(`SELECT * FROM employee_category LIMIT 10`);
  console.log(JSON.stringify(empCat?.rows, null, 2));

  console.log('\n=== company_type_auto table (has 모빌_대시보드채널) ===');
  const compTypeAuto = await executeSQL(`SELECT * FROM company_type_auto LIMIT 10`);
  console.log(JSON.stringify(compTypeAuto?.rows, null, 2));

  console.log('\n=== How clients relate to these tables ===');
  const clientSample = await executeSQL(`
    SELECT 
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      c.담당자코드,
      ca.모빌_대시보드채널,
      ca.오토_대분류
    FROM clients c
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    LIMIT 10
  `);
  console.log(JSON.stringify(clientSample?.rows, null, 2));

  console.log('\n=== Check sales with proper joins ===');
  const salesWithBranch = await executeSQL(`
    SELECT 
      s.일자,
      c.거래처명,
      ca.모빌_대시보드채널 as branch,
      COUNT(*) as count,
      SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as total
    FROM sales s
    LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE s.일자 = '2026-02-03'
    GROUP BY s.일자, c.거래처명, ca.모빌_대시보드채널
    LIMIT 20
  `);
  console.log(JSON.stringify(salesWithBranch?.rows, null, 2));
}

main().catch(console.error);
