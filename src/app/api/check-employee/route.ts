import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function GET() {
  try {
    // Check for 화성auto employee
    const employeeQuery = `
      SELECT
        e.*,
        ec.*
      FROM employees e
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE e.사원_담당_명 LIKE '%화성%'
      ORDER BY e.사원_담당_코드
    `;

    const result = await executeSQL(employeeQuery);

    // Also check all employees with null branches
    const nullBranchEmployees = `
      SELECT
        e.사원_담당_코드,
        e.사원_담당_명,
        ec.담당자,
        ec.전체사업소,
        ec.b2c_팀
      FROM employees e
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE ec.전체사업소 IS NULL
      ORDER BY e.사원_담당_명
    `;

    const nullBranchResult = await executeSQL(nullBranchEmployees);

    return NextResponse.json({
      success: true,
      hwaseongEmployees: result.rows || [],
      allNullBranchEmployees: nullBranchResult.rows || []
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
