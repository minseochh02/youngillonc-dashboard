import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const division = searchParams.get('division') || 'all';
    const month = searchParams.get('month') || '';

    const divisionFilter = division === 'all'
      ? ''
      : `AND division = '${division}'`;

    const monthFilter = month
      ? `AND 일자 LIKE '${month}%'`
      : '';

    // 1. Sales by item × division (부서별 판매 현황)
    const salesByItem = await executeSQL(`
      SELECT
        품목코드,
        품목명_규격_ as item_name,
        division,
        SUM(CAST(REPLACE(수량, ',', '') AS NUMERIC)) as sold_qty,
        SUM(CAST(REPLACE(COALESCE(합_계, '0'), ',', '') AS NUMERIC)) as sold_amount
      FROM (
        SELECT *,
          CASE
            WHEN 거래처그룹1코드명 = 'MB' THEN 'MB'
            WHEN 거래처그룹1코드명 LIKE '%화성%' THEN '화성'
            WHEN 거래처그룹1코드명 LIKE '%창원%' THEN '창원'
            WHEN 거래처그룹1코드명 LIKE '%남부%' THEN '남부'
            WHEN 거래처그룹1코드명 LIKE '%중부%' THEN '중부'
            WHEN 거래처그룹1코드명 LIKE '%서부%' THEN '서부'
            WHEN 거래처그룹1코드명 LIKE '%동부%' THEN '동부'
            WHEN 거래처그룹1코드명 LIKE '%제주%' THEN '제주'
            WHEN 거래처그룹1코드명 LIKE '%부산%' THEN '부산'
            ELSE REPLACE(REPLACE(거래처그룹1코드명, '사업소', ''), '지사', '')
          END as division
        FROM sales
        WHERE 1=1 ${monthFilter}
      ) sub
      WHERE 1=1 ${divisionFilter}
      GROUP BY 품목코드, 품목명_규격_, division
      ORDER BY sold_qty DESC
    `);

    // 2. Inventory by item × warehouse (창고별 재고)
    const inventoryByItem = await executeSQL(`
      SELECT
        품목코드,
        품목명_규격_ as item_name,
        창고명 as warehouse,
        CAST(REPLACE(재고수량, ',', '') AS NUMERIC) as stock_qty
      FROM inventory
      WHERE CAST(REPLACE(재고수량, ',', '') AS NUMERIC) > 0
      ORDER BY 품목코드, 창고명
    `);

    // 3. Pending sales (미판매) by item
    const pendingSales = await executeSQL(`
      SELECT
        품목코드,
        품명_및_규격 as item_name,
        거래처명 as customer,
        CAST(REPLACE(잔량, ',', '') AS NUMERIC) as remaining_qty,
        CAST(REPLACE(COALESCE(공급가액, '0'), ',', '') AS NUMERIC) as supply_amount,
        납기일자 as due_date,
        적요 as memo
      FROM pending_sales
      ORDER BY 품목코드
    `);

    // 4. Pending purchases (미구매) by item
    const pendingPurchases = await executeSQL(`
      SELECT
        품목코드,
        품명_및_규격 as item_name,
        거래처명 as supplier,
        CAST(REPLACE(잔량, ',', '') AS NUMERIC) as remaining_qty,
        CAST(REPLACE(COALESCE(합계, '0'), ',', '') AS NUMERIC) as outstanding_total,
        납기일자 as due_date,
        COALESCE(창고명, '') as warehouse
      FROM pending_purchases
      ORDER BY 품목코드
    `);

    // 5. Distinct warehouses & divisions for filters
    const warehouses = await executeSQL(`
      SELECT DISTINCT 창고명 as warehouse FROM inventory WHERE 창고명 IS NOT NULL ORDER BY 창고명
    `);

    const divisions = await executeSQL(`
      SELECT DISTINCT
        CASE
          WHEN 거래처그룹1코드명 = 'MB' THEN 'MB'
          WHEN 거래처그룹1코드명 LIKE '%화성%' THEN '화성'
          WHEN 거래처그룹1코드명 LIKE '%창원%' THEN '창원'
          WHEN 거래처그룹1코드명 LIKE '%남부%' THEN '남부'
          WHEN 거래처그룹1코드명 LIKE '%중부%' THEN '중부'
          WHEN 거래처그룹1코드명 LIKE '%서부%' THEN '서부'
          WHEN 거래처그룹1코드명 LIKE '%동부%' THEN '동부'
          WHEN 거래처그룹1코드명 LIKE '%제주%' THEN '제주'
          WHEN 거래처그룹1코드명 LIKE '%부산%' THEN '부산'
          ELSE REPLACE(REPLACE(거래처그룹1코드명, '사업소', ''), '지사', '')
        END as division
      FROM sales
      WHERE 거래처그룹1코드명 IS NOT NULL
      ORDER BY 1
    `);

    // 6. Available months for filter
    const months = await executeSQL(`
      SELECT DISTINCT SUBSTR(일자, 1, 7) as month
      FROM sales
      WHERE 일자 IS NOT NULL
      ORDER BY month DESC
      LIMIT 24
    `);

    return NextResponse.json({
      success: true,
      data: {
        salesByItem: salesByItem?.rows || [],
        inventoryByItem: inventoryByItem?.rows || [],
        pendingSales: pendingSales?.rows || [],
        pendingPurchases: pendingPurchases?.rows || [],
        warehouses: (warehouses?.rows || []).map((r: any) => r.warehouse),
        divisions: (divisions?.rows || []).map((r: any) => r.division).filter(Boolean),
        months: (months?.rows || []).map((r: any) => r.month),
      },
    });
  } catch (error: any) {
    console.error('Inventory API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
