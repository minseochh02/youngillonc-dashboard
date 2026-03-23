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
  console.log(`🔍 Checking January Purchases for Auto category...`);

  const query = `
    SELECT 
      SUM(CAST(REPLACE(p.수량, ',', '') AS NUMERIC)) as total_qty
    FROM purchases p
    LEFT JOIN items i ON p.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 IN ('PVL', 'CVL')
      AND p.일자 LIKE '2026-01%'
  `;

  const result = await executeSQL(query);
  console.log('\n📊 Total Auto Quantity Purchased in January:', result.rows[0]?.total_qty);
}

main().catch(console.error);
