import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const agingMonths = parseInt(searchParams.get('agingMonths') || '3');
  const groupBy = searchParams.get('groupBy') || 'branch';
  const branchesParam = searchParams.get('branches') || '';
  const selectedBranches = branchesParam ? branchesParam.split(',').filter(Boolean) : [];

  // Parse the selected month
  const [year, monthNum] = month.split('-').map(Number);
  const currentMonthEnd = new Date(year, monthNum, 0); // Last day of current month

  // Calculate previous month
  const previousMonthEnd = new Date(year, monthNum - 1, 0); // Last day of previous month

  // N months ago from the end of current month (for long-term receivables)
  const agingCutoffDate = new Date(currentMonthEnd);
  agingCutoffDate.setMonth(agingCutoffDate.getMonth() - agingMonths);

  const previousAgingCutoffDate = new Date(previousMonthEnd);
  previousAgingCutoffDate.setMonth(previousAgingCutoffDate.getMonth() - agingMonths);

    const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

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
    let query = '';
    let branchFilter = '';

    if (selectedBranches.length > 0) {
      const quotedBranches = selectedBranches.map(b => `'${b}'`).join(',');
      branchFilter = `AND branch_name IN (${quotedBranches})`;
    }

    // Common calculation for AR and Long-Term AR
    const getReceivablesSubquery = (endDate: string, cutoffDate: string) => `
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
        SUM(CAST(REPLACE(l.차변금액, ',', '') AS NUMERIC)) - SUM(CAST(REPLACE(l.대변금액, ',', '') AS NUMERIC)) as balance,
        SUM(CASE WHEN l.일자 > '${cutoffDate}' AND l.일자 <= '${endDate}' THEN CAST(REPLACE(l.차변금액, ',', '') AS NUMERIC) ELSE 0 END) as recent_sales
      FROM ledger l
      JOIN clients c ON l.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE l.계정코드 = '1089' AND l.일자 <= '${endDate}'
      GROUP BY c.거래처코드
    `;

    const currentSubquery = getReceivablesSubquery(formatDate(currentMonthEnd), formatDate(agingCutoffDate));
    const previousSubquery = getReceivablesSubquery(formatDate(previousMonthEnd), formatDate(previousAgingCutoffDate));

    if (groupBy === 'branch') {
      query = `
        SELECT
          COALESCE(cr.branch_name, pr.branch_name) as branch_name,
          SUM(COALESCE(cr.balance, 0)) as current_total_receivables,
          SUM(CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) as long_term_receivables,
          SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) as previous_month_long_term,

          -- B2B stats
          SUM(CASE WHEN cr.business_type = 'B2B' THEN COALESCE(cr.balance, 0) ELSE 0 END) as b2b_current_total_receivables,
          SUM(CASE WHEN cr.business_type = 'B2B' AND COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) as b2b_long_term_receivables,
          SUM(CASE WHEN pr.business_type = 'B2B' AND COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) as b2b_previous_month_long_term,

          -- B2C stats
          SUM(CASE WHEN cr.business_type = 'B2C' THEN COALESCE(cr.balance, 0) ELSE 0 END) as b2c_current_total_receivables,
          SUM(CASE WHEN cr.business_type = 'B2C' AND COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) as b2c_long_term_receivables,
          SUM(CASE WHEN pr.business_type = 'B2C' AND COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) as b2c_previous_month_long_term,

          CASE
            WHEN SUM(COALESCE(cr.balance, 0)) > 0
            THEN (SUM(CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) / SUM(COALESCE(cr.balance, 0))) * 100
            ELSE 0
          END as long_term_ratio,
          SUM(CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) - SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) as month_over_month_change,
          CASE
            WHEN SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) > 0
            THEN ((SUM(CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) - SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END)) / SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END)) * 100
            ELSE 0
          END as month_over_month_change_rate
        FROM (
          SELECT DISTINCT client_code FROM (${currentSubquery} UNION ALL ${previousSubquery})
        ) all_clients
        LEFT JOIN (${currentSubquery}) cr ON all_clients.client_code = cr.client_code
        LEFT JOIN (${previousSubquery}) pr ON all_clients.client_code = pr.client_code
        WHERE 1=1
        GROUP BY 1
        HAVING current_total_receivables > 0 OR long_term_receivables > 0 OR previous_month_long_term > 0
        ORDER BY long_term_receivables DESC
      `;
    } else if (groupBy === 'employee') {
      query = `
        SELECT
          COALESCE(cr.branch_name, pr.branch_name) as branch_name,
          COALESCE(cr.employee_code, pr.employee_code) as employee_code,
          COALESCE(cr.employee_name, pr.employee_name) as employee_name,
          SUM(COALESCE(cr.balance, 0)) as current_total_receivables,
          SUM(CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) as long_term_receivables,
          SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) as previous_month_long_term,
          CASE
            WHEN SUM(COALESCE(cr.balance, 0)) > 0
            THEN (SUM(CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) / SUM(COALESCE(cr.balance, 0))) * 100
            ELSE 0
          END as long_term_ratio,
          SUM(CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) - SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) as month_over_month_change,
          CASE
            WHEN SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) > 0
            THEN ((SUM(CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) - SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END)) / SUM(CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END)) * 100
            ELSE 0
          END as month_over_month_change_rate
        FROM (
          SELECT DISTINCT client_code FROM (${currentSubquery} UNION ALL ${previousSubquery})
        ) all_clients
        LEFT JOIN (${currentSubquery}) cr ON all_clients.client_code = cr.client_code
        LEFT JOIN (${previousSubquery}) pr ON all_clients.client_code = pr.client_code
        WHERE 1=1
        GROUP BY 1, 2, 3
        HAVING current_total_receivables > 0 OR long_term_receivables > 0 OR previous_month_long_term > 0
        ORDER BY 1, long_term_receivables DESC
      `;
    } else if (groupBy === 'client') {
      query = `
        SELECT
          COALESCE(cr.branch_name, pr.branch_name) as branch_name,
          COALESCE(cr.employee_code, pr.employee_code) as employee_code,
          COALESCE(cr.employee_name, pr.employee_name) as employee_name,
          COALESCE(cr.client_code, pr.client_code) as client_code,
          COALESCE(cr.client_name, pr.client_name) as client_name,
          COALESCE(cr.balance, 0) as current_total_receivables,
          CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END as long_term_receivables,
          CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END as previous_month_long_term,
          CASE
            WHEN COALESCE(cr.balance, 0) > 0
            THEN (CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END / COALESCE(cr.balance, 0)) * 100
            ELSE 0
          END as long_term_ratio,
          (CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) - (CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) as month_over_month_change,
          CASE
            WHEN (CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END) > 0
            THEN (((CASE WHEN COALESCE(cr.balance, 0) > COALESCE(cr.recent_sales, 0) THEN COALESCE(cr.balance, 0) - COALESCE(cr.recent_sales, 0) ELSE 0 END) - (CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END)) / (CASE WHEN COALESCE(pr.balance, 0) > COALESCE(pr.recent_sales, 0) THEN COALESCE(pr.balance, 0) - COALESCE(pr.recent_sales, 0) ELSE 0 END)) * 100
            ELSE 0
          END as month_over_month_change_rate
        FROM (
          SELECT DISTINCT client_code FROM (${currentSubquery} UNION ALL ${previousSubquery})
        ) all_clients
        LEFT JOIN (${currentSubquery}) cr ON all_clients.client_code = cr.client_code
        LEFT JOIN (${previousSubquery}) pr ON all_clients.client_code = pr.client_code
        WHERE 1=1
        AND (current_total_receivables > 0 OR long_term_receivables > 0 OR previous_month_long_term > 0)
        ORDER BY 1, 3, long_term_receivables DESC
      `;
    }

    // Apply branch filter wrap
    if (branchFilter) {
      query = `SELECT * FROM (${query}) WHERE 1=1 ${branchFilter}`;
    }

    console.log('Executing long-term receivables query:', query);

    const result = await executeSQL(query);
    const data = result?.rows || [];

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch long-term receivables data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
