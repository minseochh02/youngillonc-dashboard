import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== ALL subsidiary client records (동부/서부/남부) ===');
  const subsidiaries = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      c.담당자코드,
      c.지역코드,
      cat.거래처그룹2,
      cat.오토_대분류
    FROM clients c
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    WHERE c.업종분류코드 IN (28400, 28410, 28420)
    ORDER BY c.업종분류코드, c.거래처코드
  `);
  console.log(JSON.stringify(subsidiaries?.rows, null, 2));

  console.log('\n=== Check 거래처코드 pattern ===');
  const codePattern = await executeSQL(`
    SELECT
      거래처코드,
      거래처명,
      업종분류코드,
      SUBSTR(거래처코드, 1, 2) as code_prefix
    FROM clients
    WHERE 업종분류코드 IN (28400, 28410, 28420)
    ORDER BY 거래처코드
  `);
  console.log(codePattern?.rows);

  console.log('\n=== Look for pattern: YI90xxx or YI15xxx ===');
  const yiPattern = await executeSQL(`
    SELECT
      거래처코드,
      거래처명,
      업종분류코드
    FROM clients
    WHERE (거래처코드 LIKE 'YI90%' OR 거래처코드 LIKE 'YI15%')
      AND 거래처명 LIKE '%영일오엔씨%'
    ORDER BY 거래처코드
  `);
  console.log(yiPattern?.rows);

  console.log('\n=== Check if there are YI90002 or YI15003 codes ===');
  const missingCodes = await executeSQL(`
    SELECT
      거래처코드,
      거래처명,
      업종분류코드
    FROM clients
    WHERE 거래처코드 IN ('YI90002', 'YI15003', 'YI15001', 'YI90003')
    ORDER BY 거래처코드
  `);
  console.log(missingCodes?.rows);

  console.log('\n=== Check all YI90xxx clients ===');
  const allYI90 = await executeSQL(`
    SELECT
      거래처코드,
      거래처명,
      업종분류코드
    FROM clients
    WHERE 거래처코드 LIKE 'YI90%'
    ORDER BY 거래처코드
  `);
  console.log(allYI90?.rows);

  console.log('\n=== Sales volume to each subsidiary ===');
  const salesVolume = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      cat.거래처그룹2,
      COUNT(DISTINCT s.일자) as days_with_sales,
      COUNT(*) as total_transactions,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
    FROM sales s
    JOIN clients c ON s.거래처코드 = c.거래처코드
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    WHERE c.업종분류코드 IN (28400, 28410, 28420)
    GROUP BY c.거래처코드, c.거래처명, c.업종분류코드, cat.거래처그룹2
    ORDER BY c.업종분류코드, total_transactions DESC
  `);
  console.log(salesVolume?.rows);

  console.log('\n=== Check if there are any clients with 업종분류코드 = null and name like 영일오엔씨 ===');
  const nullCode = await executeSQL(`
    SELECT *
    FROM clients
    WHERE 거래처명 LIKE '%영일오엔씨%'
      AND (업종분류코드 IS NULL OR 업종분류코드 = 0)
  `);
  console.log(nullCode?.rows);
}

main().catch(console.error);
