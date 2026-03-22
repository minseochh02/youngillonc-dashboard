const { executeSQL } = require('./egdesk-helpers');

async function debug() {
  try {
    const date = '2026-02-04';
    const result = await executeSQL(`
      SELECT 
        창고코드,
        COUNT(*) as count
      FROM purchases
      WHERE 일자 = '${date}'
      GROUP BY 1
    `);
    console.log('Purchases for 2026-02-04:', JSON.stringify(result.rows, null, 2));
    
    const warehouses = await executeSQL(`SELECT 창고코드, 창고명 FROM warehouses`);
    console.log('Warehouses:', JSON.stringify(warehouses.rows, null, 2));
  } catch (e) {
    console.error(e);
  }
}

debug();
