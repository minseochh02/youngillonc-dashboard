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
  console.log(`🔍 Checking January Sales Liters for Auto Flagship...`);

  const query = `
    SELECT 
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_liters
    FROM sales s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 IN ('PVL', 'CVL')
      AND i.품목그룹3코드 = 'FLA'
      AND s.일자 LIKE '2026-01%'
  `;

  const result = await executeSQL(query);
  console.log('\n📊 Total Auto Flagship Liters Sold in January:', result.rows[0]?.total_liters);
}

main().catch(console.error);
