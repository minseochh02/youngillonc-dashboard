import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function GET() {
  try {
    // Check employee_category for duplicates
    const checkQuery = `
      SELECT
        id,
        담당자,
        전체사업소,
        b2c_팀,
        imported_at
      FROM employee_category
      WHERE 담당자 LIKE '%화성%'
      ORDER BY id
    `;

    const result = await executeSQL(checkQuery);

    return NextResponse.json({
      success: true,
      categories: result.rows || []
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
