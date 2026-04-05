import { NextResponse } from 'next/server';
import { executeSQL } from '../../../../egdesk-helpers';

export async function GET() {
  try {
    // Query to investigate "기타" records
    const investigateQuery = `
      SELECT
        e.사원_담당_명 as employee_name,
        ec.전체사업소 as branch_name,
        COUNT(*) as row_count,
        SUM(s.중량) as total_weight,
        SUM(s.합계) as total_amount
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
        AND s.일자 LIKE '2026-02-%'
        AND (
          ec.전체사업소 IS NULL
          OR (
            ec.전체사업소 != '벤츠'
            AND ec.전체사업소 != '경남사업소'
            AND ec.전체사업소 NOT LIKE '%화성%'
            AND ec.전체사업소 NOT LIKE '%남부%'
            AND ec.전체사업소 NOT LIKE '%중부%'
            AND ec.전체사업소 NOT LIKE '%서부%'
            AND ec.전체사업소 NOT LIKE '%동부%'
            AND ec.전체사업소 NOT LIKE '%제주%'
            AND ec.전체사업소 NOT LIKE '%부산%'
          )
        )
      GROUP BY e.사원_담당_명, ec.전체사업소
      ORDER BY total_weight DESC
    `;

    const investigateResult = await executeSQL(investigateQuery);

    // Get sample records for null branch
    const nullBranchSample = `
      SELECT
        s.*,
        e.사원_담당_명,
        ec.전체사업소,
        i.품목명
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
        AND s.일자 LIKE '2026-02-%'
        AND ec.전체사업소 IS NULL
      LIMIT 5
    `;

    const nullSample = await executeSQL(nullBranchSample);

    // Get sample records for "별도"
    const byeoldoSample = `
      SELECT
        s.*,
        e.사원_담당_명,
        ec.전체사업소,
        i.품목명
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
        AND s.일자 LIKE '2026-02-%'
        AND ec.전체사업소 = '별도'
      LIMIT 5
    `;

    const byeoldoSampleResult = await executeSQL(byeoldoSample);

    return NextResponse.json({
      success: true,
      breakdown: investigateResult.rows || [],
      nullBranchSamples: nullSample.rows || [],
      byeoldoSamples: byeoldoSampleResult.rows || []
    });

  } catch (error: any) {
    console.error('Investigate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Investigation failed',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
