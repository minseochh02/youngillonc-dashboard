import { executeSQL } from './egdesk-helpers';

async function debug() {
  try {
    const date = '2026-02-04'; // Using the date from the page state
    console.log(`Debugging for date: ${date}`);

    const purchaseCheck = await executeSQL(`
      SELECT 
        p.창고코드,
        w.창고명,
        COUNT(*) as count
      FROM purchases p
      LEFT JOIN warehouses w ON p.창고코드 = w.창고코드
      WHERE p.일자 = '${date}'
      GROUP BY 1, 2
    `);
    console.log('Purchase Warehouse Join Results:', JSON.stringify(purchaseCheck.rows, null, 2));

    const allWarehouses = await executeSQL(`SELECT 창고코드, 창고명 FROM warehouses`);
    console.log('All Warehouses:', JSON.stringify(allWarehouses.rows, null, 2));

  } catch (e) {
    console.error('Debug failed:', e);
  }
}

debug();
