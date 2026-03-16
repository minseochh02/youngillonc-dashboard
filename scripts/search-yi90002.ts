import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Check for YI90002 specifically ===');
  const yi90002 = await executeSQL(`
    SELECT *
    FROM clients
    WHERE 거래처코드 = 'YI90002' OR 거래처코드 LIKE 'YI90002%'
  `);
  console.log(yi90002?.rows);

  console.log('\n=== Check all codes between YI90000 and YI90010 ===');
  const range = await executeSQL(`
    SELECT *
    FROM clients
    WHERE 거래처코드 >= 'YI90000' AND 거래처코드 < 'YI90010'
    ORDER BY 거래처코드
  `);
  console.log(range?.rows);

  console.log('\n=== Check for YI15xxx pattern that might be 중부 ===');
  const yi15Pattern = await executeSQL(`
    SELECT *
    FROM clients
    WHERE 거래처코드 LIKE 'YI15%'
      AND (거래처명 LIKE '%중부%' OR 거래처명 LIKE '%영일%')
    ORDER BY 거래처코드
  `);
  console.log(yi15Pattern?.rows);

  console.log('\n=== Check GJxxxxx pattern for subsidiaries ===');
  const gjPattern = await executeSQL(`
    SELECT *
    FROM clients
    WHERE 거래처명 LIKE '%영일오엔씨%'
      AND 거래처코드 LIKE 'GJ%'
    ORDER BY 거래처코드
  `);
  console.log(gjPattern?.rows);

  console.log('\n=== Search all possible variations ===');
  const allVariations = await executeSQL(`
    SELECT
      거래처코드,
      거래처명,
      업종분류코드
    FROM clients
    WHERE 거래처명 LIKE '%영일%'
      AND (
        거래처명 LIKE '%중부%'
        OR 거래처명 LIKE '%central%'
        OR 거래처명 LIKE '%jungbu%'
      )
    ORDER BY 거래처코드
  `);
  console.log(allVariations?.rows);

  console.log('\n=== Check if 28430 exists anywhere in the database ===');
  const code28430Anywhere = await executeSQL(`
    SELECT 'clients' as source, COUNT(*) as count FROM clients WHERE 업종분류코드 = 28430
    UNION ALL
    SELECT 'company_type_auto' as source, COUNT(*) as count FROM company_type_auto WHERE 업종분류코드 = 28430
    UNION ALL
    SELECT 'company_type' as source, COUNT(*) as count FROM company_type WHERE 업종분류코드 = 28430
  `);
  console.log(code28430Anywhere?.rows);
}

main().catch(console.error);
