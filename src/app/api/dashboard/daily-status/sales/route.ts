import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Daily Sales Status data
 * Matches the structure of the "매출현황" table
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-03';

    // SQL to aggregate data from sales and purchases tables
    // 1. Sales metrics from 'sales' table (Total, Mobile Sales, Mobile/Flagship Weights)
    // 2. Purchase metrics from 'purchases' table (Mobile/Flagship Purchase Weights)
    // Grouped by Branch (창고명 or 거래처그룹1코드명 depending on data characteristics)
    
    const query = `
      WITH DailySales AS (
        SELECT 
          COALESCE(창고명, '기타') as branch,
          SUM(합_계) as totalSales,
          SUM(CASE WHEN 품목명_규격_ LIKE '%모빌%' THEN 공급가액 ELSE 0 END) as mobileSalesAmount,
          SUM(CASE WHEN 품목명_규격_ LIKE '%모빌%' THEN 중량 ELSE 0 END) as mobileSalesWeight,
          SUM(CASE WHEN 품목명_규격_ LIKE '%플래그십%' OR 품목명_규격_ LIKE '%Flagship%' THEN 중량 ELSE 0 END) as flagshipSalesWeight
        FROM sales
        WHERE 일자 = '${date}'
        GROUP BY COALESCE(창고명, '기타')
      ),
      DailyPurchases AS (
        SELECT 
          COALESCE(창고명, '기타') as branch,
          SUM(CASE WHEN 품목명 LIKE '%모빌%' THEN 중량 ELSE 0 END) as mobilePurchaseWeight,
          SUM(CASE WHEN 품목명 LIKE '%플래그십%' OR 품목명 LIKE '%Flagship%' THEN 중량 ELSE 0 END) as flagshipPurchaseWeight
        FROM purchases
        WHERE 일자 = '${date}'
        GROUP BY COALESCE(창고명, '기타')
      )
      SELECT 
        COALESCE(s.branch, p.branch) as branch,
        COALESCE(s.totalSales, 0) as totalSales,
        COALESCE(s.mobileSalesAmount, 0) as mobileSalesAmount,
        COALESCE(s.mobileSalesWeight, 0) as mobileSalesWeight,
        COALESCE(s.flagshipSalesWeight, 0) as flagshipSalesWeight,
        COALESCE(p.mobilePurchaseWeight, 0) as mobilePurchaseWeight,
        COALESCE(p.flagshipPurchaseWeight, 0) as flagshipPurchaseWeight
      FROM DailySales s
      FULL OUTER JOIN DailyPurchases p ON s.branch = p.branch
      ORDER BY totalSales DESC
    `;

    const data = await executeSQL(query);

    return NextResponse.json({
      success: true,
      data,
      date
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch sales status data'
    }, { status: 500 });
  }
}
