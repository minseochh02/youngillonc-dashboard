import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Monthly Sales Status for the current year
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2026';

    // Aggregate sales and purchase data by Month and Branch for the specific year
    const query = `
      SELECT 
        COALESCE(s.month, p.month) as month,
        COALESCE(s.branch, p.branch) as branch,
        COALESCE(s.totalSales, 0) as totalSales,
        COALESCE(s.mobileSalesAmount, 0) as mobileSalesAmount,
        COALESCE(s.mobileSalesWeight, 0) as mobileSalesWeight,
        COALESCE(s.flagshipSalesWeight, 0) as flagshipSalesWeight,
        COALESCE(p.mobilePurchaseWeight, 0) as mobilePurchaseWeight,
        COALESCE(p.flagshipPurchaseWeight, 0) as flagshipPurchaseWeight
      FROM (
        SELECT
          substr(s.일자, 1, 7) as month,
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
            ELSE REPLACE(REPLACE(ec.전체사업소, '사업소', ''), '지사', '')
          END as branch,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as totalSales,
          SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(s.공급가액, ',', '') AS NUMERIC) ELSE 0 END) as mobileSalesAmount,
          SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as mobileSalesWeight,
          SUM(CASE WHEN i.품목그룹3코드 = 'FLA' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipSalesWeight
        FROM sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 LIKE '${year}-%'
          AND (ec.전체사업소 LIKE '%사업소%' OR ec.전체사업소 LIKE '%지사%' OR ec.전체사업소 = '벤츠')
        GROUP BY 1, 2
      ) s
      FULL OUTER JOIN (
        SELECT 
          substr(일자, 1, 7) as month,
          CASE 
            WHEN 거래처그룹1명 = 'MB' THEN 'MB'
            WHEN 거래처그룹1명 LIKE '%화성%' THEN '화성'
            WHEN 거래처그룹1명 LIKE '%창원%' THEN '창원'
            WHEN 거래처그룹1명 LIKE '%남부%' THEN '남부'
            WHEN 거래처그룹1명 LIKE '%중부%' THEN '중부'
            WHEN 거래처그룹1명 LIKE '%서부%' THEN '서부'
            WHEN 거래처그룹1명 LIKE '%동부%' THEN '동부'
            WHEN 거래처그룹1명 LIKE '%제주%' THEN '제주'
            WHEN 거래처그룹1명 LIKE '%부산%' THEN '부산'
            ELSE REPLACE(REPLACE(거래처그룹1명, '사업소', ''), '지사', '')
          END as branch,
          SUM(CASE WHEN 품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as mobilePurchaseWeight,
          SUM(CASE WHEN 품목그룹3코드 = 'FLA' THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipPurchaseWeight
        FROM purchases
        WHERE 일자 LIKE '${year}-%'
          AND (거래처그룹1명 LIKE '%사업소%' OR 거래처그룹1명 LIKE '%지사%' OR 거래처그룹1명 = 'MB')
        GROUP BY 1, 2
      ) p ON s.month = p.month AND s.branch = p.branch
      ORDER BY month ASC, totalSales DESC
    `;

    const resultData = await executeSQL(query);
    const data = resultData?.rows || [];

    // Calculate Misc Mobil Footnote data for the year (Mobil products in 'AA' group)
    const miscMobilQuery = `
      SELECT
        SUM(CAST(REPLACE(s.공급가액, ',', '') AS NUMERIC)) as amount,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
        COUNT(*) as count
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE (i.품목명 LIKE 'MOBIL%' OR i.품목명 LIKE 'Mobil%')
        AND i.품목그룹1코드 = 'AA'
        AND s.일자 LIKE '${year}-%'
    `;
    const miscResult = await executeSQL(miscMobilQuery);
    const miscMobil = miscResult?.rows?.[0] || { amount: 0, weight: 0, count: 0 };

    return NextResponse.json({
      success: true,
      data,
      miscMobil,
      year
    });
  } catch (error: any) {
    console.error('Monthly API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch monthly sales data'
    }, { status: 500 });
  }
}
