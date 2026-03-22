import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function POST() {
  try {
    // Update employees table to match employee_category case
    const updateQuery = `
      UPDATE employees
      SET 사원_담당_명 = '화성AUTO'
      WHERE 사원_담당_명 = '화성auto'
    `;

    await executeSQL(updateQuery);

    // Verify the update
    const verifyQuery = `
      SELECT
        e.사원_담당_코드,
        e.사원_담당_명,
        ec.담당자,
        ec.전체사업소,
        ec.b2c_팀
      FROM employees e
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE e.사원_담당_코드 = 66
    `;

    const verifyResult = await executeSQL(verifyQuery);

    return NextResponse.json({
      success: true,
      message: 'Updated 화성auto to 화성AUTO in employees table',
      verification: verifyResult.rows[0] || null
    });

  } catch (error: any) {
    console.error('Update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Update failed',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
