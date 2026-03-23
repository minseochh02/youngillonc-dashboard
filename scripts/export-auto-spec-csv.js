const API_URL = 'http://localhost:8080';
const API_KEY = '901ff376-242e-417e-939a-120598b4e7c7';
const fs = require('fs');

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
  console.log(`🔍 Exporting Auto products by Spec from esz018r__6_ to CSV...`);

  const query = `
    SELECT 
      COALESCE(p.규격정보, 'Unknown') as spec,
      COUNT(DISTINCT e.품목코드) as distinct_products,
      SUM(CAST(REPLACE(e.재고수량, ',', '') AS NUMERIC)) as total_qty
    FROM esz018r__6_ e
    LEFT JOIN items p ON e.품목코드 = p.품목코드
    WHERE p.품목그룹1코드 IN ('PVL', 'CVL')
    GROUP BY 1
    ORDER BY total_qty DESC
  `;

  const result = await executeSQL(query);
  
  if (!result || !result.rows) {
    console.error('No data found');
    return;
  }

  const csvHeader = 'Specification,Distinct Products,Total Quantity (ea)\n';
  const csvRows = result.rows.map(row => 
    `"${row.spec}",${row.distinct_products},${row.total_qty}`
  ).join('\n');

  const fullCsv = csvHeader + csvRows;
  const filePath = 'auto_products_by_spec_jan31.csv';
  
  fs.writeFileSync(filePath, fullCsv);
  console.log(`✅ CSV created: ${filePath}`);
}

main().catch(console.error);
