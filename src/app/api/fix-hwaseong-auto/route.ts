import { NextResponse } from 'next/server';
import { executeSQL, updateRows } from '../../../../egdesk-helpers';

export async function POST() {
  try {
    console.log('Fixing 화성auto case sensitivity...');

    // Step 1: Check current state before update
    const beforeQuery = `
      SELECT
        e.사원_담당_코드,
        e.사원_담당_명,
        ec.담당자,
        ec.전체사업소
      FROM employees e
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE e.사원_담당_코드 = 66
    `;

    const beforeResult = await executeSQL(beforeQuery);
    console.log('Before:', beforeResult.rows[0]);

    // Step 2: Update employees table to match employee_category (화성auto -> 화성AUTO)
    await updateRows(
      'employees',
      { 사원_담당_명: '화성AUTO' },
      { filters: { 사원_담당_코드: '66' } }
    );

    console.log('Updated employee name from 화성auto to 화성AUTO');

    // Step 3: Verify the update
    const afterQuery = `
      SELECT
        e.사원_담당_코드,
        e.사원_담당_명,
        ec.담당자,
        ec.전체사업소
      FROM employees e
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE e.사원_담당_코드 = 66
    `;

    const afterResult = await executeSQL(afterQuery);
    console.log('After:', afterResult.rows[0]);

    return NextResponse.json({
      success: true,
      message: 'Fixed case sensitivity: 화성auto -> 화성AUTO',
      before: beforeResult.rows[0],
      after: afterResult.rows[0]
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
