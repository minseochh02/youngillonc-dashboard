import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function GET() {
  try {
    // Query for Mobil products by 사업소 (branch)
    // 김도량 transactions separated by customer code: YI90000=동부, YI90001=서부
    const mobilByBranchQuery = `
      SELECT
        CASE
          WHEN e.사원_담당_명 = '김도량' AND s.거래처코드 = 'YI90000' THEN '동부'
          WHEN e.사원_담당_명 = '김도량' AND s.거래처코드 = 'YI90001' THEN '서부'
          WHEN ec.전체사업소 = '벤츠' OR ec.전체사업소 = 'MB' THEN 'MB'
          WHEN ec.전체사업소 = '경남사업소' OR ec.전체사업소 = '창원사업소' THEN '창원'
          WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
          WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
          WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
          WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
          WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
          WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
          WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
          ELSE '기타'
        END as branch,
        SUM(s.중량) as total_weight,
        SUM(s.합계) as total_amount,
        COUNT(*) as row_count
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
        AND s.일자 LIKE '2026-02-%'
      GROUP BY branch
      ORDER BY
        CASE branch
          WHEN '화성' THEN 1
          WHEN 'MB' THEN 2
          WHEN '창원' THEN 3
          WHEN '부산' THEN 4
          WHEN '중부' THEN 5
          WHEN '남부' THEN 6
          WHEN '서부' THEN 7
          WHEN '제주' THEN 8
          WHEN '동부' THEN 9
          ELSE 10
        END ASC
    `;

    const branchResult = await executeSQL(mobilByBranchQuery);

    // Query for total Mobil products (including 김도량)
    const mobilTotalQuery = `
      SELECT
        SUM(s.중량) as total_weight,
        SUM(s.합계) as total_amount,
        COUNT(*) as row_count
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
      WHERE i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
        AND s.일자 LIKE '2026-02-%'
    `;

    const mobilTotalResult = await executeSQL(mobilTotalQuery);

    // Query for all products total
    const allQuery = `
      SELECT
        SUM(중량) as total_weight,
        SUM(합계) as total_amount,
        COUNT(*) as row_count
      FROM sales
      WHERE 일자 LIKE '2026-02-%'
    `;

    const allResult = await executeSQL(allQuery);

    return NextResponse.json({
      success: true,
      byBranch: branchResult.rows || [],
      mobilTotal: {
        totalWeight: mobilTotalResult.rows[0]?.total_weight || 0,
        totalAmount: mobilTotalResult.rows[0]?.total_amount || 0,
        rowCount: mobilTotalResult.rows[0]?.row_count || 0
      },
      allProducts: {
        totalWeight: allResult.rows[0]?.total_weight || 0,
        totalAmount: allResult.rows[0]?.total_amount || 0,
        rowCount: allResult.rows[0]?.row_count || 0
      }
    });

  } catch (error: any) {
    console.error('Test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Test failed',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
