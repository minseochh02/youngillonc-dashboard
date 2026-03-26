import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const branchesParam = searchParams.get('branches') || '';
  const selectedBranches = branchesParam ? branchesParam.split(',').filter(Boolean) : [];

  // Parse the selected month
  const [year, monthNum] = month.split('-').map(Number);
  
  // To avoid timezone issues, build date strings manually
  // Calculate 12 months ago starting from the selected month
  let startYear = year;
  let startMonth = monthNum - 11;
  while (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }
  const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;

  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Branch mapping helper for SQL
  const branchMapping = `
    CASE
      WHEN c.거래처그룹1명 = '벤츠' THEN 'MB'
      WHEN c.거래처그룹1명 = '경남사업소' THEN '창원'
      WHEN c.거래처그룹1명 LIKE '%화성%' THEN '화성'
      WHEN c.거래처그룹1명 LIKE '%남부%' THEN '남부'
      WHEN c.거래처그룹1명 LIKE '%중부%' THEN '중부'
      WHEN c.거래처그룹1명 LIKE '%서부%' THEN '서부'
      WHEN c.거래처그룹1명 LIKE '%동부%' THEN '동부'
      WHEN c.거래처그룹1명 LIKE '%제주%' THEN '제주'
      WHEN c.거래처그룹1명 LIKE '%부산%' THEN '부산'
      ELSE REPLACE(REPLACE(c.거래처그룹1명, '사업소', ''), '지사', '')
    END
  `;

  try {
    let branchFilter = '';
    if (selectedBranches.length > 0) {
      const quotedBranches = selectedBranches.map(b => `'${b}'`).join(',');
      branchFilter = `AND ${branchMapping} IN (${quotedBranches})`;
    }

    // Get monthly breakdown for each client
    const query = `
      SELECT 
        all_codes.client_code,
        COALESCE(md.branch_name, b_info.branch_name) as branch_name,
        COALESCE(md.client_name, b_info.client_name) as client_name,
        COALESCE(md.employee_code, b_info.manager_code) as employee_code,
        COALESCE(md.employee_name, b_info.manager_name) as employee_name,
        COALESCE(md.business_type, b_info.business_type) as business_type,
        md.month,
        COALESCE(md.monthly_sales, 0) as monthly_sales,
        COALESCE(md.monthly_collections, 0) as monthly_collections,
        COALESCE(b.baseline_amount, 0) as baseline_amount
      FROM (
        SELECT client_code FROM ar_baselines
        UNION
        SELECT 거래처코드 FROM ledger WHERE 계정코드 = '1089' AND 일자 >= '${startDateStr}' AND 일자 <= '${endDateStr}'
      ) all_codes
      LEFT JOIN (
        SELECT
          c.거래처코드 as client_code,
          c.거래처명 as client_name,
          ${branchMapping} as branch_name,
          e.사원_담당_코드 as employee_code,
          e.사원_담당_명 as employee_name,
          CASE WHEN ec.b2c_팀 IS NOT NULL AND ec.b2c_팀 != 'B2B' THEN 'B2C' ELSE 'B2B' END as business_type,
          strftime('%Y-%m', l.일자) as month,
          SUM(CAST(REPLACE(l.차변금액, ',', '') AS NUMERIC)) as monthly_sales,
          SUM(CAST(REPLACE(l.대변금액, ',', '') AS NUMERIC)) as monthly_collections
        FROM ledger l
        JOIN clients c ON l.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE l.계정코드 = '1089'
          AND l.일자 >= '${startDateStr}'
          AND l.일자 <= '${endDateStr}'
          ${branchFilter}
        GROUP BY c.거래처코드, strftime('%Y-%m', l.일자)
      ) md ON all_codes.client_code = md.client_code
      LEFT JOIN (
        SELECT client_code, ar_total as baseline_amount
        FROM ar_baselines
      ) b ON all_codes.client_code = b.client_code
      LEFT JOIN (
        SELECT 
          c.거래처코드 as client_code,
          c.거래처명 as client_name,
          ${branchMapping} as branch_name,
          e.사원_담당_코드 as manager_code,
          e.사원_담당_명 as manager_name,
          CASE WHEN ec.b2c_팀 IS NOT NULL AND ec.b2c_팀 != 'B2B' THEN 'B2C' ELSE 'B2B' END as business_type
        FROM clients c
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      ) b_info ON all_codes.client_code = b_info.client_code
      WHERE 1=1
      ${branchFilter ? `AND COALESCE(md.branch_name, b_info.branch_name) IN (${selectedBranches.map(b => `'${b}'`).join(',')})` : ''}
      ORDER BY branch_name, client_name, month
    `;

    console.log('Executing monthly detail query with baselines:', query);

    const result = await executeSQL(query);
    const rows = result?.rows || [];

    // Group by branch and client
    const dataByBranch: Record<string, any[]> = {};

    rows.forEach((row: any) => {
      const branch = row.branch_name || '미분류';
      if (!dataByBranch[branch]) {
        dataByBranch[branch] = [];
      }

      // Find or create client entry
      let clientEntry = dataByBranch[branch].find((c: any) => c.client_code === row.client_code);
      if (!clientEntry) {
        clientEntry = {
          client_code: row.client_code,
          client_name: row.client_name,
          employee_code: row.employee_code,
          employee_name: row.employee_name,
          business_type: row.business_type,
          baseline_amount: Number(row.baseline_amount) || 0,
          total_sales: 0,
          total_collections: 0,
          total_adjustments: 0,
          balance: 0,
          uncollected: 0,
          monthly_breakdown: [],
        };
        dataByBranch[branch].push(clientEntry);
      }

      // Add monthly data
      const monthlySales = Number(row.monthly_sales) || 0;
      const monthlyCollections = Number(row.monthly_collections) || 0;
      const monthlyAdjustments = 0; // Placeholder

      clientEntry.total_sales += monthlySales;
      clientEntry.total_collections += monthlyCollections;
      clientEntry.total_adjustments += monthlyAdjustments;

      // Calculate running balance for this month
      // Start with baseline if it's the first month in our window (or the month after baseline date)
      let prevBalance = clientEntry.monthly_breakdown.length > 0 
        ? clientEntry.monthly_breakdown[clientEntry.monthly_breakdown.length - 1].balance 
        : clientEntry.baseline_amount;

      const currentBalance = prevBalance + monthlySales - monthlyCollections - monthlyAdjustments;

      clientEntry.monthly_breakdown.push({
        month: row.month,
        sales: monthlySales,
        collections: monthlyCollections,
        adjustments: monthlyAdjustments,
        balance: currentBalance,
        uncollected: Math.max(0, Math.min(monthlySales, currentBalance)),
      });
    });

    // Final client balance calculation
    Object.keys(dataByBranch).forEach(branch => {
      dataByBranch[branch].forEach((client: any) => {
        client.balance = client.baseline_amount + client.total_sales - client.total_collections - client.total_adjustments;
        client.uncollected = client.balance;
      });
    });

    // Calculate recent 3 months summary for each client
    Object.keys(dataByBranch).forEach(branch => {
      dataByBranch[branch].forEach((client: any) => {
        const recentMonths = client.monthly_breakdown.slice(-3);
        client.recent_3_months = {
          sales: recentMonths.reduce((sum: number, m: any) => sum + (m.sales || 0), 0),
          collections: recentMonths.reduce((sum: number, m: any) => sum + (m.collections || 0), 0),
          balance_change: recentMonths.reduce((sum: number, m: any) => sum + (m.balance || 0), 0),
        };
      });
    });

    return NextResponse.json({
      success: true,
      data: dataByBranch,
      period: {
        start: startDateStr,
        end: endDateStr,
      },
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monthly detail data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
