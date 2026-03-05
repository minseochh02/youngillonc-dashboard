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
            WHEN 판매처명 LIKE '메르세데스벤츠%' OR 품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN 판매처명 IN ('셰플러코리아 유한책임회사', '한백윤활유') OR 품목그룹1코드 = 'FU' THEN '훅스'
            WHEN 품목그룹1코드 = 'BL' THEN '블라자'
            WHEN 품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI') OR (품목그룹1코드 IS NULL AND (판매처명 = '테크젠 주식회사' OR 창고명 = '창원')) THEN 'Mobil'
            ELSE '기타(셸 외 타사제품)'
          END as category,
          CASE
            WHEN 판매처명 LIKE '메르세데스벤츠%' OR 품목그룹1코드 = 'MB' THEN 0
            ELSE CAST(REPLACE(합_계, ',', '') AS NUMERIC)
          END as amount,
          일자
        FROM sales
        WHERE (창고명 = '창원' OR 판매처명 = '테크젠 주식회사')
          AND 일자 >= '${startDate}' AND 일자 <= '${date}'
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
