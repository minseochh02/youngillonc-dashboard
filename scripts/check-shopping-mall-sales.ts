import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== All tables in database ===');
  const allTables = await executeSQL(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `);
  console.log(JSON.stringify(allTables?.rows, null, 2));

  console.log('\n=== Search for tables with "쇼핑" or "shopping" or "mall" ===');
  const shoppingTables = await executeSQL(`
    SELECT name
    FROM sqlite_master
    WHERE type='table'
      AND (name LIKE '%쇼핑%'
           OR name LIKE '%shopping%'
           OR name LIKE '%mall%'
           OR name LIKE '%온라인%'
           OR name LIKE '%online%'
           OR name LIKE '%웹%'
           OR name LIKE '%web%')
  `);
  console.log(shoppingTables?.rows);

  console.log('\n=== Check clients for shopping mall/online related names ===');
  const shoppingClients = await executeSQL(`
    SELECT
      거래처코드,
      거래처명,
      업종분류코드
    FROM clients
    WHERE 거래처명 LIKE '%쇼핑%'
       OR 거래처명 LIKE '%온라인%'
       OR 거래처명 LIKE '%몰%'
       OR 거래처명 LIKE '%웹%'
       OR 거래처명 LIKE '%인터넷%'
    LIMIT 30
  `);
  console.log(shoppingClients?.rows);

  console.log('\n=== Check company_type_auto for 웹샵 (webshop) ===');
  const webshop = await executeSQL(`
    SELECT *
    FROM company_type_auto
    WHERE 거래처그룹2 = '웹샵'
       OR 거래처그룹2 LIKE '%쇼핑%'
       OR 거래처그룹2 LIKE '%온라인%'
  `);
  console.log(webshop?.rows);

  console.log('\n=== Check if 업종분류코드 28800 (인터넷/웹샵) has sales ===');
  const webshopSales = await executeSQL(`
    SELECT
      c.거래처코드,
      c.거래처명,
      c.업종분류코드,
      COUNT(s.id) as sales_count,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
    FROM clients c
    LEFT JOIN sales s ON c.거래처코드 = s.거래처코드
    WHERE c.업종분류코드 = 28800
    GROUP BY c.거래처코드, c.거래처명, c.업종분류코드
  `);
  console.log(webshopSales?.rows);
}

main().catch(console.error);
