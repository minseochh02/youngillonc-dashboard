import { NextResponse } from 'next/server';
import { executeSQL, deleteRows, updateRows } from '../../../../egdesk-helpers';

export async function POST() {
  try {
    console.log('Fixing duplicate 화성auto entries...');

    // Step 1: Delete the duplicate from employee_category (id: 48)
    await deleteRows('employee_category', { ids: [48] });
    console.log('Deleted duplicate employee_category entry (id: 48)');

    // Step 2: Update employees table to match the remaining entry (화성auto -> 화성AUTO)
    await updateRows(
      'employees',
      { 사원_담당_명: '화성AUTO' },
      { filters: { 사원_담당_코드: '66' } }
    );
    console.log('Updated employees table: 화성auto -> 화성AUTO');

    // Step 3: Verify the fix
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
      message: 'Fixed duplicate and case sensitivity',
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
