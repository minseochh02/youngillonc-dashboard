import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Check for 업종분류코드 28430 ===');
  const code28430 = await executeSQL(`
    SELECT *
    FROM clients
    WHERE 업종분류코드 = 28430
  `);
  console.log(code28430?.rows);

  console.log('\n=== Check for any codes in 28430-28439 range ===');
  const range28430 = await executeSQL(`
    SELECT DISTINCT 업종분류코드, COUNT(*) as count
    FROM clients
    WHERE 업종분류코드 >= 28430 AND 업종분류코드 < 28440
    GROUP BY 업종분류코드
  `);
  console.log(range28430?.rows);

  console.log('\n=== Search for clients with "중부" in name ===');
  const jungbuClients = await executeSQL(`
    SELECT
      거래처코드,
      거래처명,
      업종분류코드
    FROM clients
    WHERE 거래처명 LIKE '%중부%'
    ORDER BY 거래처명
  `);
  console.log(jungbuClients?.rows);

  console.log('\n=== Search for "영일오엔씨 중부" or similar ===');
  const youngilJungbu = await executeSQL(`
    SELECT *
    FROM clients
    WHERE (거래처명 LIKE '%영일%' AND 거래처명 LIKE '%중부%')
       OR 거래처명 LIKE '%영일오엔씨%중부%'
       OR 거래처명 LIKE '%영일 오엔씨%중부%'
  `);
  console.log(youngilJungbu?.rows);

  console.log('\n=== Check all subsidiary patterns (동부/서부/남부/중부) ===');
  const subsidiaryPatterns = await executeSQL(`
    SELECT
      거래처코드,
      거래처명,
      업종분류코드
    FROM clients
    WHERE 거래처명 LIKE '%영일오엔씨%'
       OR 거래처명 LIKE '%영일 오엔씨%'
    ORDER BY 거래처명
  `);
  console.log(subsidiaryPatterns?.rows);

  console.log('\n=== Check sales to any "중부" clients ===');
  const jungbuSales = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      COUNT(*) as sale_count,
      MIN(s.일자) as first_sale,
      MAX(s.일자) as last_sale
    FROM sales s
    JOIN clients c ON s.거래처코드 = c.거래처코드
    WHERE c.거래처명 LIKE '%중부%'
    GROUP BY c.거래처코드, c.거래처명, c.업종분류코드
    ORDER BY sale_count DESC
  `);
  console.log(jungbuSales?.rows);

  console.log('\n=== Check if 28430 exists in company_type_auto table ===');
  const autoTable28430 = await executeSQL(`
    SELECT *
    FROM company_type_auto
    WHERE 업종분류코드 = 28430
  `);
  console.log(autoTable28430?.rows);

  console.log('\n=== All codes in 28400-28499 range from company_type_auto ===');
  const autoTableRange = await executeSQL(`
    SELECT *
    FROM company_type_auto
    WHERE 업종분류코드 >= 28400 AND 업종분류코드 < 28500
    ORDER BY 업종분류코드
  `);
  console.log(autoTableRange?.rows);
}

main().catch(console.error);
