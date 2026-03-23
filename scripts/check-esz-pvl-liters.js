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
  console.log(`🔍 Checking Liters for PVL category in esz018r__6_...`);

  const weightCalc = (qtyCol, specCol) => `
    CAST(REPLACE(${qtyCol}, ',', '') AS NUMERIC) * CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${specCol}, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC)
  `;

  const query = `
    SELECT 
      SUM(${weightCalc('e.재고수량', 'p.규격정보')}) as total_weight
    FROM esz018r__6_ e
    LEFT JOIN items p ON e.품목코드 = p.품목코드
    WHERE p.품목그룹1코드 = 'PVL'
  `;

  const result = await executeSQL(query);
  console.log('\n📊 Total PVL Liters in esz018r__6_:', result.rows[0]?.total_weight);

  // Check CVL too
  const cvlQuery = `
    SELECT 
      SUM(${weightCalc('e.재고수량', 'p.규격정보')}) as total_weight
    FROM esz018r__6_ e
    LEFT JOIN items p ON e.품목코드 = p.품목코드
    WHERE p.품목그룹1코드 = 'CVL'
  `;
  const resCvl = await executeSQL(cvlQuery);
  console.log('📊 Total CVL Liters in esz018r__6_:', resCvl.rows[0]?.total_weight);
}

main().catch(console.error);
