import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDatabase();

    const branchesQuery = `
      SELECT DISTINCT
        CASE
          WHEN ec.전체사업소 = '벤츠' THEN 'MB'
          WHEN ec.전체사업소 = '경남사업소' THEN '창원'
          WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
          WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
          WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
          WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
          WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
          WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
          WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
          ELSE ec.전체사업소
        END as branch_name
      FROM employee_category ec
      WHERE ec.전체사업소 IS NOT NULL
      ORDER BY branch_name
    `;

    const branches = (await db.all(branchesQuery))
      .map((row: any) => row.branch_name)
      .filter((b: string) => b && b !== '미분류');

    return NextResponse.json({
      success: true,
      data: {
        branches,
      },
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
}
