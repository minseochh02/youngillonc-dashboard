import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET() {
  try {
    // Get unique branches from clients table
    const query = `
      SELECT DISTINCT
        CASE
          WHEN 거래처그룹1명 = '벤츠' THEN 'MB'
          WHEN 거래처그룹1명 = '경남사업소' THEN '창원'
          WHEN 거래처그룹1명 LIKE '%화성%' THEN '화성'
          WHEN 거래처그룹1명 LIKE '%남부%' THEN '남부'
          WHEN 거래처그룹1명 LIKE '%중부%' THEN '중부'
          WHEN 거래처그룹1명 LIKE '%서부%' THEN '서부'
          WHEN 거래처그룹1명 LIKE '%동부%' THEN '동부'
          WHEN 거래처그룹1명 LIKE '%제주%' THEN '제주'
          WHEN 거래처그룹1명 LIKE '%부산%' THEN '부산'
          ELSE REPLACE(REPLACE(거래처그룹1명, '사업소', ''), '지사', '')
        END as branch_name
      FROM clients
      WHERE 거래처그룹1명 IS NOT NULL AND 거래처그룹1명 != ''
      ORDER BY branch_name
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
