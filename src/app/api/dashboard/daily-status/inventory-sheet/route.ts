import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint for Daily Inventory Status Sheet (일일재고파악시트)
 * Consolidates data from inventory, sales, purchases, and transfers.
 *
 * Uses items table for categorization (품목그룹1코드, 품목그룹3코드)
 * For February 2026, calculates baseline inventory by rolling forward from esz018r__6_ snapshot.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-03-23';
    const isFebruary = date.startsWith('2026-02');
    
    // Helpers
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

    // 1. Calculate Baseline (Beginning Inventory)
    // Both February and March logic MUST return exactly 5 columns:
    // branch, category, tier, inv_qty, inv_weight
    let baselineSubquery = "";
    if (isFebruary) {
      const isFeb1st = date === '2026-02-01';
      
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
          
          UNION ALL
          
          -- Roll forward from Feb 2 to Date-1 (or roll back Feb 1st if date is Feb 1st)
          SELECT ${branchCase('ec.전체사업소')}, ${categoryCase('i')}, ${tierCase('i')}, 
                 ${isFeb1st ? '' : '-'}CAST(REPLACE(s.수량, ',', '') AS NUMERIC), 
                 ${isFeb1st ? '' : '-'}(${weightCalc('s.수량', 'i.규격정보')})
          FROM (
            SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 수량, 중량 FROM sales
            UNION ALL SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 수량, 중량 FROM east_division_sales
            UNION ALL SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 수량, 중량 FROM west_division_sales
            UNION ALL SELECT 일자, 거래처코드, NULL as 담당자코드, 담당자명, 품목코드, 수량, 중량 FROM south_division_sales
          ) s
          LEFT JOIN items i ON s.품목코드 = i.품목코드
          LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
          LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
          WHERE (
            ${isFeb1st 
              ? `s.일자 = '2026-02-01'` // To get Start of Feb 1: Snapshot Feb 1 (EOD) + Sales Feb 1
              : `s.일자 >= '2026-02-02' AND s.일자 < '${date}'`
            }
          )
          AND (ec.전체사업소 LIKE '%사업소%' OR ec.전체사업소 LIKE '%지사%' OR ec.전체사업소 = '벤츠' OR ec.전체사업소 = 'MB')
          AND e.사원_담당_명 != '김도량'
            
          UNION ALL
          
          -- Purchases Roll forward/back
          SELECT ${branchCase('c.거래처그룹1명')}, ${categoryCase('i')}, ${tierCase('i')}, 
                 ${isFeb1st ? '-' : ''}CAST(REPLACE(p.수량, ',', '') AS NUMERIC), 
                 ${isFeb1st ? '-' : ''}${weightCalc('p.수량', 'i.규격정보')}
          FROM (
            SELECT 일자, 거래처코드, 품목코드, 수량, 중량 FROM purchases
            UNION ALL SELECT 일자, 거래처코드, 품목코드, 수량, 중량 FROM east_division_purchases
            UNION ALL SELECT 일자, 거래처코드, 품목코드, 수량, 중량 FROM west_division_purchases
            UNION ALL SELECT 일자, 거래처코드, 품목코드, 수량, 중량 FROM south_division_purchases
          ) p
          LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
          LEFT JOIN items i ON p.품목코드 = i.품목코드
          WHERE (
            ${isFeb1st 
              ? `p.일자 = '2026-02-01'` // To get Start of Feb 1: Snapshot Feb 1 (EOD) - Purch Feb 1
              : `p.일자 >= '2026-02-02' AND p.일자 < '${date}'`
            }
          )
          AND (c.거래처그룹1명 LIKE '%사업소%' OR c.거래처그룹1명 LIKE '%지사%' OR c.거래처그룹1명 = 'MB' OR c.거래처그룹1명 LIKE '%화성%' OR c.거래처그룹1명 LIKE '%창원%' OR c.거래처그룹1명 LIKE '%남부%' OR c.거래처그룹1명 LIKE '%중부%' OR c.거래처그룹1명 LIKE '%서부%' OR c.거래처그룹1명 LIKE '%동부%' OR c.거래처그룹1명 LIKE '%제주%' OR c.거래처그룹1명 LIKE '%부산%')
            
          UNION ALL
          
          -- Transfers Roll forward/back
          SELECT ${branchCase('t.출고창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 
                 ${isFeb1st ? '' : '-'}CAST(REPLACE(t.수량, ',', '') AS NUMERIC), 
                 ${isFeb1st ? '' : '-'}(${weightCalc('t.수량', 'i.규격정보')})
          FROM inventory_transfers t
          LEFT JOIN items i ON t.품목명_규격 = (i.품목명 || ' ' || COALESCE(i.규격정보, ''))
          WHERE (
            ${isFeb1st 
              ? `t.일자 = '2026-02-01'`
              : `t.일자 >= '2026-02-02' AND t.일자 < '${date}'`
            }
          )
          
          UNION ALL
          
          SELECT ${branchCase('t.입고창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 
                 ${isFeb1st ? '-' : ''}CAST(REPLACE(t.수량, ',', '') AS NUMERIC), 
                 ${isFeb1st ? '-' : ''}${weightCalc('t.수량', 'i.규격정보')}
          FROM inventory_transfers t
          LEFT JOIN items i ON t.품목명_규격 = (i.품목명 || ' ' || COALESCE(i.규격정보, ''))
          WHERE (
            ${isFeb1st 
              ? `t.일자 = '2026-02-01'`
              : `t.일자 >= '2026-02-02' AND t.일자 < '${date}'`
            }
          )
        ) GROUP BY 1, 2, 3
      `;
    } else {
      baselineSubquery = `
        SELECT ${branchCase('i.창고명')} as branch, ${categoryCase('p')} as category, ${tierCase('p')} as tier, SUM(CAST(REPLACE(i.재고수량, ',', '') AS NUMERIC)) as inv_qty, SUM(${weightCalc('i.재고수량', 'p.규격정보')}) as inv_weight
        FROM inventory i
        LEFT JOIN items p ON i.품목코드 = p.품목코드
        WHERE (i.창고명 LIKE '%사업소%' OR i.창고명 LIKE '%지사%' OR i.창고명 = 'MB' OR i.창고명 LIKE '%화성%' OR i.창고명 LIKE '%창원%' OR i.창고명 LIKE '%남부%' OR i.창고명 LIKE '%중부%' OR i.창고명 LIKE '%서부%' OR i.창고명 LIKE '%동부%' OR i.창고명 LIKE '%제주%' OR i.창고명 LIKE '%부산%')
          AND i.imported_at = (SELECT MAX(imported_at) FROM inventory WHERE DATE(imported_at) <= '${date}')
        GROUP BY 1, 2, 3
      `;
    }

    // 2. Final Union Query combining Baseline with Today's Transactions
    // ALL sections MUST return exactly 11 columns
    const query = `
      SELECT branch, category, tier,
        SUM(b_qty) as inventory_baseline, SUM(b_w) as inventory_baseline_weight,
        SUM(s_qty) as sales, SUM(s_w) as sales_weight,
        SUM(p_qty) as purchase, SUM(p_w) as purchase_weight,
        SUM(t_qty) as transfer, SUM(t_w) as transfer_weight
      FROM (
        -- I. Baseline
        SELECT branch, category, tier, inv_qty as b_qty, inv_weight as b_w, 0 as s_qty, 0 as s_w, 0 as p_qty, 0 as p_w, 0 as t_qty, 0 as t_w
        FROM (${baselineSubquery})
        
        UNION ALL
        
        -- II. Today's Sales
        SELECT ${branchCase('ec.전체사업소')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(s.수량, ',', '') AS NUMERIC), ${weightCalc('s.수량', 'i.규격정보')}, 0, 0, 0, 0
        FROM (
          SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 수량, 중량 FROM sales
          UNION ALL SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 수량, 중량 FROM east_division_sales
          UNION ALL SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 수량, 중량 FROM west_division_sales
          UNION ALL SELECT 일자, 거래처코드, NULL as 담당자코드, 담당자명, 품목코드, 수량, 중량 FROM south_division_sales
        ) s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 = '${date}'
          AND (ec.전체사업소 LIKE '%사업소%' OR ec.전체사업소 LIKE '%지사%' OR ec.전체사업소 = '벤츠')
          AND e.사원_담당_명 != '김도량'
          
        UNION ALL
        
        -- III. Today's Purchases
        SELECT ${branchCase('c.거래처그룹1명')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, 0, 0, CAST(REPLACE(p.수량, ',', '') AS NUMERIC), ${weightCalc('p.수량', 'i.규격정보')}, 0, 0
        FROM (
          SELECT 일자, 거래처코드, 품목코드, 수량, 중량 FROM purchases
          UNION ALL SELECT 일자, 거래처코드, 품목코드, 수량, 중량 FROM east_division_purchases
          UNION ALL SELECT 일자, 거래처코드, 품목코드, 수량, 중량 FROM west_division_purchases
          UNION ALL SELECT 일자, 거래처코드, 품목코드, 수량, 중량 FROM south_division_purchases
        ) p
        LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE p.일자 = '${date}'
          AND (c.거래처그룹1명 LIKE '%사업소%' OR c.거래처그룹1명 LIKE '%지사%' OR c.거래처그룹1명 = 'MB' OR c.거래처그룹1명 LIKE '%화성%' OR c.거래처그룹1명 LIKE '%창원%' OR c.거래처그룹1명 LIKE '%남부%' OR c.거래처그룹1명 LIKE '%중부%' OR c.거래처그룹1명 LIKE '%서부%' OR c.거래처그룹1명 LIKE '%동부%' OR c.거래처그룹1명 LIKE '%제주%' OR c.거래처그룹1명 LIKE '%부산%')
          
        UNION ALL
        
        -- IV. Today's Transfers
        SELECT ${branchCase('t.출고창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, 0, 0, 0, 0, -CAST(REPLACE(t.수량, ',', '') AS NUMERIC), -(${weightCalc('t.수량', 'i.규격정보')})
        FROM inventory_transfers t
        LEFT JOIN items i ON t.품목명_규격 = (i.품목명 || ' ' || COALESCE(i.규격정보, ''))
        WHERE t.일자 = '${date}'
        
        UNION ALL
        
        SELECT ${branchCase('t.입고창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, 0, 0, 0, 0, CAST(REPLACE(t.수량, ',', '') AS NUMERIC), ${weightCalc('t.수량', 'i.규격정보')}
        FROM inventory_transfers t
        LEFT JOIN items i ON t.품목명_규격 = (i.품목명 || ' ' || COALESCE(i.규격정보, ''))
        WHERE t.일자 = '${date}'
      ) r GROUP BY 1, 2, 3
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
      
      const beginning = Number(row.inventory_baseline) || 0;
      const beginning_weight = Number(row.inventory_baseline_weight) || 0;
      const purchase = Number(row.purchase) || 0;
      const purchase_weight = Number(row.purchase_weight) || 0;
      const sales = Number(row.sales) || 0;
      const sales_weight = Number(row.sales_weight) || 0;
      const transfer = Number(row.transfer) || 0;
      const transfer_weight = Number(row.transfer_weight) || 0;

      // Current Ending Inventory: Baseline + Purchase - Sales + Transfer
      const ending = beginning + purchase - sales + transfer;
      const ending_weight = beginning_weight + purchase_weight - sales_weight + transfer_weight;

      stats[branch][catKey] = {
        beginning: beginning,
        beginning_weight: beginning_weight,
        purchase: purchase,
        purchase_weight: purchase_weight,
        sales: sales,
        sales_weight: sales_weight,
        transfer: transfer,
        transfer_weight: transfer_weight,
        inventory: ending,
        inventory_weight: ending_weight,
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
