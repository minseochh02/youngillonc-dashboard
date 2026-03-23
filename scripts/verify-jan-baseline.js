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
  const date = '2026-01-31';
  
  const query = `
    SELECT 
      CASE
        WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
        WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
        WHEN p.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
        ELSE 'Others'
      END as category,
      CASE
        WHEN p.품목그룹3코드 = 'FLA' THEN 'Flagship'
        ELSE 'Others'
      END as tier,
      SUM(CAST(REPLACE(i.재고수량, ',', '') AS NUMERIC)) as total_qty,
      SUM(CAST(REPLACE(i.재고수량, ',', '') AS NUMERIC) * CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(p.규격정보, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC)) as total_weight
    FROM inventory i
    LEFT JOIN items p ON i.품목코드 = p.품목코드
    WHERE (i.창고명 LIKE '%사업소%' OR i.창고명 LIKE '%지사%' OR i.창고명 = 'MB' OR i.창고명 LIKE '%화성%' OR i.창고명 LIKE '%창원%' OR i.창고명 LIKE '%남부%' OR i.창고명 LIKE '%중부%' OR i.창고명 LIKE '%서부%' OR i.창고명 LIKE '%동부%' OR i.창고명 LIKE '%제주%' OR i.창고명 LIKE '%부산%')
      AND i.imported_at = (
        SELECT MAX(imported_at) 
        FROM inventory 
        WHERE DATE(imported_at) <= '${date}'
      )
    GROUP BY 1, 2
  `;

  const result = await executeSQL(query);
  console.log(`📊 Summary for all categories on ${date}:`);
  console.table(result.rows);
}

main().catch(console.error);
