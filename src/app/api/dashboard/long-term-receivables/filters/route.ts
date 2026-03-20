import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET() {
  try {
    // Get unique branches
    const query = `
      SELECT DISTINCT 사업소명 as branch_name
      FROM employees
      WHERE 사업소명 IS NOT NULL AND 사업소명 != ''
      ORDER BY 사업소명
    `;

    const result = await executeSQL(query);
    const branches = (result?.rows || []).map((b: any) => b.branch_name);

    return NextResponse.json({
      success: true,
      data: {
        branches,
      },
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch filter options',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
