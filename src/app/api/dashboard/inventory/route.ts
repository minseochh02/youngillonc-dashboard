import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';
import {
  combinedInventorySnapshotJoinFromSql,
  snapshotItemNameExpr,
} from '@/lib/inventory-snapshot-combined';

/**
 * API Endpoint for Simple Inventory Status (재고현황)
 * Only returns warehouse stock and pending info.
 */
export async function GET(request: Request) {
  try {
    // 1. Inventory by item × warehouse
    const inventoryByItem = await executeSQL(`
      SELECT
        inv.품목코드,
        ${snapshotItemNameExpr} as item_name,
        w.창고명 as warehouse,
        CAST(REPLACE(inv.재고수량, ',', '') AS NUMERIC) as stock_qty
      ${combinedInventorySnapshotJoinFromSql()}
      WHERE CAST(REPLACE(inv.재고수량, ',', '') AS NUMERIC) > 0
      ORDER BY inv.품목코드, w.창고명
    `);

    // 2. Pending sales (미판매) by item
    const pendingSales = await executeSQL(`
      SELECT
        ps.품목코드,
        (i.품목명 || ' ' || COALESCE(i.규격정보, '')) as item_name,
        c.거래처명 as customer,
        CAST(REPLACE(ps.잔량, ',', '') AS NUMERIC) as remaining_qty,
        CAST(REPLACE(COALESCE(ps.합계, '0'), ',', '') AS NUMERIC) as supply_amount,
        ps.납기일자 as due_date,
        ps.적요 as memo
      FROM pending_sales ps
      LEFT JOIN items i ON ps.품목코드 = i.품목코드
      LEFT JOIN clients c ON ps.거래처코드 = c.거래처코드
      ORDER BY ps.품목코드
    `);

    // 3. Pending purchases (미구매) by item
    const pendingPurchases = await executeSQL(`
      SELECT
        pp.품목코드,
        (i.품목명 || ' ' || COALESCE(i.규격정보, '')) as item_name,
        c.거래처명 as supplier,
        CAST(REPLACE(pp.잔량, ',', '') AS NUMERIC) as remaining_qty,
        CAST(REPLACE(COALESCE(pp.합계, '0'), ',', '') AS NUMERIC) as outstanding_total,
        pp.납기일자 as due_date,
        pp.창고명 as warehouse
      FROM pending_purchases pp
      LEFT JOIN items i ON pp.품목코드 = i.품목코드
      LEFT JOIN clients c ON pp.거래처코드 = c.거래처코드
      ORDER BY pp.품목코드
    `);

    // 4. Distinct warehouses for filters
    const warehouses = await executeSQL(`
      SELECT DISTINCT w.창고명 as warehouse
      ${combinedInventorySnapshotJoinFromSql()}
      WHERE w.창고명 IS NOT NULL
      ORDER BY w.창고명
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
