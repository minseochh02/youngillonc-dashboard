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
  console.log(`🔍 Calculating Auto Flagship Liters with "Pack x Volume" logic...`);

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
    let litersPerUnit = 1;
    const spec = r.규격정보 || "";
    
    // Look for patterns like 12X1L, 20L, 200L, 1/12, etc.
    if (spec.includes('200L')) {
      litersPerUnit = 200;
    } else if (spec.includes('208L')) {
      litersPerUnit = 208;
    } else if (spec.includes('20L')) {
      litersPerUnit = 20;
    } else if (spec.includes('12X1L') || spec.includes('1/12') || spec.includes('1／12')) {
      litersPerUnit = 12;
    } else if (spec.includes('4X4L')) {
      litersPerUnit = 16;
    } else if (spec.includes('3X6L')) {
      litersPerUnit = 18;
    } else {
      // Fallback: extract the largest number
      const nums = spec.match(/\d+/g);
      if (nums) litersPerUnit = Math.max(...nums.map(n => parseInt(n)));
    }
    
    totalLiters += (r.qty || 0) * litersPerUnit;
  });

  console.log('\n📊 Auto Flagship Total Liters (Smart Parsing):', totalLiters);
}

main().catch(console.error);
