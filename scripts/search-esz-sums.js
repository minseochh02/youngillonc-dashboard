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
  console.log(`🔍 Searching for any sum that equals 40,434 in esz018r__6_...`);

  const queries = [
    "SELECT SUM(CAST(REPLACE(재고수량, ',', '') AS NUMERIC)) FROM esz018r__6_",
    "SELECT SUM(CAST(REPLACE(재고수량, ',', '') AS NUMERIC)) FROM esz018r__6_ WHERE 품목코드 LIKE '1%'",
    "SELECT SUM(CAST(REPLACE(재고수량, ',', '') AS NUMERIC)) FROM esz018r__6_ e LEFT JOIN items p ON e.품목코드 = p.품목코드 WHERE p.품목그룹1코드 = 'IL'",
    "SELECT SUM(CAST(REPLACE(재고수량, ',', '') AS NUMERIC)) FROM esz018r__6_ e LEFT JOIN items p ON e.품목코드 = p.품목코드 WHERE p.품목그룹1코드 = 'PVL'",
    "SELECT SUM(CAST(REPLACE(재고수량, ',', '') AS NUMERIC)) FROM esz018r__6_ e LEFT JOIN items p ON e.품목코드 = p.품목코드 WHERE p.품목그룹1코드 = 'CVL'",
    "SELECT SUM(CAST(REPLACE(재고수량, ',', '') AS NUMERIC)) FROM esz018r__6_ e LEFT JOIN items p ON e.품목코드 = p.품목코드 WHERE p.품목그룹3코드 = 'FLA'"
  ];

  for (const q of queries) {
    const res = await executeSQL(q);
    console.log(`${q} => ${JSON.stringify(res.rows[0])}`);
  }
}

main().catch(console.error);
