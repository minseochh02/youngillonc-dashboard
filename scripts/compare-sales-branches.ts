
import { executeSQL, getTableSchema } from '../egdesk-helpers';

async function main() {
  console.log('--- Sales Table Schema ---');
  try {
    const schema = await getTableSchema('sales');
    console.log(JSON.stringify(schema, null, 2));

    const query = `
      SELECT
        일자, 거래처코드, 품목코드, 공급가액, 합계, 적요
      FROM east_division_sales
      WHERE 일자 LIKE '2026-02-%'
      ORDER BY 공급가액 DESC
      LIMIT 20;
    `;

    console.log('\n--- Comparing Branches (2026-02-26 ~ 2026-02-28) ---');
    const result = await executeSQL(query);
    console.table(result.rows);

    // Calculate totals for summary
    const total = result.rows.reduce((sum: number, row: any) => sum + (row.총매출액 || 0), 0);
    console.log(`\nCombined Total Sales: ${total.toLocaleString()}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
