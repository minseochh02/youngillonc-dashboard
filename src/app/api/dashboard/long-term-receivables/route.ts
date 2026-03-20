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

  try {
    let query = '';
    let branchFilter = '';

    if (selectedBranches.length > 0) {
      const quotedBranches = selectedBranches.map(b => `'${b}'`).join(',');
      branchFilter = `AND e.사업소명 IN (${quotedBranches})`;
    }

    if (groupBy === 'branch') {
      query = `
        WITH current_receivables AS (
          SELECT
            e.사업소명 as branch_name,
            SUM(CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC)) as current_total_receivables,
            SUM(CASE
              WHEN a.일자 <= '${formatDate(agingCutoffDate)}'
              THEN CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC)
              ELSE 0
            END) as long_term_receivables
          FROM account_receivable a
          LEFT JOIN employees e ON a.담당자코드 = e.사원코드
          WHERE a.일자 <= '${formatDate(currentMonthEnd)}'
            AND CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC) > 0
            ${branchFilter}
          GROUP BY e.사업소명
        ),
        previous_receivables AS (
          SELECT
            e.사업소명 as branch_name,
            SUM(CASE
              WHEN a.일자 <= '${formatDate(previousAgingCutoffDate)}'
              THEN CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC)
              ELSE 0
            END) as previous_month_long_term
          FROM account_receivable a
          LEFT JOIN employees e ON a.담당자코드 = e.사원코드
          WHERE a.일자 <= '${formatDate(previousMonthEnd)}'
            AND CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC) > 0
            ${branchFilter}
          GROUP BY e.사업소명
        )
        SELECT
          COALESCE(cr.branch_name, pr.branch_name) as branch_name,
          COALESCE(cr.current_total_receivables, 0) as current_total_receivables,
          COALESCE(cr.long_term_receivables, 0) as long_term_receivables,
          COALESCE(pr.previous_month_long_term, 0) as previous_month_long_term,
          CASE
            WHEN COALESCE(cr.current_total_receivables, 0) > 0
            THEN (COALESCE(cr.long_term_receivables, 0) / cr.current_total_receivables) * 100
            ELSE 0
          END as long_term_ratio,
          COALESCE(cr.long_term_receivables, 0) - COALESCE(pr.previous_month_long_term, 0) as month_over_month_change,
          CASE
            WHEN COALESCE(pr.previous_month_long_term, 0) > 0
            THEN ((COALESCE(cr.long_term_receivables, 0) - pr.previous_month_long_term) / pr.previous_month_long_term) * 100
            ELSE 0
          END as month_over_month_change_rate
        FROM current_receivables cr
        FULL OUTER JOIN previous_receivables pr ON cr.branch_name = pr.branch_name
        WHERE COALESCE(cr.branch_name, pr.branch_name) IS NOT NULL
        ORDER BY COALESCE(cr.long_term_receivables, 0) DESC
      `;
    } else if (groupBy === 'employee') {
      query = `
        WITH current_receivables AS (
          SELECT
            e.사업소명 as branch_name,
            e.사원코드 as employee_code,
            e.성명 as employee_name,
            SUM(CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC)) as current_total_receivables,
            SUM(CASE
              WHEN a.일자 <= '${formatDate(agingCutoffDate)}'
              THEN CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC)
              ELSE 0
            END) as long_term_receivables
          FROM account_receivable a
          LEFT JOIN employees e ON a.담당자코드 = e.사원코드
          WHERE a.일자 <= '${formatDate(currentMonthEnd)}'
            AND CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC) > 0
            ${branchFilter}
          GROUP BY e.사업소명, e.사원코드, e.성명
        ),
        previous_receivables AS (
          SELECT
            e.사업소명 as branch_name,
            e.사원코드 as employee_code,
            SUM(CASE
              WHEN a.일자 <= '${formatDate(previousAgingCutoffDate)}'
              THEN CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC)
              ELSE 0
            END) as previous_month_long_term
          FROM account_receivable a
          LEFT JOIN employees e ON a.담당자코드 = e.사원코드
          WHERE a.일자 <= '${formatDate(previousMonthEnd)}'
            AND CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC) > 0
            ${branchFilter}
          GROUP BY e.사업소명, e.사원코드
        )
        SELECT
          COALESCE(cr.branch_name, pr.branch_name) as branch_name,
          COALESCE(cr.employee_code, pr.employee_code) as employee_code,
          cr.employee_name,
          COALESCE(cr.current_total_receivables, 0) as current_total_receivables,
          COALESCE(cr.long_term_receivables, 0) as long_term_receivables,
          COALESCE(pr.previous_month_long_term, 0) as previous_month_long_term,
          CASE
            WHEN COALESCE(cr.current_total_receivables, 0) > 0
            THEN (COALESCE(cr.long_term_receivables, 0) / cr.current_total_receivables) * 100
            ELSE 0
          END as long_term_ratio,
          COALESCE(cr.long_term_receivables, 0) - COALESCE(pr.previous_month_long_term, 0) as month_over_month_change,
          CASE
            WHEN COALESCE(pr.previous_month_long_term, 0) > 0
            THEN ((COALESCE(cr.long_term_receivables, 0) - pr.previous_month_long_term) / pr.previous_month_long_term) * 100
            ELSE 0
          END as month_over_month_change_rate
        FROM current_receivables cr
        FULL OUTER JOIN previous_receivables pr
          ON cr.branch_name = pr.branch_name AND cr.employee_code = pr.employee_code
        WHERE COALESCE(cr.branch_name, pr.branch_name) IS NOT NULL
        ORDER BY COALESCE(cr.branch_name, pr.branch_name), COALESCE(cr.long_term_receivables, 0) DESC
      `;
    } else if (groupBy === 'client') {
      query = `
        WITH current_receivables AS (
          SELECT
            e.사업소명 as branch_name,
            e.사원코드 as employee_code,
            e.성명 as employee_name,
            a.거래처코드 as client_code,
            a.거래처명 as client_name,
            SUM(CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC)) as current_total_receivables,
            SUM(CASE
              WHEN a.일자 <= '${formatDate(agingCutoffDate)}'
              THEN CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC)
              ELSE 0
            END) as long_term_receivables
          FROM account_receivable a
          LEFT JOIN employees e ON a.담당자코드 = e.사원코드
          WHERE a.일자 <= '${formatDate(currentMonthEnd)}'
            AND CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC) > 0
            ${branchFilter}
          GROUP BY e.사업소명, e.사원코드, e.성명, a.거래처코드, a.거래처명
        ),
        previous_receivables AS (
          SELECT
            e.사업소명 as branch_name,
            e.사원코드 as employee_code,
            a.거래처코드 as client_code,
            SUM(CASE
              WHEN a.일자 <= '${formatDate(previousAgingCutoffDate)}'
              THEN CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC)
              ELSE 0
            END) as previous_month_long_term
          FROM account_receivable a
          LEFT JOIN employees e ON a.담당자코드 = e.사원코드
          WHERE a.일자 <= '${formatDate(previousMonthEnd)}'
            AND CAST(REPLACE(a.외상매출금, ',', '') AS NUMERIC) > 0
            ${branchFilter}
          GROUP BY e.사업소명, e.사원코드, a.거래처코드
        )
        SELECT
          COALESCE(cr.branch_name, pr.branch_name) as branch_name,
          COALESCE(cr.employee_code, pr.employee_code) as employee_code,
          cr.employee_name,
          COALESCE(cr.client_code, pr.client_code) as client_code,
          cr.client_name,
          COALESCE(cr.current_total_receivables, 0) as current_total_receivables,
          COALESCE(cr.long_term_receivables, 0) as long_term_receivables,
          COALESCE(pr.previous_month_long_term, 0) as previous_month_long_term,
          CASE
            WHEN COALESCE(cr.current_total_receivables, 0) > 0
            THEN (COALESCE(cr.long_term_receivables, 0) / cr.current_total_receivables) * 100
            ELSE 0
          END as long_term_ratio,
          COALESCE(cr.long_term_receivables, 0) - COALESCE(pr.previous_month_long_term, 0) as month_over_month_change,
          CASE
            WHEN COALESCE(pr.previous_month_long_term, 0) > 0
            THEN ((COALESCE(cr.long_term_receivables, 0) - pr.previous_month_long_term) / pr.previous_month_long_term) * 100
            ELSE 0
          END as month_over_month_change_rate
        FROM current_receivables cr
        FULL OUTER JOIN previous_receivables pr
          ON cr.branch_name = pr.branch_name
          AND cr.employee_code = pr.employee_code
          AND cr.client_code = pr.client_code
        WHERE COALESCE(cr.branch_name, pr.branch_name) IS NOT NULL
        ORDER BY COALESCE(cr.branch_name, pr.branch_name),
                 COALESCE(cr.employee_code, pr.employee_code),
                 COALESCE(cr.long_term_receivables, 0) DESC
      `;
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
