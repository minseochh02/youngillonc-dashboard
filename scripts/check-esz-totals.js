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
  console.log(`🔍 Checking total quantities in esz018r__6_...`);

  const query = `
    SELECT 
      SUM(CAST(REPLACE(재고수량, ',', '') AS NUMERIC)) as total_qty
    FROM esz018r__6_
  `;

  const result = await executeSQL(query);
  console.log('\n📊 Total Quantity for ALL items in esz018r__6_:', result.rows[0]?.total_qty);

  // Check breakdown by 품목그룹1코드
  const breakdownQuery = `
    SELECT 
      p.품목그룹1코드,
      SUM(CAST(REPLACE(e.재고수량, ',', '') AS NUMERIC)) as total_qty
    FROM esz018r__6_ e
    LEFT JOIN items p ON e.품목코드 = p.품목코드
    GROUP BY 1
  `;
  const breakdown = await executeSQL(breakdownQuery);
  console.log('\n📊 Breakdown by Category Code:');
  console.table(breakdown.rows);
}

main().catch(console.error);
