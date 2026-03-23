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
  console.log(`🔍 Checking Auto Flagship Liters per Branch in esz018r__6_...`);

  const branchCase = (column) => `
    CASE
      WHEN ${column} = 'MB' THEN 'MB'
      WHEN ${column} LIKE '%화성%' THEN '화성'
      WHEN ${column} LIKE '%창원%' THEN '창원'
      WHEN ${column} LIKE '%남부%' THEN '남부'
      WHEN ${column} LIKE '%중부%' THEN '중부'
      WHEN ${column} LIKE '%서부%' THEN '서부'
      WHEN ${column} LIKE '%동부%' THEN '동부'
      WHEN ${column} LIKE '%제주%' THEN '제주'
      WHEN ${column} LIKE '%부산%' THEN '부산'
      ELSE REPLACE(REPLACE(REPLACE(REPLACE(${column}, '사업소', ''), '지사', ''), '본사', ''), ' ', '')
    END
  `;

  const weightCalc = (qtyCol, specCol) => `
    CAST(REPLACE(${qtyCol}, ',', '') AS NUMERIC) * CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${specCol}, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC)
  `;

  const query = `
    SELECT 
      ${branchCase('w.창고명')} as branch,
      SUM(${weightCalc('e.재고수량', 'p.규격정보')}) as total_weight
    FROM esz018r__6_ e
    LEFT JOIN items p ON e.품목코드 = p.품목코드
    LEFT JOIN warehouses w ON e.창고코드 = w.창고코드
    WHERE p.품목그룹1코드 IN ('PVL', 'CVL')
      AND p.품목그룹3코드 = 'FLA'
    GROUP BY 1
  `;

  const result = await executeSQL(query);
  console.table(result.rows);
}

main().catch(console.error);
