import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

type ChangwonEmployeeRow = {
  사원_담당_코드?: string;
  사원_담당_명?: string;
  전체사업소?: string;
  b2c_팀?: string;
  total_weight: number | null;
  total_amount?: number | null;
  row_count?: number;
};

export async function GET() {
  try {
    // Get employees assigned to 창원
    const employeesQuery = `
      SELECT
        e.사원_담당_코드,
        e.사원_담당_명,
        ec.전체사업소,
        ec.b2c_팀,
        SUM(s.중량) as total_weight,
        SUM(s.합계) as total_amount,
        COUNT(*) as row_count
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
        AND s.일자 LIKE '2026-02-%'
        AND (ec.전체사업소 = '경남사업소' OR ec.전체사업소 = '창원사업소')
      GROUP BY e.사원_담당_코드, e.사원_담당_명, ec.전체사업소, ec.b2c_팀
      ORDER BY total_weight DESC
    `;

    const result = (await executeSQL(employeesQuery)) as {
      rows: ChangwonEmployeeRow[];
    };

    // Calculate total for percentage
    const total = result.rows.reduce(
      (sum: number, row: ChangwonEmployeeRow) =>
        sum + (row.total_weight ?? 0),
      0
    );

    // Add percentage to each row
    const withPercentage = result.rows.map((row: ChangwonEmployeeRow) => ({
      ...row,
      percentage:
        total === 0
          ? '0.00'
          : (((row.total_weight ?? 0) / total) * 100).toFixed(2)
    }));

    return NextResponse.json({
      success: true,
      employees: withPercentage,
      total_weight: total,
      employee_count: result.rows.length
    });

  } catch (error: any) {
    console.error('Query error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Query failed',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
