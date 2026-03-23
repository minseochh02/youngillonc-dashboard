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
  console.log(`🔍 Calculating Auto Flagship Liters with improved parsing...`);

  // Logic: Extract the first number before any non-digit/dot (like / or L)
  // SQLite doesn't have regex, so we'll do it manually in JS for verification
  const query = `
    SELECT 
      e.품목코드,
      p.품목명,
      p.규격정보,
      CAST(REPLACE(e.재고수량, ',', '') AS NUMERIC) as qty
    FROM esz018r__6_ e
    LEFT JOIN items p ON e.품목코드 = p.품목코드
    WHERE p.품목그룹1코드 IN ('PVL', 'CVL')
      AND p.품목그룹3코드 = 'FLA'
  `;

  const result = await executeSQL(query);
  
  let totalLiters = 0;
  result.rows.forEach(r => {
    let spec = 0;
    if (r.규격정보) {
      // Match the first number (integer or decimal)
      const match = r.규격정보.match(/[\d.]+/);
      if (match) spec = parseFloat(match[0]);
    }
    totalLiters += (r.qty || 0) * spec;
  });

  console.log('\n📊 Auto Flagship Total Liters (Parsed via JS):', totalLiters);
}

main().catch(console.error);
