import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const inactiveMonths = parseInt(searchParams.get('inactiveMonths') || '3');
    const groupBy = searchParams.get('groupBy') || 'branch';
    const branchesParam = searchParams.get('branches') || '';
    const selectedBranches = branchesParam ? branchesParam.split(',').filter(Boolean) : [];

    const db = await getDatabase();

    // Calculate the cutoff date (X months ago from selected month)
    const selectedDate = new Date(month + '-01');
    const cutoffDate = new Date(selectedDate);
    cutoffDate.setMonth(cutoffDate.getMonth() - inactiveMonths);
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 10);
    const selectedMonthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString().slice(0, 10);

    let branchFilter = '';
    if (selectedBranches.length > 0) {
      const branchPlaceholders = selectedBranches.map(() => '?').join(',');
      branchFilter = `AND CASE
        WHEN ec.전체사업소 = '벤츠' THEN 'MB'
        WHEN ec.전체사업소 = '경남사업소' THEN '창원'
        WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
        WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
        WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
        WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
        WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
        WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
        WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
        ELSE ec.전체사업소
      END IN (${branchPlaceholders})`;
    }

    let query = '';
    let params: any[] = [];

    if (groupBy === 'branch') {
      query = `
        WITH last_transactions AS (
          SELECT
            c.거래처코드,
            c.거래처명,
            e.사원_담당_명 as employee_name,
            e.사원_담당_코드 as employee_code,
            CASE
              WHEN ec.전체사업소 = '벤츠' THEN 'MB'
              WHEN ec.전체사업소 = '경남사업소' THEN '창원'
              WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
              WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
              WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
              WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
              WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
              WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
              WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
              ELSE ec.전체사업소
            END as branch_name,
            MAX(s.일자) as last_transaction_date,
            SUM(CAST(REPLACE(REPLACE(s.합계, ',', ''), '-', '') AS REAL)) as total_sales_amount,
            COUNT(DISTINCT s.일자) as transaction_count
          FROM clients c
          LEFT JOIN (
            SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM sales
            UNION ALL
            SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM east_division_sales
            UNION ALL
            SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM west_division_sales
            UNION ALL
            SELECT 일자, 거래처코드, NULL as 담당자코드, 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, NULL as 신규일, NULL as 적요, NULL as 적요2 FROM south_division_sales
          ) s ON c.거래처코드 = s.거래처코드
            AND s.일자 <= ?
          LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
          LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
          WHERE c.거래처코드 IS NOT NULL
            AND e.사원_담당_명 != '김도량'
            ${branchFilter}
          GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드, ec.전체사업소
          HAVING last_transaction_date IS NULL OR last_transaction_date < ?
        )
        SELECT
          branch_name,
          COUNT(DISTINCT 거래처코드) as inactive_count,
          SUM(total_sales_amount) as last_period_sales,
          AVG(JULIANDAY(?) - JULIANDAY(last_transaction_date)) as avg_days_inactive,
          MAX(JULIANDAY(?) - JULIANDAY(last_transaction_date)) as max_days_inactive,
          MIN(last_transaction_date) as earliest_last_transaction,
          MAX(last_transaction_date) as latest_last_transaction
        FROM last_transactions
        WHERE branch_name IS NOT NULL
        GROUP BY branch_name
        ORDER BY inactive_count DESC
      `;
      params = [selectedMonthEnd, cutoffDateStr, ...selectedBranches, selectedMonthEnd, selectedMonthEnd];
    } else if (groupBy === 'employee') {
      query = `
        WITH last_transactions AS (
          SELECT
            c.거래처코드,
            c.거래처명,
            e.사원_담당_명 as employee_name,
            e.사원_담당_코드 as employee_code,
            CASE
              WHEN ec.전체사업소 = '벤츠' THEN 'MB'
              WHEN ec.전체사업소 = '경남사업소' THEN '창원'
              WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
              WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
              WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
              WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
              WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
              WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
              WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
              ELSE ec.전체사업소
            END as branch_name,
            MAX(s.일자) as last_transaction_date,
            SUM(CAST(REPLACE(REPLACE(s.합계, ',', ''), '-', '') AS REAL)) as total_sales_amount
          FROM clients c
          LEFT JOIN (
            SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM sales
            UNION ALL
            SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM east_division_sales
            UNION ALL
            SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM west_division_sales
            UNION ALL
            SELECT 일자, 거래처코드, NULL as 담당자코드, 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, NULL as 신규일, NULL as 적요, NULL as 적요2 FROM south_division_sales
          ) s ON c.거래처코드 = s.거래처코드
            AND s.일자 <= ?
          LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
          LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
          WHERE c.거래처코드 IS NOT NULL
            AND e.사원_담당_명 != '김도량'
            ${branchFilter}
          GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드, ec.전체사업소
          HAVING last_transaction_date IS NULL OR last_transaction_date < ?
        )
        SELECT
          branch_name,
          employee_code,
          employee_name,
          COUNT(DISTINCT 거래처코드) as inactive_count,
          SUM(total_sales_amount) as last_period_sales,
          AVG(JULIANDAY(?) - JULIANDAY(last_transaction_date)) as avg_days_inactive,
          MAX(JULIANDAY(?) - JULIANDAY(last_transaction_date)) as max_days_inactive
        FROM last_transactions
        WHERE branch_name IS NOT NULL AND employee_name IS NOT NULL
        GROUP BY branch_name, employee_code, employee_name
        ORDER BY branch_name, inactive_count DESC
      `;
      params = [selectedMonthEnd, cutoffDateStr, ...selectedBranches, selectedMonthEnd, selectedMonthEnd];
    } else if (groupBy === 'client') {
      query = `
        SELECT
          c.거래처코드 as client_code,
          c.거래처명 as client_name,
          e.사원_담당_명 as employee_name,
          e.사원_담당_코드 as employee_code,
          CASE
            WHEN ec.전체사업소 = '벤츠' THEN 'MB'
            WHEN ec.전체사업소 = '경남사업소' THEN '창원'
            WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
            WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
            WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
            WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
            WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
            WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
            WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
            ELSE ec.전체사업소
          END as branch_name,
          MAX(s.일자) as last_transaction_date,
          CAST(JULIANDAY(?) - JULIANDAY(MAX(s.일자)) AS INTEGER) as days_inactive,
          SUM(CAST(REPLACE(REPLACE(s.합계, ',', ''), '-', '') AS REAL)) as last_period_sales,
          COUNT(DISTINCT s.일자) as transaction_count
        FROM clients c
        LEFT JOIN (
          SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM sales
          UNION ALL
          SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM east_division_sales
          UNION ALL
          SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM west_division_sales
          UNION ALL
          SELECT 일자, 거래처코드, NULL as 담당자코드, 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, NULL as 신규일, NULL as 적요, NULL as 적요2 FROM south_division_sales
        ) s ON c.거래처코드 = s.거래처코드
          AND s.일자 <= ?
        LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE c.거래처코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
          ${branchFilter}
        GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명, e.사원_담당_코드, ec.전체사업소
        HAVING last_transaction_date IS NULL OR last_transaction_date < ?
        ORDER BY days_inactive DESC
      `;
      params = [selectedMonthEnd, selectedMonthEnd, ...selectedBranches, cutoffDateStr];
    }

    const data = await db.all(query, params);

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
