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
  const selectedDate = new Date(year, monthNum - 1, 1);

  // Calculate 12 months ago
  const startDate = new Date(selectedDate);
  startDate.setMonth(startDate.getMonth() - 11); // 11 months back + current month = 12 months total

  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, monthNum, 0); // Last day of selected month
  const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

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
        ${branchMapping} as branch_name,
        c.거래처코드 as client_code,
        c.거래처명 as client_name,
        e.사원_담당_코드 as employee_code,
        e.사원_담당_명 as employee_name,
        CASE
          WHEN ec.b2c_팀 IS NOT NULL AND ec.b2c_팀 != 'B2B' THEN 'B2C'
          ELSE 'B2B'
        END as business_type,
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
      GROUP BY c.거래처코드, c.거래처명, e.사원_담당_코드, e.사원_담당_명, ec.b2c_팀, strftime('%Y-%m', l.일자)
      ORDER BY branch_name, c.거래처명, month
    `;

    console.log('Executing monthly detail query:', query);

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
      const monthlyAdjustments = 0; // User input, set to 0 for now

      clientEntry.total_sales += monthlySales;
      clientEntry.total_collections += monthlyCollections;
      clientEntry.total_adjustments += monthlyAdjustments;

      clientEntry.monthly_breakdown.push({
        month: row.month,
        sales: monthlySales,
        collections: monthlyCollections,
        adjustments: monthlyAdjustments,
        balance: monthlySales - monthlyCollections - monthlyAdjustments,
        uncollected: monthlySales - monthlyCollections - monthlyAdjustments,
      });
    });

    // Calculate balances and uncollected for each client
    Object.keys(dataByBranch).forEach(branch => {
      dataByBranch[branch].forEach((client: any) => {
        client.balance = client.total_sales - client.total_collections - client.total_adjustments;
        client.uncollected = client.balance; // Same for now
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
