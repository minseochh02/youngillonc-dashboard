import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(request: Request) {
  try {
    // Exact same query as closing endpoint
    const date = '2025-11-01';
    const startDate = '2025-11-01';

    const salesQuery = `
      SELECT
        category,
        SUM(CASE WHEN 일자 < '${date}' THEN amount ELSE 0 END) as prevTotal,
        SUM(CASE WHEN 일자 = '${date}' THEN amount ELSE 0 END) as today,
        SUM(amount) as total,
        COUNT(*) as rowCount
      FROM (
        SELECT
          CASE
            WHEN c.거래처명 LIKE '메르세데스벤츠%' OR i.품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN c.거래처명 IN ('셰플러코리아 유한책임회사', '한백윤활유') OR i.품목그룹1코드 = 'FU' THEN '훅스'
            WHEN i.품목그룹1코드 = 'BL' THEN '블라자'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI') OR (i.품목그룹1코드 IS NULL AND (c.거래처명 = '테크젠 주식회사' OR w.창고명 = '창원')) THEN 'Mobil'
            ELSE '기타(셸 외 타사제품)'
          END as category,
          CASE
            WHEN c.거래처명 LIKE '메르세데스벤츠%' OR i.품목그룹1코드 = 'MB' THEN 0
            ELSE CAST(REPLACE(s.합계, ',', '') AS NUMERIC)
          END as amount,
          s.일자
        FROM sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (ec.전체사업소 = '경남사업소' OR w.창고명 = '창원' OR c.거래처명 = '테크젠 주식회사')
          AND s.일자 >= '${startDate}' AND s.일자 <= '${date}'
      )
      GROUP BY category
    `;

    const result = await executeSQL(salesQuery);

    return NextResponse.json({
      success: true,
      summary: result?.rows || []
    });
  } catch (error: any) {
    console.error('Sales Check Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to check sales data'
    }, { status: 500 });
  }
}
