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
  console.log(`🔍 Inspecting first row of esz018r__6_...`);
  const row = await executeSQL(`SELECT * FROM esz018r__6_ LIMIT 1`);
  console.log('First row:', JSON.stringify(row.rows[0], null, 2));

  console.log(`\n🔍 Checking for Auto items (PVL, CVL) in esz018r__6_...`);
  const query = `
    SELECT 
      p.품목그룹1코드,
      COUNT(*) as item_count,
      SUM(CAST(REPLACE(e.재고수량, ',', '') AS NUMERIC)) as total_qty
    FROM esz018r__6_ e
    LEFT JOIN items p ON e.품목코드 = p.품목코드
    WHERE p.품목그룹1코드 IN ('PVL', 'CVL')
    GROUP BY 1
  `;
  const result = await executeSQL(query);
  console.table(result.rows);
}

main().catch(console.error);
