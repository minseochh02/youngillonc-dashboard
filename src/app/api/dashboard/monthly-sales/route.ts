import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Monthly Sales and Purchase Status for the current year
 * Returns separate datasets for sales and purchases grouped by Office and Warehouse.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2026';
    const includeVat = searchParams.get('includeVat') === 'true';

    // Sales amount calculation: with VAT uses 합계, without VAT uses 수량×단가
    const salesAmountExpr = includeVat
      ? 'CAST(REPLACE(s.합계, \',\', \'\') AS NUMERIC)'
      : '(CAST(REPLACE(s.수량, \',\', \'\') AS NUMERIC) * s.단가)';

    // Purchase amount calculation: with VAT uses 합_계, without VAT uses 공급가액
    const purchaseAmountExpr = includeVat
      ? 'CAST(REPLACE(p.합_계, \',\', \'\') AS NUMERIC)'
      : 'CAST(REPLACE(p.공급가액, \',\', \'\') AS NUMERIC)';

    const officeMapping = `
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
      END
    `;

    const metrics = `
      SUM(${salesAmountExpr}) as totalSales,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as totalSalesWeight,
      SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN ${salesAmountExpr} ELSE 0 END) as mobileSalesAmount,
      SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as mobileSalesWeight,
      SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN ${salesAmountExpr} ELSE 0 END) as flagshipSalesAmount,
      SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipSalesWeight
    `;

    const purchaseMetrics = `
      SUM(${purchaseAmountExpr}) as totalPurchases,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as totalPurchaseWeight,
      SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN ${purchaseAmountExpr} ELSE 0 END) as mobilePurchaseAmount,
      SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(p.중량, ',', '') AS NUMERIC) ELSE 0 END) as mobilePurchaseWeight,
      SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN ${purchaseAmountExpr} ELSE 0 END) as flagshipPurchaseAmount,
      SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN CAST(REPLACE(p.중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipPurchaseWeight
    `;

    // 1. Monthly Sales by Office
    const salesByOfficeQuery = `
      SELECT substr(s.일자, 1, 7) as month, ${officeMapping} as branch, ${metrics}
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c1 ON s.거래처코드 = c1.거래처코드
      LEFT JOIN clients c2 ON (s.실납업체 IS NOT NULL AND s.실납업체 != '' AND s.실납업체 = c2.거래처코드)
      WHERE s.일자 LIKE '${year}-%'
      GROUP BY 1, 2
    `;

    // 2. Monthly Sales by Warehouse
    const salesByWarehouseQuery = `
      SELECT substr(s.일자, 1, 7) as month, COALESCE(w.계층그룹코드, w.창고명, s.출하창고코드) as branch, ${metrics}
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
      WHERE s.일자 LIKE '${year}-%'
      GROUP BY 1, 2
    `;

    // 3. Monthly Purchase by Office
    const purchaseByOfficeQuery = `
      SELECT 
        substr(p.일자, 1, 7) as month,
        CASE 
          WHEN c1.거래처그룹1명 LIKE '%MB%' THEN 'MB'
          WHEN c1.거래처그룹1명 LIKE '%서울%' THEN 'MB'
          WHEN c1.거래처그룹1명 LIKE '%벤츠%' THEN 'MB'
          WHEN c1.거래처그룹1명 LIKE '%화성%' THEN '화성'
          WHEN c1.거래처그룹1명 LIKE '%창원%' THEN '창원'
          WHEN c1.거래처그룹1명 LIKE '%경남%' THEN '창원'
          WHEN c1.거래처그룹1명 LIKE '%남부%' THEN '남부'
          WHEN c1.거래처그룹1명 LIKE '%중부%' THEN '중부'
          WHEN c1.거래처그룹1명 LIKE '%서부%' THEN '서부'
          WHEN c1.거래처그룹1명 LIKE '%인천%' THEN '서부'
          WHEN c1.거래처그룹1명 LIKE '%동부%' THEN '동부'
          WHEN c1.거래처그룹1명 LIKE '%하남%' THEN '동부'
          WHEN c1.거래처그룹1명 LIKE '%제주%' THEN '제주'
          WHEN c1.거래처그룹1명 LIKE '%부산%' THEN '부산'
          ELSE '기타'
        END as branch, 
        ${purchaseMetrics}
      FROM purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      LEFT JOIN clients c1 ON p.거래처코드 = c1.거래처코드
      WHERE p.일자 LIKE '${year}-%'
      GROUP BY 1, 2
    `;

    // 4. Monthly Purchase by Warehouse
    const purchaseByWarehouseQuery = `
      SELECT substr(p.일자, 1, 7) as month, COALESCE(w.계층그룹코드, w.창고명, p.창고코드) as branch, ${purchaseMetrics}
      FROM purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON p.창고코드 = w.창고코드
      WHERE p.일자 LIKE '${year}-%'
      GROUP BY 1, 2
    `;

    const [salesOffice, salesWarehouse, purchaseOffice, purchaseWarehouse] = await Promise.all([
      executeSQL(salesByOfficeQuery),
      executeSQL(salesByWarehouseQuery),
      executeSQL(purchaseByOfficeQuery),
      executeSQL(purchaseByWarehouseQuery)
    ]);

    return NextResponse.json({
      success: true,
      salesData: salesOffice?.rows || [],
      salesByWarehouse: salesWarehouse?.rows || [],
      purchaseData: purchaseWarehouse?.rows || [],
      purchaseByOffice: purchaseOffice?.rows || [],
      year
    });
  } catch (error: any) {
    console.error('Monthly API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
