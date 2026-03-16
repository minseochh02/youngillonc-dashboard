import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Check employee_category for 중부 ===');
  const branches = await executeSQL(`
    SELECT DISTINCT 전체사업소
    FROM employee_category
    WHERE 전체사업소 IS NOT NULL
    ORDER BY 전체사업소
  `);
  console.log(branches?.rows);

  console.log('\n=== Check for 중부 specifically ===');
  const jungbu = await executeSQL(`
    SELECT *
    FROM employee_category
    WHERE 전체사업소 LIKE '%중부%'
  `);
  console.log(jungbu?.rows);

  console.log('\n=== Check for 동부, 서부, 남부 in employee_category ===');
  const regionalBranches = await executeSQL(`
    SELECT 담당자, 전체사업소
    FROM employee_category
    WHERE 전체사업소 LIKE '%동부%'
       OR 전체사업소 LIKE '%서부%'
       OR 전체사업소 LIKE '%중부%'
       OR 전체사업소 LIKE '%남부%'
    ORDER BY 전체사업소
  `);
  console.log(regionalBranches?.rows);

  console.log('\n=== Check clients assigned to 중부사업소 ===');
  const jungbuClients = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      ec.전체사업소
    FROM clients c
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE ec.전체사업소 LIKE '%중부%'
    LIMIT 20
  `);
  console.log(jungbuClients?.rows);
}

main().catch(console.error);
