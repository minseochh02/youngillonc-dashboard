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
    // Clean numeric strings (remove commas) and use correct keywords (MOBIL, FLA)
    const query = `
      SELECT 
        COALESCE(s.branch, p.branch) as branch,
        COALESCE(s.totalSales, 0) as totalSales,
        COALESCE(s.mobileSalesAmount, 0) as mobileSalesAmount,
        COALESCE(s.mobileSalesWeight, 0) as mobileSalesWeight,
        COALESCE(s.flagshipSalesWeight, 0) as flagshipSalesWeight,
        COALESCE(p.mobilePurchaseWeight, 0) as mobilePurchaseWeight,
        COALESCE(p.flagshipPurchaseWeight, 0) as flagshipPurchaseWeight
      FROM (
        SELECT 
          COALESCE(창고명, '기타') as branch,
          SUM(CAST(REPLACE(합_계, ',', '') AS NUMERIC)) as totalSales,
          SUM(CASE WHEN 품목명_규격_ LIKE '%MOBIL%' THEN CAST(REPLACE(공급가액, ',', '') AS NUMERIC) ELSE 0 END) as mobileSalesAmount,
          SUM(CASE WHEN 품목명_규격_ LIKE '%MOBIL%' THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as mobileSalesWeight,
          SUM(CASE WHEN 품목그룹3코드 = 'FLA' THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipSalesWeight
        FROM sales
        WHERE 일자 = '${date}'
        GROUP BY COALESCE(창고명, '기타')
      ) s
      FULL OUTER JOIN (
        SELECT 
          COALESCE(창고명, '기타') as branch,
          SUM(CASE WHEN 품목명 LIKE '%MOBIL%' THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as mobilePurchaseWeight,
          SUM(CASE WHEN 품목그룹3코드 = 'FLA' THEN CAST(REPLACE(중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipPurchaseWeight
        FROM purchases
        WHERE 일자 = '${date}'
        GROUP BY COALESCE(창고명, '기타')
      ) p ON s.branch = p.branch
      ORDER BY totalSales DESC
    `;

    const resultData = await executeSQL(query);
    const data = resultData?.rows || [];

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
