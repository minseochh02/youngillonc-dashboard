import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Monthly Sales and Purchase Status for the current year
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2026';
    const includeVat = searchParams.get('includeVat') === 'true';

    const divisor = includeVat ? '1.0' : '1.1';

    // 1. Monthly Sales Data (by Client Branch Mapping)
    const salesQuery = `
      SELECT
        substr(s.일자, 1, 7) as month,
        CASE 
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%MB%' THEN 'MB'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%서울%' THEN 'MB'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%벤츠%' THEN 'MB'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%화성%' THEN '화성'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%창원%' THEN '창원'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%경남%' THEN '창원'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%남부%' THEN '남부'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%중부%' THEN '중부'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%서부%' THEN '서부'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%인천%' THEN '서부'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%동부%' THEN '동부'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%하남%' THEN '동부'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%제주%' THEN '제주'
          WHEN COALESCE(c2.거래처그룹1명, c1.거래처그룹1명) LIKE '%부산%' THEN '부산'
          ELSE '기타'
        END as branch,
        SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as totalSales,
        SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as mobileSalesAmount,
        SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as mobileSalesWeight,
        SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipSalesWeight
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c1 ON s.거래처코드 = c1.거래처코드
      LEFT JOIN clients c2 ON (s.실납업체 IS NOT NULL AND s.실납업체 != '' AND s.실납업체 = c2.거래처코드)
      WHERE s.일자 LIKE '${year}-%'
      GROUP BY 1, 2
      ORDER BY month ASC, 
        CASE branch
          WHEN '화성' THEN 1 WHEN 'MB' THEN 2 WHEN '창원' THEN 3
          WHEN '부산' THEN 4 WHEN '중부' THEN 5 WHEN '남부' THEN 6
          WHEN '서부' THEN 7 WHEN '제주' THEN 8 WHEN '동부' THEN 9
          ELSE 100
        END ASC
    `;

    // 2. Monthly Purchase Data (Using raw Warehouse Hierarchy Group)
    const purchaseQuery = `
      SELECT
        substr(p.일자, 1, 7) as month,
        COALESCE(w.계층그룹코드, w.창고명, p.창고코드) as branch,
        SUM(CAST(REPLACE(p.합_계, ',', '') AS NUMERIC) / ${divisor}) as totalPurchases,
        SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(p.합_계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as mobilePurchaseAmount,
        SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(p.중량, ',', '') AS NUMERIC) ELSE 0 END) as mobilePurchaseWeight,
        SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN CAST(REPLACE(p.중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipPurchaseWeight
      FROM purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON p.창고코드 = w.창고코드
      WHERE p.일자 LIKE '${year}-%'
      GROUP BY 1, 2
      ORDER BY month ASC, totalPurchases DESC
    `;

    const salesResult = await executeSQL(salesQuery);
    const purchaseResult = await executeSQL(purchaseQuery);

    const salesData = salesResult?.rows || [];
    const purchaseData = purchaseResult?.rows || [];

    // 3. Misc Mobil Footnote data for the year
    const miscMobilQuery = `
      SELECT
        SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as amount,
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
      salesData,
      purchaseData,
      miscMobil,
      year
    });
  } catch (error: any) {
    console.error('Monthly API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch monthly data'
    }, { status: 500 });
  }
}
