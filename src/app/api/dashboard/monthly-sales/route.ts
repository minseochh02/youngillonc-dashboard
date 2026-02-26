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
          substr(일자, 1, 7) as month,
          REPLACE(REPLACE(COALESCE(거래처그룹1코드명, '기타'), '사업소', ''), '지사', '') as branch,
          SUM(CAST(REPLACE(합_계, ',', '') AS NUMERIC)) as totalSales,
          SUM(CASE WHEN 품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(공급가액, ',', '') AS NUMERIC) ELSE 0 END) as mobileSalesAmount,
          SUM(CASE WHEN 품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as mobileSalesWeight,
          SUM(CASE WHEN 품목그룹3코드 = 'FLA' THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipSalesWeight
        FROM sales
        WHERE 일자 LIKE '${year}-%'
        GROUP BY substr(일자, 1, 7), REPLACE(REPLACE(COALESCE(거래처그룹1코드명, '기타'), '사업소', ''), '지사', '')
      ) s
      FULL OUTER JOIN (
        SELECT 
          substr(일자, 1, 7) as month,
          REPLACE(REPLACE(COALESCE(거래처그룹1명, '기타'), '사업소', ''), '지사', '') as branch,
          SUM(CASE WHEN 품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as mobilePurchaseWeight,
          SUM(CASE WHEN 품목그룹3코드 = 'FLA' THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipPurchaseWeight
        FROM purchases
        WHERE 일자 LIKE '${year}-%'
        GROUP BY substr(일자, 1, 7), REPLACE(REPLACE(COALESCE(거래처그룹1명, '기타'), '사업소', ''), '지사', '')
      ) p ON s.month = p.month AND s.branch = p.branch
      ORDER BY month ASC, totalSales DESC
    `;

    const resultData = await executeSQL(query);
    const data = resultData?.rows || [];

    // Calculate Misc Mobil Footnote data for the year (Mobil products in 'AA' group)
    const miscMobilQuery = `
      SELECT 
        SUM(CAST(REPLACE(공급가액, ',', '') AS NUMERIC)) as amount,
        SUM(CAST(REPLACE(중량, ',', '') AS NUMERIC)) as weight,
        COUNT(*) as count
      FROM sales
      WHERE (품목명_규격_ LIKE 'MOBIL%' OR 품목명_규격_ LIKE 'Mobil%')
        AND 품목그룹1코드 = 'AA'
        AND 일자 LIKE '${year}-%'
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
