import { executeSQL } from '../egdesk-helpers';

async function main() {
  console.log('=== CLIENTS TABLE - 지역코드 values ===');
  const regions = await executeSQL(`
    SELECT DISTINCT 지역코드, COUNT(*) as count
    FROM clients
    WHERE 지역코드 IS NOT NULL
    GROUP BY 지역코드
    ORDER BY count DESC
    LIMIT 20
  `);
  console.log(regions?.rows);

  console.log('\n=== ITEMS TABLE - 품목그룹1코드 values ===');
  const group1 = await executeSQL(`
    SELECT DISTINCT 품목그룹1코드, COUNT(*) as count
    FROM items
    WHERE 품목그룹1코드 IS NOT NULL
    GROUP BY 품목그룹1코드
    ORDER BY count DESC
  `);
  console.log(group1?.rows);

  console.log('\n=== ITEMS TABLE - 품목그룹3코드 values ===');
  const group3 = await executeSQL(`
    SELECT DISTINCT 품목그룹3코드, COUNT(*) as count
    FROM items
    WHERE 품목그룹3코드 IS NOT NULL
    GROUP BY 품목그룹3코드
    ORDER BY count DESC
  `);
  console.log(group3?.rows);

  console.log('\n=== WAREHOUSES TABLE - 창고명 values ===');
  const warehouses = await executeSQL(`
    SELECT DISTINCT 창고명
    FROM warehouses
    WHERE 창고명 IS NOT NULL
    ORDER BY 창고명
  `);
  console.log(warehouses?.rows);

  console.log('\n=== SALES TABLE - Check what 지역코드 values exist in actual sales ===');
  const salesRegions = await executeSQL(`
    SELECT 
      c.지역코드,
      COUNT(*) as sales_count,
      MIN(s.일자) as first_date,
      MAX(s.일자) as last_date
    FROM sales s
    LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
    GROUP BY c.지역코드
    ORDER BY sales_count DESC
    LIMIT 20
  `);
  console.log(salesRegions?.rows);
}

main().catch(console.error);
