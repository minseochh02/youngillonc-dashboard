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
  const query = `
    SELECT 
      e.품목코드,
      p.품목명,
      p.규격정보,
      CAST(REPLACE(e.재고수량, ',', '') AS NUMERIC) as qty
    FROM esz018r__6_ e
    LEFT JOIN items p ON e.품목코드 = p.품목코드
    WHERE p.품목그룹1코드 IN ('PVL', 'CVL')
  `;

  const result = await executeSQL(query);
  
  let total1 = 0; // Multiply by first number
  let total2 = 0; // Multiply by last number
  let total3 = 0; // Multiply by max number
  
  result.rows.forEach(r => {
    const qty = r.qty || 0;
    const nums = (r.규격정보 || "").match(/\d+/g);
    if (nums && nums.length > 0) {
      const n1 = parseInt(nums[0]);
      const nLast = parseInt(nums[nums.length - 1]);
      const nMax = Math.max(...nums.map(n => parseInt(n)));
      
      total1 += qty * n1;
      total2 += qty * nLast;
      total3 += qty * nMax;
    } else {
      total1 += qty;
      total2 += qty;
      total3 += qty;
    }
  });

  console.log('Total 1 (First num):', total1);
  console.log('Total 2 (Last num):', total2);
  console.log('Total 3 (Max num):', total3);
}

main().catch(console.error);
