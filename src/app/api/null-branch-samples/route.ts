import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function GET() {
  try {
    const nullBranchQuery = `
      SELECT
        s.일자,
        s.거래처코드,
        s.품목코드,
        i.품목명,
        i.품목그룹1코드,
        s.중량,
        s.합계,
        s.담당자코드,
        e.사원_담당_명,
        ec.전체사업소,
        ec.b2c_팀
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
        AND s.일자 LIKE '2026-02-%'
        AND ec.전체사업소 IS NULL
      LIMIT 10
    `;

    const result = await executeSQL(nullBranchQuery);

    return NextResponse.json({
      success: true,
      samples: result.rows || []
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
