import { NextResponse } from 'next/server';
import { executeSQL, updateRows } from '../../../../egdesk-helpers';

export async function POST() {
  try {
    console.log('Updating 화성AUTO to lowercase 화성auto...');

    // Update employee_category to use lowercase (화성AUTO -> 화성auto)
    await updateRows(
      'employee_category',
      { 담당자: '화성auto' },
      { ids: [40] }
    );
    console.log('Updated employee_category id:40 to 화성auto');

    // Verify the fix
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

    const result = await executeSQL(verifyQuery);

    return NextResponse.json({
      success: true,
      message: 'Updated to lowercase: 화성AUTO -> 화성auto',
      verification: result.rows[0] || null
    });

  } catch (error: any) {
    console.error('Fix error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Fix failed',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
