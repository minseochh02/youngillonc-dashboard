import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function GET() {
  try {
    // Check for duplicate 화성AUTO entries
    const checkQuery = `
      SELECT
        id,
        사원_담당_코드,
        사원_담당_명,
        imported_at
      FROM employees
      WHERE 사원_담당_명 LIKE '%화성%'
      ORDER BY 사원_담당_코드
    `;

    const result = await executeSQL(checkQuery);

    return NextResponse.json({
      success: true,
      employees: result.rows || []
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
