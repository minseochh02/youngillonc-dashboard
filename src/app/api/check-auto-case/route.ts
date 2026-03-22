import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function GET() {
  try {
    // Check employee_category for any 화성 related entries
    const categoryQuery = `
      SELECT * FROM employee_category
      WHERE 담당자 LIKE '%화성%'
      OR 담당자 LIKE '%AUTO%'
      OR 담당자 LIKE '%auto%'
    `;

    const categoryResult = await executeSQL(categoryQuery);

    // Check employees table
    const employeeQuery = `
      SELECT * FROM employees
      WHERE 사원_담당_명 LIKE '%화성%'
      OR 사원_담당_명 LIKE '%AUTO%'
      OR 사원_담당_명 LIKE '%auto%'
    `;

    const employeeResult = await executeSQL(employeeQuery);

    // Try the join with exact match
    const joinTest = `
      SELECT
        e.사원_담당_코드,
        e.사원_담당_명,
        ec.담당자,
        ec.전체사업소,
        CASE
          WHEN e.사원_담당_명 = ec.담당자 THEN 'EXACT MATCH'
          ELSE 'NO MATCH'
        END as match_status
      FROM employees e
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE e.사원_담당_명 LIKE '%화성%'
    `;

    const joinResult = await executeSQL(joinTest);

    return NextResponse.json({
      success: true,
      employee_category_records: categoryResult.rows || [],
      employees_records: employeeResult.rows || [],
      join_test: joinResult.rows || []
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
