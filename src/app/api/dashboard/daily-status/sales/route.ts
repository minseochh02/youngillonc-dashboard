import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Daily Sales and Purchase Status data
 * Returns separate datasets for sales and purchases grouped by Office and Warehouse.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const includeVat = searchParams.get('includeVat') === 'true';
    const editedOnly = searchParams.get('editedOnly') === 'true';

    const divisor = includeVat ? '1.0' : '1.1';
    const salesEditedExpr = `COALESCE(NULLIF(substr(COALESCE(s.최종수정일시, ''), 1, 10), ''), '')`;
    const purchaseEditedExpr = `COALESCE(NULLIF(substr(COALESCE(p.최종수정일시, ''), 1, 10), ''), '')`;
    const salesEditedCondition = `${salesEditedExpr} != '' AND ${salesEditedExpr} > s.일자`;
    const purchaseEditedCondition = `${purchaseEditedExpr} != '' AND ${purchaseEditedExpr} > p.일자`;
    const editedOnlySalesWhere = editedOnly ? ` AND ${salesEditedCondition}` : '';
    const editedOnlyPurchaseWhere = editedOnly ? ` AND ${purchaseEditedCondition}` : '';
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
      SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as totalSales,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as totalSalesWeight,
      SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as mobileSalesAmount,
      SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as mobileSalesWeight,
      SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as flagshipSalesAmount,
      SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipSalesWeight,
      SUM(CASE WHEN ${salesEditedCondition} THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as editedAmountImpact,
      COUNT(CASE WHEN ${salesEditedCondition} THEN 1 ELSE NULL END) as lateEntryCount
    `;

    const purchaseMetrics = `
      SUM(CAST(REPLACE(p.합_계, ',', '') AS NUMERIC) / ${divisor}) as totalPurchases,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as totalPurchaseWeight,
      SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(p.합_계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as mobilePurchaseAmount,
      SUM(CASE WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN CAST(REPLACE(p.중량, ',', '') AS NUMERIC) ELSE 0 END) as mobilePurchaseWeight,
      SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN CAST(REPLACE(p.합_계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as flagshipPurchaseAmount,
      SUM(CASE WHEN i.품목그룹1코드 IN ('AVI', 'CVL', 'PVL', 'MB', 'MAR', 'IL') AND i.품목그룹3코드 = 'FLA' THEN CAST(REPLACE(p.중량, ',', '') AS NUMERIC) ELSE 0 END) as flagshipPurchaseWeight,
      SUM(CASE WHEN ${purchaseEditedCondition} THEN CAST(REPLACE(p.합_계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as editedAmountImpact,
      COUNT(CASE WHEN ${purchaseEditedCondition} THEN 1 ELSE NULL END) as lateEntryCount
    `;

    // 1. Sales by Office
    const salesByOfficeQuery = `
      SELECT ${officeMapping} as branch, ${metrics}
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c1 ON s.거래처코드 = c1.거래처코드
      LEFT JOIN clients c2 ON (s.실납업체 IS NOT NULL AND s.실납업체 != '' AND s.실납업체 = c2.거래처코드)
      WHERE s.일자 = '${date}'${editedOnlySalesWhere}
      GROUP BY 1
    `;

    // 2. Sales by Warehouse
    const salesByWarehouseQuery = `
      SELECT COALESCE(w.계층그룹코드, w.창고명, s.출하창고코드) as branch, ${metrics}
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
      WHERE s.일자 = '${date}'${editedOnlySalesWhere}
      GROUP BY 1
    `;

    // 3. Purchase by Office
    const purchaseByOfficeQuery = `
      SELECT 
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
      WHERE p.일자 = '${date}'${editedOnlyPurchaseWhere}
      GROUP BY 1
    `;

    // 4. Purchase by Warehouse
    const purchaseByWarehouseQuery = `
      SELECT COALESCE(w.계층그룹코드, w.창고명, p.창고코드) as branch, ${purchaseMetrics}
      FROM purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON p.창고코드 = w.창고코드
      WHERE p.일자 = '${date}'${editedOnlyPurchaseWhere}
      GROUP BY 1
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
      date,
      editedOnly
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
