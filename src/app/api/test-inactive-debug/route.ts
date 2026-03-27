import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const month = '2026-02';
    const inactiveMonths = 3;

    const selectedDate = new Date(month + '-01');
    const cutoffDate = new Date(selectedDate);
    cutoffDate.setMonth(cutoffDate.getMonth() - inactiveMonths);
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 10);
    const selectedMonthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString().slice(0, 10);

    console.log('cutoffDateStr:', cutoffDateStr);
    console.log('selectedMonthEnd:', selectedMonthEnd);

    // Test 1: Simple query without employee filter
    const simpleQuery = await executeSQL(`
      SELECT
        c.거래처코드 as client_code,
        c.거래처명 as client_name,
        MAX(s.일자) as last_transaction_date,
        CAST(JULIANDAY('${selectedMonthEnd}') - JULIANDAY(MAX(s.일자)) AS INTEGER) as days_inactive
      FROM clients c
      LEFT JOIN (
        SELECT 거래처코드, 일자 FROM sales
        UNION ALL
        SELECT 거래처코드, 일자 FROM east_division_sales
        UNION ALL
        SELECT 거래처코드, 일자 FROM west_division_sales
      ) s ON c.거래처코드 = s.거래처코드
        AND s.일자 <= '${selectedMonthEnd}'
      WHERE c.거래처코드 IS NOT NULL
      GROUP BY c.거래처코드, c.거래처명
      HAVING last_transaction_date IS NULL OR last_transaction_date < '${cutoffDateStr}'
      LIMIT 10
    `);

    // Test 2: Query with employee filter (current logic)
    const withEmployeeFilter = await executeSQL(`
      SELECT
        c.거래처코드 as client_code,
        c.거래처명 as client_name,
        e.사원_담당_명 as employee_name,
        MAX(s.일자) as last_transaction_date
      FROM clients c
      LEFT JOIN (
        SELECT 거래처코드, 일자, 담당자코드, NULL as 담당자명 FROM sales
        UNION ALL
        SELECT 거래처코드, 일자, 담당자코드, NULL as 담당자명 FROM east_division_sales
        UNION ALL
        SELECT 거래처코드, 일자, 담당자코드, NULL as 담당자명 FROM west_division_sales
      ) s ON c.거래처코드 = s.거래처코드
        AND s.일자 <= '${selectedMonthEnd}'
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      WHERE c.거래처코드 IS NOT NULL
        AND e.사원_담당_명 != '김도량'
      GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명
      HAVING last_transaction_date IS NULL OR last_transaction_date < '${cutoffDateStr}'
      LIMIT 10
    `);

    // Test 3: Query with fixed employee filter
    const withFixedEmployeeFilter = await executeSQL(`
      SELECT
        c.거래처코드 as client_code,
        c.거래처명 as client_name,
        e.사원_담당_명 as employee_name,
        MAX(s.일자) as last_transaction_date
      FROM clients c
      LEFT JOIN (
        SELECT 거래처코드, 일자, 담당자코드, NULL as 담당자명 FROM sales
        UNION ALL
        SELECT 거래처코드, 일자, 담당자코드, NULL as 담당자명 FROM east_division_sales
        UNION ALL
        SELECT 거래처코드, 일자, 담당자코드, NULL as 담당자명 FROM west_division_sales
      ) s ON c.거래처코드 = s.거래처코드
        AND s.일자 <= '${selectedMonthEnd}'
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      WHERE c.거래처코드 IS NOT NULL
        AND (e.사원_담당_명 IS NULL OR e.사원_담당_명 != '김도량')
      GROUP BY c.거래처코드, c.거래처명, e.사원_담당_명
      HAVING last_transaction_date IS NULL OR last_transaction_date < '${cutoffDateStr}'
      LIMIT 10
    `);

    return NextResponse.json({
      success: true,
      params: {
        month,
        inactiveMonths,
        cutoffDateStr,
        selectedMonthEnd
      },
      results: {
        simpleQuery: simpleQuery.rows,
        withEmployeeFilter: withEmployeeFilter.rows,
        withFixedEmployeeFilter: withFixedEmployeeFilter.rows,
      },
    });
  } catch (error) {
    console.error('Error testing inactive debug:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test inactive debug',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
