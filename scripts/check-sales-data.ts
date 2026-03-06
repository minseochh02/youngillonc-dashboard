import { executeSQL } from '../egdesk-helpers';

async function checkSalesData() {
  console.log('Checking sales data...\n');

  // Check date range
  const dateQuery = await executeSQL(
    "SELECT MIN(일자) as min_date, MAX(일자) as max_date, COUNT(*) as total_rows FROM sales"
  );
  console.log('Date range:', dateQuery);

  // Check recent dates
  const recentDates = await executeSQL(
    "SELECT 일자, COUNT(*) as count FROM sales GROUP BY 일자 ORDER BY 일자 DESC LIMIT 10"
  );
  console.log('\nRecent dates:', recentDates);

  // Check 거래처그룹1코드명 values
  const branchValues = await executeSQL(
    "SELECT DISTINCT 거래처그룹1코드명, COUNT(*) as count FROM sales GROUP BY 거래처그룹1코드명 LIMIT 20"
  );
  console.log('\n거래처그룹1코드명 values:', branchValues);

  // Check March 2026 specifically
  const marchData = await executeSQL(
    "SELECT COUNT(*) as count FROM sales WHERE 일자 BETWEEN '2026-03-01' AND '2026-03-31'"
  );
  console.log('\nMarch 2026 data:', marchData);
}

checkSalesData().catch(console.error);
