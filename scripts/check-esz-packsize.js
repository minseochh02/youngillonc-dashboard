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
  console.log(`🔍 Calculating sum of (Qty * PackSize) for Auto Flagship in esz018r__6_...`);

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
  
  let totalCalculated = 0;
  result.rows.forEach(r => {
    let packSize = 1;
    if (r.규격정보) {
      // Find the number AFTER the slash or dash
      const parts = r.규격정보.split(/[\/／-]/);
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        const match = lastPart.match(/\d+/);
        if (match) packSize = parseInt(match[0]);
      }
    }
    totalCalculated += (r.qty || 0) * packSize;
  });

  console.log('\n📊 Auto Flagship Total (Qty * PackSize):', totalCalculated);
}

main().catch(console.error);
