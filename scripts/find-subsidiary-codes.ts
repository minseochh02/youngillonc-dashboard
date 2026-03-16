import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== All subsidiary codes (자회사) from company_type_auto ===');
  const subsidiaries = await executeSQL(`
    SELECT *
    FROM company_type_auto
    WHERE 오토_대분류 = '자회사'
    ORDER BY 업종분류코드
  `);
  console.log(subsidiaries?.rows);

  console.log('\n=== Check for 중부 in 거래처그룹2 ===');
  const jungbu = await executeSQL(`
    SELECT *
    FROM company_type_auto
    WHERE 거래처그룹2 LIKE '%중부%'
  `);
  console.log(jungbu?.rows);

  console.log('\n=== Check all AUTO codes in range 28400-28499 ===');
  const autoSubsidiaries = await executeSQL(`
    SELECT *
    FROM company_type_auto
    WHERE 업종분류코드 >= 28400 AND 업종분류코드 < 28500
    ORDER BY 업종분류코드
  `);
  console.log(autoSubsidiaries?.rows);

  console.log('\n=== Clients with subsidiary 업종분류코드 ===');
  const subsidiaryClients = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      cat.거래처그룹2
    FROM clients c
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    WHERE c.업종분류코드 IN (28400, 28410, 28420)
    LIMIT 30
  `);
  console.log(subsidiaryClients?.rows);

  console.log('\n=== Summary: All 모빌_대시보드채널 categories ===');
  const summary = await executeSQL(`
    SELECT
      COALESCE(cat.모빌_대시보드채널, '(null - 자회사)') as channel,
      cat.오토_대분류,
      GROUP_CONCAT(DISTINCT cat.거래처그룹2) as groups,
      COUNT(DISTINCT c.거래처코드) as client_count
    FROM company_type_auto cat
    LEFT JOIN clients c ON cat.업종분류코드 = c.업종분류코드
    GROUP BY cat.모빌_대시보드채널, cat.오토_대분류
    ORDER BY cat.모빌_대시보드채널
  `);
  console.log(summary?.rows);
}

main().catch(console.error);
