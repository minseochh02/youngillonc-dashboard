import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint for Daily Inventory Status Sheet (일일재고파악시트)
 * Consolidates data from inventory, sales, purchases, and transfers.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-03';
    
    // Branch normalization CASE statement
    const branchCase = (column: string) => `
      CASE
        WHEN ${column} = 'MB' THEN 'MB'
        WHEN ${column} LIKE '%화성%' THEN '화성'
        WHEN ${column} LIKE '%창원%' THEN '창원'
        WHEN ${column} LIKE '%남부%' THEN '남부'
        WHEN ${column} LIKE '%중부%' THEN '중부'
        WHEN ${column} LIKE '%서부%' THEN '서부'
        WHEN ${column} LIKE '%동부%' THEN '동부'
        WHEN ${column} LIKE '%제주%' THEN '제주'
        WHEN ${column} LIKE '%부산%' THEN '부산'
        ELSE REPLACE(REPLACE(REPLACE(REPLACE(${column}, '사업소', ''), '지사', ''), '본사', ''), ' ', '')
      END
    `;

    // Unified SQL query using subqueries for better compatibility
    const query = `
      SELECT 
        branch,
        COALESCE(category, 'Others') as category,
        COALESCE(tier, 'Others') as tier,
        SUM(inv_qty) as inventory,
        SUM(sales_qty) as sales,
        SUM(purchase_qty) as purchase,
        SUM(transfer_qty) as transfer
      FROM (
        -- 1. Current Inventory (Ending Stock)
        SELECT 
          ${branchCase('창고명')} as branch,
          품목코드,
          CAST(REPLACE(재고수량, ',', '') AS NUMERIC) as inv_qty,
          0 as sales_qty,
          0 as purchase_qty,
          0 as transfer_qty
        FROM inventory
        WHERE (창고명 LIKE '%사업소%' OR 창고명 LIKE '%지사%' OR 창고명 = 'MB' OR 창고명 LIKE '%화성%' OR 창고명 LIKE '%창원%' OR 창고명 LIKE '%남부%' OR 창고명 LIKE '%중부%' OR 창고명 LIKE '%서부%' OR 창고명 LIKE '%동부%' OR 창고명 LIKE '%제주%' OR 창고명 LIKE '%부산%')

        UNION ALL

        -- 2. Sales (Outflow)
        SELECT 
          ${branchCase('거래처그룹1코드명')} as branch,
          품목코드,
          0 as inv_qty,
          CAST(REPLACE(수량, ',', '') AS NUMERIC) as sales_qty,
          0 as purchase_qty,
          0 as transfer_qty
        FROM sales
        WHERE 일자 = '${date}'
          AND (거래처그룹1코드명 LIKE '%사업소%' OR 거래처그룹1코드명 LIKE '%지사%' OR 거래처그룹1코드명 = 'MB' OR 거래처그룹1코드명 LIKE '%화성%' OR 거래처그룹1코드명 LIKE '%창원%' OR 거래처그룹1코드명 LIKE '%남부%' OR 거래처그룹1코드명 LIKE '%중부%' OR 거래처그룹1코드명 LIKE '%서부%' OR 거래처그룹1코드명 LIKE '%동부%' OR 거래처그룹1코드명 LIKE '%제주%' OR 거래처그룹1코드명 LIKE '%부산%')

        UNION ALL

        -- 3. Purchases (Inflow)
        SELECT 
          ${branchCase('거래처그룹1명')} as branch,
          품목코드,
          0 as inv_qty,
          0 as sales_qty,
          CAST(REPLACE(수량, ',', '') AS NUMERIC) as purchase_qty,
          0 as transfer_qty
        FROM purchases
        WHERE 일자 = '${date}'
          AND (거래처그룹1명 LIKE '%사업소%' OR 거래처그룹1명 LIKE '%지사%' OR 거래처그룹1명 = 'MB' OR 거래처그룹1명 LIKE '%화성%' OR 거래처그룹1명 LIKE '%창원%' OR 거래처그룹1명 LIKE '%남부%' OR 거래처그룹1명 LIKE '%중부%' OR 거래처그룹1명 LIKE '%서부%' OR 거래처그룹1명 LIKE '%동부%' OR 거래처그룹1명 LIKE '%제주%' OR 거래처그룹1명 LIKE '%부산%')

        UNION ALL

        -- 4. Transfers Out (Negative movement)
        SELECT 
          ${branchCase('출고창고')} as branch,
          품목코드,
          0 as inv_qty,
          0 as sales_qty,
          0 as purchase_qty,
          -CAST(REPLACE(수량, ',', '') AS NUMERIC) as transfer_qty
        FROM inventory_transfers
        WHERE (월_일 = '${date}' OR 월_일 = SUBSTR('${date}', 6, 5) OR 월_일 = REPLACE(SUBSTR('${date}', 6, 5), '-', '/'))
          AND (출고창고 LIKE '%사업소%' OR 출고창고 LIKE '%지사%' OR 출고창고 = 'MB' OR 출고창고 LIKE '%화성%' OR 출고창고 LIKE '%창원%' OR 출고창고 LIKE '%남부%' OR 출고창고 LIKE '%중부%' OR 출고창고 LIKE '%서부%' OR 출고창고 LIKE '%동부%' OR 출고창고 LIKE '%제주%' OR 출고창고 LIKE '%부산%')

        UNION ALL

        -- 5. Transfers In (Positive movement)
        SELECT 
          ${branchCase('입고창고')} as branch,
          품목코드,
          0 as inv_qty,
          0 as sales_qty,
          0 as purchase_qty,
          CAST(REPLACE(수량, ',', '') AS NUMERIC) as transfer_qty
        FROM inventory_transfers
        WHERE (월_일 = '${date}' OR 월_일 = SUBSTR('${date}', 6, 5) OR 월_일 = REPLACE(SUBSTR('${date}', 6, 5), '-', '/'))
          AND (입고창고 LIKE '%사업소%' OR 입고창고 LIKE '%지사%' OR 입고창고 = 'MB' OR 입고창고 LIKE '%화성%' OR 입고창고 LIKE '%창원%' OR 입고창고 LIKE '%남부%' OR 입고창고 LIKE '%중부%' OR 입고창고 LIKE '%서부%' OR 입고창고 LIKE '%동부%' OR 입고창고 LIKE '%제주%' OR 입고창고 LIKE '%부산%')
      ) r
      LEFT JOIN (
        SELECT DISTINCT 품목코드, 
          CASE 
            WHEN 품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
            WHEN 품목그룹1코드 = 'IL' THEN 'IL'
            WHEN 품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
            ELSE 'Others'
          END as category,
          CASE 
            WHEN 품목그룹3코드 = 'FLA' THEN 'Flagship'
            ELSE 'Others'
          END as tier
        FROM (
          SELECT 품목코드, 품목그룹1코드, 품목그룹3코드 FROM sales
          UNION
          SELECT 품목코드, 품목그룹1코드, 품목그룹3코드 FROM purchases
        )
      ) p ON r.품목코드 = p.품목코드
      GROUP BY 1, 2, 3
    `;

    const result = await executeSQL(query);
    const rows = result?.rows || [];

    const stats: Record<string, any> = {};
    const branches = new Set<string>();

    rows.forEach((row: any) => {
      const branch = row.branch;
      if (!branch) return;
      
      branches.add(branch);
      if (!stats[branch]) stats[branch] = {};

      const category = row.category || 'Others';
      const tier = row.tier || 'Others';
      const catKey = `${category}_${tier}`;
      
      // Calculate Beginning Inventory based on formula:
      // Beginning = Ending - Purchase + Sales - NetTransfer
      const beginning = (Number(row.inventory) || 0) 
                      - (Number(row.purchase) || 0) 
                      + (Number(row.sales) || 0) 
                      - (Number(row.transfer) || 0);

      stats[branch][catKey] = {
        beginning: beginning,
        purchase: Number(row.purchase) || 0,
        sales: Number(row.sales) || 0,
        transfer: Number(row.transfer) || 0,
        inventory: Number(row.inventory) || 0,
      };
    });

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
