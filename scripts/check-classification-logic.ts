import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== company_type table - Sample records ===');
  const companyTypes = await executeSQL(`
    SELECT *
    FROM company_type
    ORDER BY 업종분류코드
    LIMIT 50
  `);
  console.log(JSON.stringify(companyTypes?.rows, null, 2));

  console.log('\n=== Unique 모빌분류 values in company_type ===');
  const mobilTypes = await executeSQL(`
    SELECT DISTINCT 모빌분류, COUNT(*) as count
    FROM company_type
    WHERE 모빌분류 IS NOT NULL
    GROUP BY 모빌분류
    ORDER BY 모빌분류
  `);
  console.log(mobilTypes?.rows);

  console.log('\n=== Sample clients with AUTO classification (28xxx codes) ===');
  const autoClients = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      cat.모빌_대시보드채널,
      cat.거래처그룹2,
      ct.모빌분류
    FROM clients c
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
    WHERE c.업종분류코드 >= 28000 AND c.업종분류코드 < 29000
    ORDER BY c.업종분류코드, c.거래처명
    LIMIT 50
  `);
  console.log(JSON.stringify(autoClients?.rows, null, 2));

  console.log('\n=== Check client names containing 사무실 (office) ===');
  const offices = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      cat.모빌_대시보드채널,
      cat.거래처그룹2
    FROM clients c
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    WHERE c.거래처명 LIKE '%사무실%'
    LIMIT 20
  `);
  console.log(offices?.rows);

  console.log('\n=== Check client names containing 개인 (individual) ===');
  const individuals = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      cat.모빌_대시보드채널,
      cat.거래처그룹2
    FROM clients c
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    WHERE c.거래처명 LIKE '%개인%'
    LIMIT 20
  `);
  console.log(individuals?.rows);

  console.log('\n=== Check 업종분류코드 28900 (기타) clients ===');
  const etc = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드
    FROM clients c
    WHERE c.업종분류코드 = 28900
    LIMIT 20
  `);
  console.log(etc?.rows);

  console.log('\n=== Check 업종분류코드 28500, 28510 (딜러) clients ===');
  const dealers = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      cat.거래처그룹2
    FROM clients c
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    WHERE c.업종분류코드 IN (28500, 28510)
    LIMIT 20
  `);
  console.log(dealers?.rows);

  console.log('\n=== Check Fleet classification (28600, 28610, 28710) clients ===');
  const fleet = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      cat.거래처그룹2
    FROM clients c
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    WHERE c.업종분류코드 IN (28600, 28610, 28710)
    LIMIT 20
  `);
  console.log(fleet?.rows);
}

main().catch(console.error);
