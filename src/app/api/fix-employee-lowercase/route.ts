import { NextResponse } from 'next/server';
import { executeSQL, updateRows } from '../../../../egdesk-helpers';

export async function POST() {
  try {
    console.log('Updating employees table to lowercase 화성auto...');

    // Update employees table to lowercase (화성AUTO -> 화성auto)
    await updateRows(
      'employees',
      { 사원_담당_명: '화성auto' },
      { filters: { 사원_담당_코드: '66' } }
    );
    console.log('Updated employees table to 화성auto');

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
      message: 'Both tables now use lowercase: 화성auto',
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
