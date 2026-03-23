import { executeSQL } from './egdesk-helpers';

async function checkItemsSpec() {
  const result = await executeSQL(`
    SELECT 품목코드, 품목명, 규격정보 
    FROM items 
    WHERE 규격정보 IS NOT NULL AND 규격정보 != ''
    LIMIT 20
  `);
  console.log(JSON.stringify(result.rows, null, 2));
}

checkItemsSpec().catch(console.error);
