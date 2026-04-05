import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function GET() {
  try {
    const query = `
      SELECT
        s.거래처코드,
        COUNT(*) as row_count,
        SUM(s.중량) as total_weight,
        SUM(s.합계) as total_amount
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      WHERE e.사원_담당_명 = '김도량'
        AND i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
        AND s.일자 LIKE '2026-02-%'
      GROUP BY s.거래처코드
      ORDER BY total_weight DESC
    `;

    const result = await executeSQL(query);

    return NextResponse.json({
      success: true,
      customers: result.rows || []
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
