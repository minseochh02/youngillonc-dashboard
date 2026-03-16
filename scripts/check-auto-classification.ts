import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== company_type_auto table - ALL RECORDS ===');
  const allRecords = await executeSQL(`
    SELECT *
    FROM company_type_auto
    ORDER BY 모빌_대시보드채널, 업종분류코드
  `);
  console.log(JSON.stringify(allRecords?.rows, null, 2));

  console.log('\n=== Unique 모빌_대시보드채널 values ===');
  const channels = await executeSQL(`
    SELECT
      모빌_대시보드채널,
      COUNT(*) as count
    FROM company_type_auto
    GROUP BY 모빌_대시보드채널
    ORDER BY 모빌_대시보드채널
  `);
  console.log(channels?.rows);

  console.log('\n=== Sample: 업종분류코드 by 모빌_대시보드채널 ===');
  const byChannel = await executeSQL(`
    SELECT
      모빌_대시보드채널,
      GROUP_CONCAT(업종분류코드, ', ') as 업종분류codes
    FROM company_type_auto
    GROUP BY 모빌_대시보드채널
    ORDER BY 모빌_대시보드채널
  `);
  console.log(byChannel?.rows);

  console.log('\n=== Sample clients with 업종분류코드 (first 30) ===');
  const clients = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      cat.모빌_대시보드채널
    FROM clients c
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    WHERE c.업종분류코드 IS NOT NULL
    ORDER BY cat.모빌_대시보드채널, c.거래처명
    LIMIT 30
  `);
  console.log(clients?.rows);

  console.log('\n=== Check: 사무실 (office) 업종분류코드 ===');
  const offices = await executeSQL(`
    SELECT *
    FROM company_type_auto
    WHERE 업종분류코드 LIKE '%사무%' OR 업종분류코드 LIKE '%오피스%'
  `);
  console.log(offices?.rows);

  console.log('\n=== Check: 개인 (individual) 업종분류코드 ===');
  const individuals = await executeSQL(`
    SELECT *
    FROM company_type_auto
    WHERE 업종분류코드 LIKE '%개인%' OR 업종분류코드 LIKE '%기타%'
  `);
  console.log(individuals?.rows);
}

main().catch(console.error);
