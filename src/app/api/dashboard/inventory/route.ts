import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint for Simple Inventory Status (재고현황)
 * Only returns warehouse stock and pending info.
 */
export async function GET(request: Request) {
  try {
    // 1. Inventory by item × warehouse
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

    // 2. Pending sales (미판매) by item
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

    // 3. Pending purchases (미구매) by item
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

    // 4. Distinct warehouses for filters
    const warehouses = await executeSQL(`
      SELECT DISTINCT 창고명 as warehouse FROM inventory WHERE 창고명 IS NOT NULL ORDER BY 창고명
    `);

    return NextResponse.json({
      success: true,
      data: {
        inventoryByItem: inventoryByItem?.rows || [],
        pendingSales: pendingSales?.rows || [],
        pendingPurchases: pendingPurchases?.rows || [],
        warehouses: (warehouses?.rows || []).map((r: any) => r.warehouse),
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
