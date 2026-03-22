import { executeSQL } from './egdesk-helpers';

async function fetchSales(tableName: string, hasCode: boolean) {
  const isMain = tableName === 'sales';
  const weightExpr = isMain 
    ? "CAST(REPLACE(REPLACE(COALESCE(중량, '0'), ',', ''), '-', '0') AS NUMERIC)" 
    : "COALESCE(중량, 0)";
  const joinCol = hasCode ? "담당자코드" : "NULL as 담당자코드, 담당자명";
  
  const query = `
    SELECT 
      ${weightExpr} as weight,
      i.품목그룹1코드,
      ec.전체사업소 as raw_branch,
      e.사원_담당_명 as employee_name
    FROM ${tableName} s
    LEFT JOIN employees e ON ${hasCode ? 's.담당자코드 = e.사원_담당_코드' : 's.담당자명 = e.사원_담당_명'}
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    JOIN items i ON s.품목코드 = i.품목코드
    WHERE i.품목그룹1코드 IN ('CVL', 'PVL', 'AVI', 'MAR', 'IL')
      AND (e.사원_담당_명 IS NULL OR e.사원_담당_명 != '김도량')
  `;
  
  const result = await executeSQL(query);
  return result.rows || [];
}

function mapBranch(raw: string | null): string | null {
  if (!raw) return null;
  if (raw === '벤츠') return 'MB';
  if (raw === '경남사업소') return '창원';
  if (raw.includes('화성')) return '화성';
  if (raw.includes('남부')) return '남부';
  if (raw.includes('중부')) return '중부';
  if (raw.includes('서부')) return '서부';
  if (raw.includes('동부')) return '동부';
  if (raw.includes('제주')) return '제주';
  if (raw.includes('부산')) return '부산';
  return raw.replace('사업소', '').replace('지사', '').trim();
}

async function run() {
  try {
    const results = await Promise.all([
      fetchSales('sales', true),
      fetchSales('east_division_sales', true),
      fetchSales('west_division_sales', true),
      fetchSales('south_division_sales', false),
    ]);
    
    const aggregated: Record<string, number> = {};
    
    results.flat().forEach((row: any) => {
      const branch = mapBranch(row.raw_branch);
      if (branch) {
        aggregated[branch] = (aggregated[branch] || 0) + (row.weight || 0);
      }
    });
    
    const sorted = Object.entries(aggregated)
      .map(([branch, weight]) => ({ branch, total_weight_liters: Math.round(weight * 100) / 100 }))
      .sort((a, b) => b.total_weight_liters - a.total_weight_liters);
    
    console.log(JSON.stringify(sorted, null, 2));
  } catch (error) {
    console.error('Execution failed:', error);
  }
}

run();
