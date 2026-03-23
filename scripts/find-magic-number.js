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
  console.log(`🔍 Final attempt to find 40,434 in esz018r__6_...`);

  const query = `
    SELECT * FROM esz018r__6_ 
    WHERE 재고수량 LIKE '%40,434%' 
       OR 재고수량 = '40434'
  `;

  const result = await executeSQL(query);
  console.log('Direct matches:', result.rows);

  // Check if any column in any table contains 40434
  const tables = await executeSQL(`SELECT name FROM sqlite_master WHERE type='table'`);
  console.log('Searching all tables...');
  
  for (const table of tables.rows) {
    if (table.name.startsWith('sqlite_')) continue;
    try {
      const cols = await executeSQL(`PRAGMA table_info(${table.name})`);
      for (const col of cols.rows) {
        const search = await executeSQL(`SELECT COUNT(*) as count FROM ${table.name} WHERE "${col.name}" LIKE '%40434%' OR "${col.name}" LIKE '%40,434%'`);
        if (search.rows[0].count > 0) {
          console.log(`🎯 FOUND in table ${table.name}, column ${col.name}!`);
        }
      }
    } catch (e) {}
  }
}

main().catch(console.error);
