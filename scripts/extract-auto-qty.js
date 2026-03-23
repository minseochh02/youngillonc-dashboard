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
  console.log(`🔍 Extracting quantities for all Auto (PVL, CVL) items in esz018r__6_...`);

  const query = `
    SELECT 
      e.품목코드,
      p.품목명,
      p.품목그룹1코드,
      SUM(CAST(REPLACE(e.재고수량, ',', '') AS NUMERIC)) as qty
    FROM esz018r__6_ e
    LEFT JOIN items p ON e.품목코드 = p.품목코드
    WHERE p.품목그룹1코드 IN ('PVL', 'CVL')
    GROUP BY 1, 2, 3
    ORDER BY qty DESC
  `;

  const result = await executeSQL(query);
  console.table(result.rows);
  
  const total = result.rows.reduce((acc, r) => acc + (r.qty || 0), 0);
  console.log('\n🌟 TOTAL AUTO QUANTITY:', total);
}

main().catch(console.error);
