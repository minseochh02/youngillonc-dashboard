import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export const dynamic = 'force-dynamic';

function interpolateQuery(query: string, params: any[]): string {
  let index = 0;
  return query.replace(/\?/g, () => {
    const val = params[index++];
    if (typeof val === 'string') {
      return `'${val.replace(/'/g, "''")}'`;
    }
    return val;
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const inactiveMonths = parseInt(searchParams.get('inactiveMonths') || '3');
    const groupBy = searchParams.get('groupBy') || 'branch';
    const branchesParam = searchParams.get('branches') || '';
    const selectedBranches = branchesParam ? branchesParam.split(',').filter(Boolean) : [];

    // Calculate the cutoff date (X months ago from selected month)
    const selectedDate = new Date(month + '-01');
    const cutoffDate = new Date(selectedDate);
    cutoffDate.setMonth(cutoffDate.getMonth() - inactiveMonths);
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 10);
    const selectedMonthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString().slice(0, 10);

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
        ELSE REPLACE(REPLACE(COALESCE(c.거래처그룹1명, ''), '사업소', ''), '지사', '')
      END
    `;

    let branchFilter = '';
    if (selectedBranches.length > 0) {
      const branchPlaceholders = selectedBranches.map(() => '?').join(',');
      branchFilter = `AND ${branchMapping} IN (${branchPlaceholders})`;
    }

    let query = '';
    let params: any[] = [];

    if (groupBy === 'branch') {
      query = `SELECT
          branch_name,
          COUNT(DISTINCT 거래처코드) as inactive_count,
          GROUP_CONCAT(거래처명, ', ') as inactive_company_names,
          SUM(total_sales_amount) as last_period_sales,
          AVG(JULIANDAY(?) - JULIANDAY(last_transaction_date)) as avg_days_inactive,
          MAX(JULIANDAY(?) - JULIANDAY(last_transaction_date)) as max_days_inactive,
          MIN(last_transaction_date) as earliest_last_transaction,
          MAX(last_transaction_date) as latest_last_transaction
        FROM (
          SELECT
            c.거래처코드,
            c.거래처명,
            e.사원_담당_명 as employee_name,
            e.사원_담당_코드 as employee_code,
            ${branchMapping} as branch_name,
            MAX(s.일자) as last_transaction_date,
            SUM(CAST(REPLACE(REPLACE(s.합계, ',', ''), '-', '') AS REAL)) as total_sales_amount,
            COUNT(DISTINCT s.일자) as transaction_count
          FROM clients c
          LEFT JOIN (
            SELECT 일자, 거래처코드, 담당자코드, 합계 FROM sales
          ) s ON c.거래처코드 = s.거래처코드
            AND s.일자 <= ?
          LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
          LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
          WHERE c.거래처코드 IS NOT NULL
            AND e.사원_담당_명 != '김도량'
            ${branchFilter}
          GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드
          HAVING last_transaction_date IS NULL OR last_transaction_date < ?
        ) AS last_transactions
        WHERE branch_name IS NOT NULL
        GROUP BY branch_name
        ORDER BY inactive_count DESC`;
      params = [selectedMonthEnd, ...selectedBranches, cutoffDateStr, selectedMonthEnd, selectedMonthEnd];
    } else if (groupBy === 'employee') {
      query = `SELECT
          branch_name,
          employee_code,
          employee_name,
          COUNT(DISTINCT 거래처코드) as inactive_count,
          GROUP_CONCAT(거래처명, ', ') as inactive_company_names,
          SUM(total_sales_amount) as last_period_sales,
          AVG(JULIANDAY(?) - JULIANDAY(last_transaction_date)) as avg_days_inactive,
          MAX(JULIANDAY(?) - JULIANDAY(last_transaction_date)) as max_days_inactive
        FROM (
          SELECT
            c.거래처코드,
            c.거래처명,
            e.사원_담당_명 as employee_name,
            e.사원_담당_코드 as employee_code,
            ${branchMapping} as branch_name,
            MAX(s.일자) as last_transaction_date,
            SUM(CAST(REPLACE(REPLACE(s.합계, ',', ''), '-', '') AS REAL)) as total_sales_amount
          FROM clients c
          LEFT JOIN (
            SELECT 일자, 거래처코드, 담당자코드, 합계 FROM sales
          ) s ON c.거래처코드 = s.거래처코드
            AND s.일자 <= ?
          LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
          LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
          WHERE c.거래처코드 IS NOT NULL
            AND e.사원_담당_명 != '김도량'
            ${branchFilter}
          GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드
          HAVING last_transaction_date IS NULL OR last_transaction_date < ?
        ) AS last_transactions
        WHERE branch_name IS NOT NULL AND employee_name IS NOT NULL
        GROUP BY branch_name, employee_code, employee_name
        ORDER BY branch_name, inactive_count DESC`;
      params = [selectedMonthEnd, ...selectedBranches, cutoffDateStr, selectedMonthEnd, selectedMonthEnd];
    } else if (groupBy === 'client') {
      query = `SELECT
          c.거래처코드 as client_code,
          c.거래처명 as client_name,
          e.사원_담당_명 as employee_name,
          e.사원_담당_코드 as employee_code,
          ${branchMapping} as branch_name,
          MAX(s.일자) as last_transaction_date,
          CAST(JULIANDAY(?) - JULIANDAY(MAX(s.일자)) AS INTEGER) as days_inactive,
          SUM(CAST(REPLACE(REPLACE(s.합계, ',', ''), '-', '') AS REAL)) as last_period_sales,
          COUNT(DISTINCT s.일자) as transaction_count
        FROM clients c
        LEFT JOIN (
          SELECT 일자, 거래처코드, 담당자코드, 합계 FROM sales
        ) s ON c.거래처코드 = s.거래처코드
          AND s.일자 <= ?
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE c.거래처코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
          ${branchFilter}
        GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드
        HAVING last_transaction_date IS NULL OR last_transaction_date < ?
        ORDER BY days_inactive DESC`;
      params = [selectedMonthEnd, selectedMonthEnd, ...selectedBranches, cutoffDateStr];
    }

    const finalQuery = interpolateQuery(query, params).trim();
    const result = await executeSQL(finalQuery);
    const data = result?.rows || [];

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching inactive companies:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inactive companies data' },
      { status: 500 }
    );
  }
}
