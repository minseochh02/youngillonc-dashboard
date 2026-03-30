import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint for Daily Inventory Status Sheet (일일재고파악시트)
 * Consolidates data from inventory, sales, and purchases.
 *
 * Logic:
 * Ending Inventory = (Feb 1st Snapshot) + (Purchases Feb 2nd to Date) - (Sales Feb 2nd to Date)
 * 재고폐기(disposed_inventory) is shown as 이동(transfer) and reduces ending stock like outbound.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const isFebruary = date.startsWith('2026-02');
    const isFeb1st = date === '2026-02-01';
    
    // Helpers
    const branchCase = (column: string) => `
      CASE
        WHEN ${column} = 'MB' THEN 'MB'
        WHEN ${column} LIKE '%중부%' THEN '중부'
        WHEN ${column} LIKE '%남부%' THEN '남부'
        WHEN ${column} LIKE '%서부%' THEN '서부'
        WHEN ${column} LIKE '%동부%' THEN '동부'
        WHEN ${column} LIKE '%화성%' THEN '화성'
        WHEN ${column} LIKE '%창원%' THEN '창원'
        WHEN ${column} LIKE '%제주%' THEN '제주'
        WHEN ${column} LIKE '%부산%' THEN '부산'
        ELSE REPLACE(REPLACE(REPLACE(REPLACE(${column}, '사업소', ''), '지사', ''), '본사', ''), ' ', '')
      END
    `;

    const categoryCase = (colPrefix: string) => `
      CASE
        WHEN ${colPrefix}.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
        WHEN ${colPrefix}.품목그룹1코드 = 'IL' THEN 'IL'
        WHEN ${colPrefix}.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
        ELSE 'Others'
      END
    `;

    const tierCase = (colPrefix: string) => `
      CASE
        WHEN ${colPrefix}.품목그룹1코드 IN ('MB', 'AVI') THEN 'All'
        WHEN ${colPrefix}.품목그룹3코드 = 'FLA' THEN 'Flagship'
        ELSE 'Others'
      END
    `;

    const weightCalc = (qtyCol: string, specCol: string) => `
      CAST(REPLACE(${qtyCol}, ',', '') AS NUMERIC) * CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${specCol}, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC)
    `;

    const warehouseFilter = (column: string) => `
      (${column} LIKE '%사업소%' OR ${column} LIKE '%지사%' OR ${column} = 'MB' OR ${column} LIKE '%화성%' OR ${column} LIKE '%창원%' OR ${column} LIKE '%남부%' OR ${column} LIKE '%중부%' OR ${column} LIKE '%서부%' OR ${column} LIKE '%동부%' OR ${column} LIKE '%제주%' OR ${column} LIKE '%부산%')
    `;

    // 1. Calculate Baseline (Inventory at start of 'date')
    let baselineSubquery = "";
    if (isFebruary) {
      baselineSubquery = `
        SELECT branch, category, tier, SUM(qty) as inv_qty, SUM(weight) as inv_weight
        FROM (
          -- Snapshot Feb 1 EOD (esz018r_6)
          SELECT ${branchCase('w.창고명')} as branch, ${categoryCase('p')} as category, ${tierCase('p')} as tier, 
                 CAST(REPLACE(e.재고수량, ',', '') AS NUMERIC) as qty, 
                 ${weightCalc('e.재고수량', 'p.규격정보')} as weight
          FROM esz018r_6 e
          LEFT JOIN warehouses w ON e.창고코드 = w.창고코드 OR CAST(e.창고코드 AS TEXT) = CAST(w.창고코드 AS TEXT)
          LEFT JOIN items p ON e.품목코드 = p.품목코드
          WHERE ${warehouseFilter('w.창고명')}
          
          UNION ALL
          
          -- Sales Roll forward (Deduct sales between Feb 2 and Date-1)
          SELECT ${branchCase('w.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 
                 ${isFeb1st ? '' : '-'}CAST(REPLACE(s.수량, ',', '') AS NUMERIC), 
                 ${isFeb1st ? '' : '-'}(${weightCalc('s.수량', 'i.규격정보')})
          FROM sales s
          LEFT JOIN items i ON s.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
          WHERE (
            ${isFeb1st 
              ? `s.일자 = '2026-02-01'`
              : `s.일자 >= '2026-02-02' AND s.일자 < '${date}'`
            }
          )
          AND ${warehouseFilter('w.창고명')}
            
          UNION ALL
          
          -- Purchases Roll forward (Add purchases between Feb 2 and Date-1)
          SELECT ${branchCase('w.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 
                 ${isFeb1st ? '-' : ''}CAST(REPLACE(p.수량, ',', '') AS NUMERIC), 
                 ${isFeb1st ? '-' : ''}${weightCalc('p.수량', 'i.규격정보')}
          FROM purchases p
          LEFT JOIN items i ON p.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON p.창고코드 = w.창고코드
          WHERE (
            ${isFeb1st 
              ? `p.일자 = '2026-02-01'`
              : `p.일자 >= '2026-02-02' AND p.일자 < '${date}'`
            }
          )
          AND ${warehouseFilter('w.창고명')}

          UNION ALL

          -- Internal Uses Roll forward (Deduct internal uses between Feb 2 and Date-1)
          SELECT ${branchCase('u.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 
                 ${isFeb1st ? '' : '-'}CAST(REPLACE(u.수량, ',', '') AS NUMERIC), 
                 ${isFeb1st ? '' : '-'}(${weightCalc('u.수량', 'i.규격정보')})
          FROM internal_uses u
          LEFT JOIN items i ON u.품목코드 = i.품목코드
          WHERE (
            ${isFeb1st 
              ? `u.일자 = '2026-02-01'`
              : `u.일자 >= '2026-02-02' AND u.일자 < '${date}'`
            }
          )
          AND ${warehouseFilter('u.창고명')}
        ) GROUP BY 1, 2, 3
      `;
    } else {
      baselineSubquery = `
        SELECT ${branchCase('i.창고명')} as branch, ${categoryCase('p')} as category, ${tierCase('p')} as tier, SUM(CAST(REPLACE(i.재고수량, ',', '') AS NUMERIC)) as inv_qty, SUM(${weightCalc('i.재고수량', 'p.규격정보')}) as inv_weight
        FROM inventory i
        LEFT JOIN items p ON i.품목코드 = p.품목코드
        WHERE ${warehouseFilter('i.창고명')}
          AND i.imported_at = (SELECT MAX(imported_at) FROM inventory WHERE DATE(imported_at) <= '${date}')
        GROUP BY 1, 2, 3
      `;
    }

    // 2. Final Union Query combining Baseline with Today's Transactions
    const query = `
      SELECT branch, category, tier,
        SUM(b_qty) as inventory_baseline, SUM(b_w) as inventory_baseline_weight,
        SUM(s_qty) as sales, SUM(s_w) as sales_weight,
        SUM(p_qty) as purchase, SUM(p_w) as purchase_weight
      FROM (
        -- I. Baseline (Beginning of Date)
        SELECT branch, category, tier, inv_qty as b_qty, inv_weight as b_w, 0 as s_qty, 0 as s_w, 0 as p_qty, 0 as p_w
        FROM (${baselineSubquery})
        
        UNION ALL
        
        -- II. Today's Sales
        SELECT ${branchCase('w.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(s.수량, ',', '') AS NUMERIC), ${weightCalc('s.수량', 'i.규격정보')}, 0, 0
        FROM sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        WHERE s.일자 = '${date}'
          AND ${warehouseFilter('w.창고명')}
          
        UNION ALL
        
        -- III. Today's Purchases
        SELECT ${branchCase('w.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, 0, 0, CAST(REPLACE(p.수량, ',', '') AS NUMERIC), ${weightCalc('p.수량', 'i.규격정보')}
        FROM purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON p.창고코드 = w.창고코드
        WHERE p.일자 = '${date}'
          AND ${warehouseFilter('w.창고명')}

        UNION ALL

        -- IV. Today's Internal Uses
        SELECT ${branchCase('u.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(u.수량, ',', '') AS NUMERIC), ${weightCalc('u.수량', 'i.규격정보')}, 0, 0
        FROM internal_uses u
        LEFT JOIN items i ON u.품목코드 = i.품목코드
        WHERE u.일자 = '${date}'
          AND ${warehouseFilter('u.창고명')}
      ) r GROUP BY 1, 2, 3
    `;

    const result = await executeSQL(query);
    const rows = result?.rows || [];

    const rollWhenDisposed = isFebruary
      ? isFeb1st
        ? `d.일자 = '2026-02-01'`
        : `d.일자 >= '2026-02-02' AND d.일자 < '${date}'`
      : `1 = 0`;

    const disposedSql = `
      SELECT
        ${branchCase('d.창고명')} AS branch,
        ${categoryCase('i')} AS category,
        ${tierCase('i')} AS tier,
        SUM(CASE WHEN d.일자 = '${date}' THEN CAST(REPLACE(d.수량, ',', '') AS NUMERIC) ELSE 0 END) AS transfer_qty,
        SUM(CASE WHEN d.일자 = '${date}' THEN ${weightCalc('d.수량', 'i.규격정보')} ELSE 0 END) AS transfer_w,
        SUM(CASE WHEN ${rollWhenDisposed} THEN CAST(REPLACE(d.수량, ',', '') AS NUMERIC) ELSE 0 END) AS roll_qty,
        SUM(CASE WHEN ${rollWhenDisposed} THEN ${weightCalc('d.수량', 'i.규격정보')} ELSE 0 END) AS roll_w
      FROM disposed_inventory d
      LEFT JOIN items i ON d.품목코드 = i.품목코드
      WHERE ${warehouseFilter('d.창고명')}
      GROUP BY 1, 2, 3
    `;

    let disposedRows: any[] = [];
    try {
      const disposedResult = await executeSQL(disposedSql);
      disposedRows = disposedResult?.rows || [];
    } catch (e) {
      console.warn('disposed_inventory query failed; transfer defaults to 0:', e);
    }

    const disposedMap = new Map<
      string,
      { transfer_qty: number; transfer_w: number; roll_qty: number; roll_w: number }
    >();
    for (const r of disposedRows) {
      const b = r.branch;
      const c = r.category || 'Others';
      const t = r.tier || 'Others';
      if (!b) continue;
      const k = `${b}|${c}|${t}`;
      disposedMap.set(k, {
        transfer_qty: Number(r.transfer_qty) || 0,
        transfer_w: Number(r.transfer_w) || 0,
        roll_qty: Number(r.roll_qty) || 0,
        roll_w: Number(r.roll_w) || 0,
      });
    }

    const rowKey = (row: { branch: string; category?: string; tier?: string }) =>
      `${row.branch}|${row.category || 'Others'}|${row.tier || 'Others'}`;

    const mergedRows = new Map<string, any>();
    for (const row of rows) {
      mergedRows.set(rowKey(row), row);
    }
    for (const r of disposedRows) {
      const k = rowKey(r);
      if (!mergedRows.has(k)) {
        mergedRows.set(k, {
          branch: r.branch,
          category: r.category,
          tier: r.tier,
          inventory_baseline: 0,
          inventory_baseline_weight: 0,
          purchase: 0,
          purchase_weight: 0,
          sales: 0,
          sales_weight: 0,
        });
      }
    }

    const stats: Record<string, any> = {};
    const branches = new Set<string>();

    for (const row of mergedRows.values()) {
      const branch = row.branch;
      if (!branch) continue;

      branches.add(branch);
      if (!stats[branch]) stats[branch] = {};

      const category = row.category || 'Others';
      const tier = row.tier || 'Others';
      const catKey = `${category}_${tier}`;
      const k = rowKey(row);
      const disp = disposedMap.get(k) || {
        transfer_qty: 0,
        transfer_w: 0,
        roll_qty: 0,
        roll_w: 0,
      };

      const beginning =
        (Number(row.inventory_baseline) || 0) - disp.roll_qty;
      const beginning_weight =
        (Number(row.inventory_baseline_weight) || 0) - disp.roll_w;
      const purchase = Number(row.purchase) || 0;
      const purchase_weight = Number(row.purchase_weight) || 0;
      const sales = Number(row.sales) || 0;
      const sales_weight = Number(row.sales_weight) || 0;
      const transfer = disp.transfer_qty;
      const transfer_weight = disp.transfer_w;

      const ending = beginning + purchase - sales - transfer;
      const ending_weight =
        beginning_weight + purchase_weight - sales_weight - transfer_weight;

      stats[branch][catKey] = {
        beginning,
        beginning_weight,
        purchase,
        purchase_weight,
        sales,
        sales_weight,
        transfer,
        transfer_weight,
        inventory: ending,
        inventory_weight: ending_weight,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        branches: Array.from(branches).sort(),
        stats,
        date
      }
    });
  } catch (error: any) {
    console.error('Daily Inventory API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
