import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint for Daily Inventory Status Sheet (일일재고파악시트)
 * Consolidates data from inventory, sales, purchases, and transfers.
 *
 * Uses items table for categorization (품목그룹1코드, 품목그룹3코드)
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
          ${branchCase('i.창고명')} as branch,
          CASE
            WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
            WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
            WHEN p.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
            ELSE 'Others'
          END as category,
          CASE
            WHEN p.품목그룹3코드 = 'FLA' THEN 'Flagship'
            ELSE 'Others'
          END as tier,
          CAST(REPLACE(i.재고수량, ',', '') AS NUMERIC) as inv_qty,
          0 as sales_qty,
          0 as purchase_qty,
          0 as transfer_qty
        FROM inventory i
        LEFT JOIN items p ON i.품목코드 = p.품목코드
        WHERE (i.창고명 LIKE '%사업소%' OR i.창고명 LIKE '%지사%' OR i.창고명 = 'MB' OR i.창고명 LIKE '%화성%' OR i.창고명 LIKE '%창원%' OR i.창고명 LIKE '%남부%' OR i.창고명 LIKE '%중부%' OR i.창고명 LIKE '%서부%' OR i.창고명 LIKE '%동부%' OR i.창고명 LIKE '%제주%' OR i.창고명 LIKE '%부산%')

        UNION ALL

        -- 2. Sales (Outflow) across all three tables
        SELECT
          ${branchCase('ec.전체사업소')} as branch,
          CASE
            WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
            WHEN i.품목그룹1코드 = 'IL' THEN 'IL'
            WHEN i.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
            ELSE 'Others'
          END as category,
          CASE
            WHEN i.품목그룹3코드 = 'FLA' THEN 'Flagship'
            ELSE 'Others'
          END as tier,
          0 as inv_qty,
          CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as sales_qty,
          0 as purchase_qty,
          0 as transfer_qty
        FROM (
          SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM sales
          UNION ALL
          SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM east_division_sales
          UNION ALL
          SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM west_division_sales
          UNION ALL
          SELECT 일자, 거래처코드, NULL as 담당자코드, 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, NULL as 신규일, NULL as 적요, NULL as 적요2 FROM south_division_sales
        ) s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 = '${date}'
          AND (ec.전체사업소 LIKE '%사업소%' OR ec.전체사업소 LIKE '%지사%' OR ec.전체사업소 = '벤츠')
          AND e.사원_담당_명 != '김도량'

        UNION ALL

        -- 3. Purchases (Inflow)
        SELECT
          ${branchCase('p.거래처그룹1명')} as branch,
          CASE
            WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
            WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
            WHEN p.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
            ELSE 'Others'
          END as category,
          CASE
            WHEN p.품목그룹3코드 = 'FLA' THEN 'Flagship'
            ELSE 'Others'
          END as tier,
          0 as inv_qty,
          0 as sales_qty,
          CAST(REPLACE(p.수량, ',', '') AS NUMERIC) as purchase_qty,
          0 as transfer_qty
        FROM (
          SELECT 일자, 거래처그룹1명, 품목그룹1코드, 품목그룹3코드, 수량, 품목코드 FROM purchases
          UNION ALL
          SELECT 일자, 거래처그룹1명, 품목그룹1코드, 품목그룹3코드, 수량, 품목코드 FROM east_division_purchases
          UNION ALL
          SELECT 일자, 거래처그룹1명, 품목그룹1코드, 품목그룹3코드, 수량, 품목코드 FROM west_division_purchases
          UNION ALL
          SELECT 일자, 거래처그룹1명, 품목그룹1코드, 품목그룹3코드, 수량, 품목코드 FROM south_division_purchases
        ) p
        WHERE p.일자 = '${date}'
          AND (p.거래처그룹1명 LIKE '%사업소%' OR p.거래처그룹1명 LIKE '%지사%' OR p.거래처그룹1명 = 'MB' OR p.거래처그룹1명 LIKE '%화성%' OR p.거래처그룹1명 LIKE '%창원%' OR p.거래처그룹1명 LIKE '%남부%' OR p.거래처그룹1명 LIKE '%중부%' OR p.거래처그룹1명 LIKE '%서부%' OR p.거래처그룹1명 LIKE '%동부%' OR p.거래처그룹1명 LIKE '%제주%' OR p.거래처그룹1명 LIKE '%부산%')

        UNION ALL

        -- 4. Transfers Out (Negative movement)
        SELECT
          ${branchCase('t.출고창고명')} as branch,
          CASE
            WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
            WHEN i.품목그룹1코드 = 'IL' THEN 'IL'
            WHEN i.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
            ELSE 'Others'
          END as category,
          CASE
            WHEN i.품목그룹3코드 = 'FLA' THEN 'Flagship'
            ELSE 'Others'
          END as tier,
          0 as inv_qty,
          0 as sales_qty,
          0 as purchase_qty,
          -CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_qty
        FROM inventory_transfers t
        LEFT JOIN items i ON t.품목코드 = i.품목코드
        WHERE t.일자 = '${date}'

        UNION ALL

        -- 5. Transfers In (Positive movement)
        SELECT
          ${branchCase('t.입고창고명')} as branch,
          CASE
            WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
            WHEN i.품목그룹1코드 = 'IL' THEN 'IL'
            WHEN i.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
            ELSE 'Others'
          END as category,
          CASE
            WHEN i.품목그룹3코드 = 'FLA' THEN 'Flagship'
            ELSE 'Others'
          END as tier,
          0 as inv_qty,
          0 as sales_qty,
          0 as purchase_qty,
          CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_qty
        FROM inventory_transfers t
        LEFT JOIN items i ON t.품목코드 = i.품목코드
        WHERE t.일자 = '${date}'
      ) r
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
