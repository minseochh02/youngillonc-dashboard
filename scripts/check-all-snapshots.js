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
  console.log(`🔍 Checking Auto Category totals across all snapshots in inventory table...`);

  const query = `
    SELECT 
      DATE(i.imported_at) as import_date,
      SUM(CAST(REPLACE(i.재고수량, ',', '') AS NUMERIC)) as total_qty
    FROM inventory i
    LEFT JOIN items p ON i.품목코드 = p.품목코드
    WHERE p.품목그룹1코드 IN ('PVL', 'CVL')
    GROUP BY 1
    ORDER BY import_date DESC
  `;

  const result = await executeSQL(query);
  console.table(result.rows);
}

main().catch(console.error);
