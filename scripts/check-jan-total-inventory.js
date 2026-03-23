const API_URL = 'http://localhost:8080';
const API_KEY = '901ff376-242e-417e-939a-120598b4e7c7';

async function executeSQL(query) {
  const body = JSON.stringify({
    tool: 'user_data_sql_query',
    arguments: { query }
  });

  const response = await fetch(`${API_URL}/user-data/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY
    },
    body
  });

  const result = await response.json();
  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

async function main() {
  const date = '2026-01-31';
  console.log(`🔍 Checking TOTAL inventory quantity for ALL items on ${date}...`);

  const query = `
    SELECT 
      SUM(CAST(REPLACE(재고수량, ',', '') AS NUMERIC)) as total_qty
    FROM inventory
    WHERE DATE(imported_at) = '${date}'
  `;

  const result = await executeSQL(query);
  console.log('\n📊 Total Inventory Qty (All items) on Jan 31st:', result.rows[0]?.total_qty);
}

main().catch(console.error);
