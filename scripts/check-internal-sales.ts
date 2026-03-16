import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== Sales to subsidiary companies (영일오엔씨) ===');
  const subsidiarySales = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      cat.거래처그룹2,
      COUNT(*) as sale_count,
      MIN(s.일자) as first_sale,
      MAX(s.일자) as last_sale
    FROM sales s
    JOIN clients c ON s.거래처코드 = c.거래처코드
    LEFT JOIN company_type_auto cat ON c.업종분류코드 = cat.업종분류코드
    WHERE c.거래처명 LIKE '%영일오엔씨%'
       OR c.업종분류코드 IN (28400, 28410, 28420)
    GROUP BY c.거래처코드, c.거래처명, c.업종분류코드, cat.거래처그룹2
    ORDER BY c.업종분류코드, c.거래처명
  `);
  console.log(subsidiarySales?.rows);

  console.log('\n=== Check if 중부 subsidiary exists in clients ===');
  const jungbuSubsidiary = await executeSQL(`
    SELECT *
    FROM clients
    WHERE 거래처명 LIKE '%영일오엔씨%중부%'
       OR 거래처명 LIKE '%중부지사%'
  `);
  console.log(jungbuSubsidiary?.rows);

  console.log('\n=== All clients with 영일 in name ===');
  const allYoungilClients = await executeSQL(`
    SELECT
      거래처코드,
      거래처명,
      업종분류코드
    FROM clients
    WHERE 거래처명 LIKE '%영일%'
    ORDER BY 거래처명
  `);
  console.log(allYoungilClients?.rows);

  console.log('\n=== Check for 사무실 clients in AUTO segment ===');
  const officeClients = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      COUNT(*) as sale_count
    FROM clients c
    LEFT JOIN sales s ON c.거래처코드 = s.거래처코드
    WHERE c.거래처명 LIKE '%사무실%'
      AND c.업종분류코드 >= 28000
    GROUP BY c.거래처코드, c.거래처명, c.업종분류코드
    ORDER BY sale_count DESC
  `);
  console.log(officeClients?.rows);

  console.log('\n=== Summary: Classification breakdown ===');
  const summary = await executeSQL(`
    SELECT
      CASE
        WHEN c.업종분류코드 IN (28600, 28610, 28710) THEN 'Fleet'
        WHEN c.업종분류코드 IN (28500, 28510) OR c.거래처명 LIKE '%사무실%' THEN '딜러'
        WHEN c.업종분류코드 = 28400 THEN '동부'
        WHEN c.업종분류코드 = 28410 THEN '서부'
        WHEN c.업종분류코드 = 28420 THEN '남부'
        WHEN c.업종분류코드 >= 28000 AND c.업종분류코드 < 29000 THEN 'LCC'
        ELSE 'Other'
      END as classification,
      COUNT(DISTINCT s.id) as sale_transactions,
      COUNT(DISTINCT c.거래처코드) as unique_clients
    FROM sales s
    LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
    WHERE c.업종분류코드 >= 28000 AND c.업종분류코드 < 29000
    GROUP BY classification
    ORDER BY classification
  `);
  console.log(summary?.rows);
}

main().catch(console.error);
