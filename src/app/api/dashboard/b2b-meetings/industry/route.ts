import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';
import { sqlSalesAmountExpr } from '@/lib/vat-amount-sql';

function endDateOfCalendarMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m, 0);
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${String(m).padStart(2, '0')}-${dd}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeVat = searchParams.get('includeVat') === 'true';
    const supplyAmountAgg = includeVat
      ? `SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC) * CAST(REPLACE(s.단가, ',', '') AS NUMERIC))`
      : `SUM(CAST(REPLACE(s.공급가액, ',', '') AS NUMERIC))`;
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const monthParam = searchParams.get('month');

    const dateRangeQuery = `
      SELECT DISTINCT substr(일자, 1, 7) as month FROM (
        SELECT 일자 FROM sales
        UNION ALL SELECT 일자 FROM east_division_sales
        UNION ALL SELECT 일자 FROM west_division_sales
      ) WHERE 일자 IS NOT NULL AND 일자 != '' AND 일자 LIKE '202%'
      ORDER BY month ASC
    `;
    const dateRangeResult = await executeSQL(dateRangeQuery);
    const availableMonths: string[] = dateRangeResult?.rows?.map((r: { month: string }) => r.month) || [];
    const latestMonthStr =
      availableMonths[availableMonths.length - 1] || new Date().toISOString().slice(0, 7);
    const resolvedMonth =
      monthParam && availableMonths.includes(monthParam) ? monthParam : latestMonthStr;

    let startDate: string;
    let endDate: string;
    if (monthParam && availableMonths.includes(monthParam)) {
      startDate = `${monthParam}-01`;
      endDate = endDateOfCalendarMonth(monthParam);
    } else if (searchParams.get('startDate') || searchParams.get('endDate')) {
      startDate = searchParams.get('startDate') || firstDayOfMonth;
      endDate = searchParams.get('endDate') || today;
    } else {
      startDate = `${resolvedMonth}-01`;
      endDate = endDateOfCalendarMonth(resolvedMonth);
    }

    const query = `
      SELECT
        ct.모빌분류,
        ct.산업분류,
        ct.영일분류,
        COALESCE(ec.b2b팀, '미분류') as team_name,
        COUNT(DISTINCT COALESCE(NULLIF(s.실납업체, ''), s.거래처코드)) as client_count,
        COUNT(DISTINCT s.id) as transaction_count,
        SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        ${supplyAmountAgg} as total_supply_amount,
        SUM(${sqlSalesAmountExpr('s', includeVat)}) as total_amount
      FROM (
        SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 공급가액 FROM sales
        UNION ALL
        SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 공급가액 FROM east_division_sales
        UNION ALL
        SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 공급가액 FROM west_division_sales
      ) s
      LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
      WHERE s.일자 BETWEEN '${startDate}' AND '${endDate}'
        AND ct.영일분류 IS NOT NULL
      GROUP BY ct.모빌분류, ct.산업분류, ct.영일분류, team_name
      ORDER BY ct.모빌분류, ct.산업분류, total_amount DESC
    `;

    console.log('Executing B2B industry query:', query);

    const result = await executeSQL(query);
    const data = result?.rows || [];

    // Get filter options
    const filterOptionsQuery = `
      SELECT DISTINCT
        ct.모빌분류,
        ct.산업분류,
        ct.영일분류
      FROM company_type ct
      WHERE ct.모빌분류 IS NOT NULL OR ct.산업분류 IS NOT NULL
      ORDER BY ct.모빌분류, ct.산업분류
    `;

    const filterResult = await executeSQL(filterOptionsQuery);
    const filterOptions = filterResult?.rows || [];

    return NextResponse.json({
      success: true,
      data,
      filterOptions,
      availableMonths,
      currentMonth: resolvedMonth,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch B2B industry data',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
