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
  console.log(`🔍 Checking columns and other esz tables...`);

  const tables = await executeSQL(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'esz%'`);
  console.log('esz tables found:', tables.rows.map(r => r.name));

  for (const table of tables.rows) {
    const cols = await executeSQL(`PRAGMA table_info(${table.name})`);
    console.log(`\nColumns for ${table.name}:`, cols.rows.map(c => c.name));
    
    // Check total qty for Auto in each table
    const query = `
      SELECT 
        SUM(CAST(REPLACE(e.재고수량, ',', '') AS NUMERIC)) as total_qty
      FROM ${table.name} e
      LEFT JOIN items p ON e.품목코드 = p.품목코드
      WHERE p.품목그룹1코드 IN ('PVL', 'CVL')
        AND p.품목그룹3코드 = 'FLA'
    `;
    const res = await executeSQL(query);
    console.log(`Auto Flagship total qty in ${table.name}:`, res.rows[0].total_qty);
  }
}

main().catch(console.error);
