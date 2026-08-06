import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';
import { compareOffices, loadOfficeOrderMap } from '@/lib/display-order';
import { combinedInventoryUnionSql } from '@/lib/inventory-snapshot-combined';
import { sqlAndPurchaseExcludeCounterpartyCodes } from '@/lib/special-handling-employees';

/**
 * API Endpoint for Daily Inventory Status Sheet (일일재고파악시트)
 * Consolidates data from combined 2025-12-31 inventory snapshots, sales, and purchases.
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

    const officeOrder = await loadOfficeOrderMap();

    const colIpgo = String.fromCharCode(0xc785, 0xace0, 0xcc3d, 0xace0, 0xba85);
    const colChulgo = String.fromCharCode(0xcd9c, 0xace0, 0xcc3d, 0xace0, 0xba85);
    const colWhName = String.fromCharCode(0xcc3d, 0xace0, 0xba85);
    const viewMode = searchParams.get('viewMode') || searchParams.get('mode') || 'division';

    // Helpers
    const getBranchExpr = (div: 'HQ' | 'East' | 'West', column: string) => {
      if (viewMode === 'division') {
        if (div === 'HQ') return "'본사'";
        if (div === 'East') return "'동부'";
        return "'서부'";
      }
      if (div === 'HQ') {
        return `
          CASE
            WHEN ${column} = 'MB' OR ${column} = 'P2' THEN 'MB'
            WHEN ${column} LIKE '%중부%' OR ${column} = '42' THEN '중부'
            WHEN ${column} LIKE '%남부%' THEN '남부'
            WHEN ${column} LIKE '%서부%' OR ${column} = '03' OR ${column} = '3' THEN '서부'
            WHEN ${column} LIKE '%동부%' OR ${column} = '02' OR ${column} = '2' THEN '동부'
            WHEN ${column} LIKE '%화성%' OR ${column} IN ('05', '5', '54', '36') THEN '화성'
            WHEN ${column} LIKE '%창원%' OR ${column} IN ('06', '6') THEN '창원'
            WHEN ${column} LIKE '%제주%' OR ${column} = '51' THEN '제주'
            WHEN ${column} LIKE '%부산%' OR ${column} = '50' THEN '부산'
            ELSE '본사'
          END
        `;
      } else if (div === 'East') {
        return "'동부'";
      } else {
        return "'서부'";
      }
    };

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

    const fullWidthSlash = String.fromCharCode(0xff0f);

    const weightCalc = (qtyCol: string, specCol: string) => `
      CAST(REPLACE(${qtyCol}, ',', '') AS NUMERIC) * (
        CASE 
          WHEN ${specCol} LIKE '%/%' OR ${specCol} LIKE '%${fullWidthSlash}%' THEN
            CAST(REPLACE(REPLACE(REPLACE(REPLACE(SUBSTR(${specCol}, 1, INSTR(REPLACE(${specCol}, '${fullWidthSlash}', '/'), '/') - 1), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
            CAST(REPLACE(REPLACE(REPLACE(REPLACE(SUBSTR(${specCol}, INSTR(REPLACE(${specCol}, '${fullWidthSlash}', '/'), '/') + 1), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC)
          ELSE
            CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${specCol}, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC)
        END
      ) *
      CASE 
        WHEN ${specCol} LIKE '%G%' AND ${specCol} NOT LIKE '%KG%' AND ${specCol} NOT LIKE '%GL%' THEN 0.001
        WHEN ${specCol} LIKE '%ML%' THEN 0.001
        ELSE 1.0
      END
    `;

    const hqWhFilter = (column: string) => `
      (CAST(${column} AS TEXT) IN ('02', '2', '03', '3', '05', '5', '06', '6', '09', '9', '34', '42', '50', '51', '54', '32', '36', '45', 'P1', 'P2', 'P3', 'P4'))
    `;

    // 1. Calculate Baseline (Inventory at start of 'date')
    const rollStartDate = isFebruary ? '2026-02-02' : '2026-01-01';

    const baselineSubquery = `
      SELECT branch, category, tier, SUM(qty) as inv_qty, SUM(weight) as inv_weight
      FROM (
        -- HQ Snapshot
        SELECT ${getBranchExpr('HQ', 'inv.창고코드')} as branch, ${categoryCase('p')} as category, ${tierCase('p')} as tier, 
               CASE WHEN inv.품목코드 = '4454042-R' AND inv.창고코드 IN ('P2', '05') THEN 0 ELSE CAST(REPLACE(inv.재고수량, ',', '') AS NUMERIC) END as qty, 
               ${weightCalc(
                 `CASE WHEN inv.품목코드 = '4454042-R' AND inv.창고코드 IN ('P2', '05') THEN '0' ELSE inv.재고수량 END`,
                 'p.규격정보'
               )} as weight
        FROM youngil_inventory_20251231 inv
        LEFT JOIN items p ON inv.품목코드 = p.품목코드
        WHERE (p.재고수량관리 IS NULL OR p.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('inv.창고코드')}
        
        UNION ALL
        
        -- HQ Sales Roll forward (Deduct sales between rollStartDate and Date-1)
        SELECT ${getBranchExpr('HQ', 's.출하창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(s.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('s.수량', 'i.규격정보')})
        FROM sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE s.일자 >= '${rollStartDate}' AND s.일자 < '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('s.출하창고코드')}
          
        UNION ALL
        
        -- HQ Purchases Roll forward (Add purchases between rollStartDate and Date-1)
        SELECT ${getBranchExpr('HQ', 'p.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               CAST(REPLACE(p.수량, ',', '') AS NUMERIC), 
               ${weightCalc('p.수량', 'i.규격정보')}
        FROM purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE p.일자 >= '${rollStartDate}' AND p.일자 < '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('p.창고코드')}

        UNION ALL

        -- HQ Internal Uses Roll forward
        SELECT ${getBranchExpr('HQ', 'w.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(u.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('u.수량', 'i.규격정보')})
        FROM internal_uses u
        LEFT JOIN items i ON u.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON u.창고명 = w.창고명
        WHERE u.일자 >= '${rollStartDate}' AND u.일자 < '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND (
            CASE 
              WHEN u.창고명 LIKE '%화성%' AND u.창고명 NOT LIKE '%기타%' THEN '05'
              WHEN u.창고명 LIKE '%창원%' THEN '06'
              WHEN u.창고명 LIKE '%본사직송%' THEN '09'
              WHEN u.창고명 LIKE '%기타%' THEN '34'
              WHEN u.창고명 LIKE '%auto%' OR u.창고명 LIKE '%중부%' THEN '42'
              WHEN u.창고명 LIKE '%부산%' THEN '50'
              WHEN u.창고명 LIKE '%제주%' THEN '51'
              WHEN u.창고명 LIKE '%B2B%' THEN '54'
              WHEN u.창고명 LIKE '%김진철%' THEN '32'
              WHEN u.창고명 LIKE '%최정호%' THEN '45'
              WHEN u.창고명 LIKE '%영일%' THEN 'P2'
              WHEN u.창고명 LIKE '%EHS%' THEN 'P1'
              WHEN u.창고명 LIKE '%백호%' THEN 'P3'
              WHEN u.창고명 LIKE '%다우%' THEN 'P4'
              WHEN u.창고명 LIKE '%동부%' OR u.창고명 LIKE '%남양주%' THEN '02'
              WHEN u.창고명 LIKE '%서부%' OR u.창고명 LIKE '%인천%' THEN '03'
              ELSE 'unknown'
            END IN ('02','03','05','06','09','34','42','50','51','54','32','36','45','P1','P2','P3','P4')
          )

        UNION ALL

        -- HQ Disposed Roll forward
        SELECT ${getBranchExpr('HQ', 'w.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(d.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('d.수량', 'i.규격정보')})
        FROM disposed_inventory d
        LEFT JOIN items i ON d.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON d.창고명 = w.창고명
        WHERE d.일자 >= '${rollStartDate}' AND d.일자 < '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND (
            CASE 
              WHEN d.창고명 = 'unknown' AND d.품목코드 = '142957' THEN '02'
              WHEN d.창고명 = 'unknown' AND d.품목코드 = '4464096' THEN '05'
              WHEN d.창고명 LIKE '%화성%' AND d.창고명 NOT LIKE '%기타%' THEN '05'
              WHEN d.창고명 LIKE '%창원%' THEN '06'
              WHEN d.창고명 LIKE '%본사직송%' THEN '09'
              WHEN d.창고명 LIKE '%기타%' THEN '34'
              WHEN d.창고명 LIKE '%auto%' OR d.창고명 LIKE '%중부%' THEN '42'
              WHEN d.창고명 LIKE '%부산%' THEN '50'
              WHEN d.창고명 LIKE '%제주%' THEN '51'
              WHEN d.창고명 LIKE '%B2B%' THEN '54'
              WHEN d.창고명 LIKE '%김진철%' THEN '32'
              WHEN d.창고명 LIKE '%최정호%' THEN '45'
              WHEN d.창고명 LIKE '%영일%' THEN 'P2'
              WHEN d.창고명 LIKE '%EHS%' THEN 'P1'
              WHEN d.창고명 LIKE '%백호%' THEN 'P3'
              WHEN d.창고명 LIKE '%다우%' THEN 'P4'
              WHEN d.창고명 LIKE '%동부%' OR d.창고명 LIKE '%남양주%' THEN '02'
              WHEN d.창고명 LIKE '%서부%' OR d.창고명 LIKE '%인천%' THEN '03'
              ELSE 'unknown'
            END IN ('02','03','05','06','09','34','42','50','51','54','32','36','45','P1','P2','P3','P4')
          )

        UNION ALL

        -- HQ Adjustments Roll forward
        SELECT ${getBranchExpr('HQ', 'adj.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               CAST(REPLACE(adj.조정수량, ',', '') AS NUMERIC), 
               ${weightCalc('adj.조정수량', 'i.규격정보')}
        FROM inventory_adjustments adj
        LEFT JOIN items i ON adj.품목코드 = i.품목코드
        WHERE adj.일자 >= '${rollStartDate}' AND adj.일자 < '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('adj.창고코드')}

        UNION ALL

        -- HQ Inbound Transfers Roll forward
        SELECT ${getBranchExpr('HQ', 'w.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               CAST(REPLACE(t.수량, ',', '') AS NUMERIC), 
               ${weightCalc('t.수량', 'i.규격정보')}
        FROM inventory_transfer t LEFT JOIN items i ON t.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON t.[${colIpgo}] = w.창고명
        WHERE t.일자 >= '${rollStartDate}' AND t.일자 < '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND (
            CASE 
              WHEN t.[${colIpgo}] LIKE '%화성%' AND t.[${colIpgo}] NOT LIKE '%기타%' THEN '05'
              WHEN t.[${colIpgo}] LIKE '%창원%' THEN '06'
              WHEN t.[${colIpgo}] LIKE '%본사직송%' THEN '09'
              WHEN t.[${colIpgo}] LIKE '%기타%' THEN '34'
              WHEN t.[${colIpgo}] LIKE '%auto%' OR t.[${colIpgo}] LIKE '%중부%' THEN '42'
              WHEN t.[${colIpgo}] LIKE '%부산%' THEN '50'
              WHEN t.[${colIpgo}] LIKE '%제주%' THEN '51'
              WHEN t.[${colIpgo}] LIKE '%B2B%' THEN '54'
              WHEN t.[${colIpgo}] LIKE '%김진철%' THEN '32'
              WHEN t.[${colIpgo}] LIKE '%최정호%' THEN '45'
              WHEN t.[${colIpgo}] LIKE '%영일%' THEN 'P2'
              WHEN t.[${colIpgo}] LIKE '%EHS%' THEN 'P1'
              WHEN t.[${colIpgo}] LIKE '%백호%' THEN 'P3'
              WHEN t.[${colIpgo}] LIKE '%다우%' THEN 'P4'
              WHEN t.[${colIpgo}] LIKE '%동부%' OR t.[${colIpgo}] LIKE '%남양주%' THEN '02'
              WHEN t.[${colIpgo}] LIKE '%서부%' OR t.[${colIpgo}] LIKE '%인천%' THEN '03'
              ELSE 'unknown'
            END IN ('02','03','05','06','09','34','42','50','51','54','32','36','45','P1','P2','P3','P4')
          )

        UNION ALL

        -- HQ Outbound Transfers Roll forward
        SELECT ${getBranchExpr('HQ', 'w.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(t.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('t.수량', 'i.규격정보')})
        FROM inventory_transfer t LEFT JOIN items i ON t.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON t.[${colChulgo}] = w.창고명
        WHERE t.일자 >= '${rollStartDate}' AND t.일자 < '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND (
            CASE 
              WHEN t.[${colChulgo}] LIKE '%화성%' AND t.[${colChulgo}] NOT LIKE '%기타%' THEN '05'
              WHEN t.[${colChulgo}] LIKE '%창원%' THEN '06'
              WHEN t.[${colChulgo}] LIKE '%본사직송%' THEN '09'
              WHEN t.[${colChulgo}] LIKE '%기타%' THEN '34'
              WHEN t.[${colChulgo}] LIKE '%auto%' OR t.[${colChulgo}] LIKE '%중부%' THEN '42'
              WHEN t.[${colChulgo}] LIKE '%부산%' THEN '50'
              WHEN t.[${colChulgo}] LIKE '%제주%' THEN '51'
              WHEN t.[${colChulgo}] LIKE '%B2B%' THEN '54'
              WHEN t.[${colChulgo}] LIKE '%김진철%' THEN '32'
              WHEN t.[${colChulgo}] LIKE '%최정호%' THEN '45'
              WHEN t.[${colChulgo}] LIKE '%영일%' THEN 'P2'
              WHEN t.[${colChulgo}] LIKE '%EHS%' THEN 'P1'
              WHEN t.[${colChulgo}] LIKE '%백호%' THEN 'P3'
              WHEN t.[${colChulgo}] LIKE '%다우%' THEN 'P4'
              WHEN t.[${colChulgo}] LIKE '%동부%' OR t.[${colChulgo}] LIKE '%남양주%' THEN '02'
              WHEN t.[${colChulgo}] LIKE '%서부%' OR t.[${colChulgo}] LIKE '%인천%' THEN '03'
              ELSE 'unknown'
            END IN ('02','03','05','06','09','34','42','50','51','54','32','36','45','P1','P2','P3','P4')
          )

        UNION ALL

        -- HQ Production Inbound Roll forward
        SELECT ${getBranchExpr('HQ', 'pm.format_wh')}, ${categoryCase('i')}, ${tierCase('i')}, 
               CAST(REPLACE(pm.생산수량, ',', '') AS NUMERIC), 
               CAST(REPLACE(pm.생산수량, ',', '') AS NUMERIC) * 
               CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(i.규격정보, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
               CASE 
                 WHEN i.규격정보 LIKE '%G%' AND i.규격정보 NOT LIKE '%KG%' AND i.규격정보 NOT LIKE '%GL%' THEN 0.001
                 WHEN i.규격정보 LIKE '%ML%' THEN 0.001
                 ELSE 1.0
               END
        FROM (
          SELECT 일자, 생산품목코드, 생산수량,
            CASE WHEN 입고창고코드 GLOB '*[0-9]*' AND length(입고창고코드) = 1 THEN '0' || 입고창고코드 ELSE 입고창고코드 END as format_wh
          FROM production_material_consumption
        ) pm
        LEFT JOIN items i ON pm.생산품목코드 = i.품목코드
        WHERE pm.일자 >= '${rollStartDate}' AND pm.일자 < '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('pm.format_wh')}

        UNION ALL

        -- HQ Production Outbound Roll forward
        SELECT ${getBranchExpr('HQ', 'pm.format_wh')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(pm.실제소모수량, ',', '') AS NUMERIC), 
               -(CAST(REPLACE(pm.실제소모수량, ',', '') AS NUMERIC) * 
                 CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(i.규격정보, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
                 CASE 
                   WHEN i.규격정보 LIKE '%G%' AND i.규격정보 NOT LIKE '%KG%' AND i.규격정보 NOT LIKE '%GL%' THEN 0.001
                   WHEN i.규격정보 LIKE '%ML%' THEN 0.001
                   ELSE 1.0
                 END)
        FROM (
          SELECT 일자, 소모품목코드, 실제소모수량,
            CASE 
              WHEN 출고창고코드 = 'P2' THEN '05'
              WHEN 출고창고코드 = 'P3' THEN '06'
              WHEN 출고창고코드 = 'P4' THEN '05'
              WHEN 출고창고코드 GLOB '*[0-9]*' AND length(출고창고코드) = 1 THEN '0' || 출고창고코드
              ELSE  출고창고코드 
            END as format_wh
          FROM production_material_consumption
        ) pm
        LEFT JOIN items i ON pm.소모품목코드 = i.품목코드
        WHERE pm.일자 >= '${rollStartDate}' AND pm.일자 < '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('pm.format_wh')}

        -- East Snapshot
        UNION ALL
        SELECT ${getBranchExpr('East', 'inv.창고코드')} as branch, ${categoryCase('p')} as category, ${tierCase('p')} as tier, 
               CAST(REPLACE(inv.재고수량, ',', '') AS NUMERIC) as qty, 
               ${weightCalc('inv.재고수량', 'p.규격정보')} as weight
        FROM east_inventory_20251231 inv
        LEFT JOIN items p ON inv.품목코드 = p.품목코드
        
        UNION ALL
        
        -- East Sales Roll forward
        SELECT ${getBranchExpr('East', 's.출하창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(s.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('s.수량', 'i.규격정보')})
        FROM east_division_sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE s.일자 >= '${rollStartDate}' AND s.일자 < '${date}'
          
        UNION ALL
        
        -- East Purchases Roll forward
        SELECT ${getBranchExpr('East', 'p.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               CAST(REPLACE(p.수량, ',', '') AS NUMERIC), 
               ${weightCalc('p.수량', 'i.규격정보')}
        FROM east_division_purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE p.일자 >= '${rollStartDate}' AND p.일자 < '${date}'

        UNION ALL

        -- East Internal Uses Roll forward
        SELECT ${getBranchExpr('East', 'u.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(u.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('u.수량', 'i.규격정보')})
        FROM east_internal_uses u
        LEFT JOIN items i ON u.품목코드 = i.품목코드
        WHERE u.월_일 >= '${rollStartDate}' AND u.월_일 < '${date}'

        UNION ALL

        -- East Disposed Roll forward
        SELECT ${getBranchExpr('East', 'COALESCE(w.창고명, CAST(d.창고코드 AS TEXT))')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(d.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('d.수량', 'i.규격정보')})
        FROM east_disposed_inventory d
        LEFT JOIN items i ON d.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON d.창고코드 = w.창고코드 OR CAST(d.창고코드 AS TEXT) = CAST(w.창고코드 AS TEXT)
        WHERE d.일자 >= '${rollStartDate}' AND d.일자 < '${date}'

        UNION ALL

        -- East Adjustments Roll forward
        SELECT ${getBranchExpr('East', 'adj.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               CAST(REPLACE(adj.조정수량, ',', '') AS NUMERIC), 
               ${weightCalc('adj.조정수량', 'i.규격정보')}
        FROM east_inventory_adjustments adj
        LEFT JOIN items i ON adj.품목코드 = i.품목코드
        WHERE adj.일자 >= '${rollStartDate}' AND adj.일자 < '${date}'

        -- West Snapshot
        UNION ALL
        SELECT ${getBranchExpr('West', 'inv.창고코드')} as branch, ${categoryCase('p')} as category, ${tierCase('p')} as tier, 
               CAST(REPLACE(inv.재고수량, ',', '') AS NUMERIC) as qty, 
               ${weightCalc('inv.재고수량', 'p.규격정보')} as weight
        FROM west_inventory_20251231 inv
        LEFT JOIN items p ON inv.품목코드 = p.품목코드
        
        UNION ALL
        
        -- West Sales Roll forward
        SELECT ${getBranchExpr('West', 's.출하창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(s.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('s.수량', 'i.규격정보')})
        FROM west_division_sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE s.일자 >= '${rollStartDate}' AND s.일자 < '${date}'
          
        UNION ALL
        
        -- West Purchases Roll forward
        SELECT ${getBranchExpr('West', 'p.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               CAST(REPLACE(p.수량, ',', '') AS NUMERIC), 
               ${weightCalc('p.수량', 'i.규격정보')}
        FROM west_division_purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE p.일자 >= '${rollStartDate}' AND p.일자 < '${date}'

        UNION ALL

        -- West Internal Uses Roll forward
        SELECT ${getBranchExpr('West', 'u.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(u.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('u.수량', 'i.규격정보')})
        FROM west_internal_uses u
        LEFT JOIN items i ON u.품목코드 = i.품목코드
        WHERE u.월_일 >= '${rollStartDate}' AND u.월_일 < '${date}'

        UNION ALL

        -- West Disposed Roll forward
        SELECT ${getBranchExpr('West', 'd.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 
               -CAST(REPLACE(d.수량, ',', '') AS NUMERIC), 
               -(${weightCalc('d.수량', 'i.규격정보')})
        FROM west_disposed_inventory d
        LEFT JOIN items i ON d.품목코드 = i.품목코드
        WHERE d.일자 >= '${rollStartDate}' AND d.일자 < '${date}'

        UNION ALL

        -- West Adjustments Roll forward
        SELECT ${getBranchExpr('West', 'adj.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 
               CAST(REPLACE(adj.조정수량, ',', '') AS NUMERIC), 
               ${weightCalc('adj.조정수량', 'i.규격정보')}
        FROM west_inventory_adjustments adj
        LEFT JOIN items i ON adj.품목코드 = i.품목코드
        WHERE adj.일자 >= '${rollStartDate}' AND adj.일자 < '${date}'
      ) GROUP BY 1, 2, 3
    `;

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
        
        -- II. Today's Sales (HQ)
        SELECT ${getBranchExpr('HQ', 's.출하창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(s.수량, ',', '') AS NUMERIC), ${weightCalc('s.수량', 'i.규격정보')}, 0, 0
        FROM sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE s.일자 = '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('s.출하창고코드')}

        -- Today's Sales (East)
        UNION ALL
        SELECT ${getBranchExpr('East', 's.출하창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(s.수량, ',', '') AS NUMERIC), ${weightCalc('s.수량', 'i.규격정보')}, 0, 0
        FROM east_division_sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE s.일자 = '${date}'

        -- Today's Sales (West)
        UNION ALL
        SELECT ${getBranchExpr('West', 's.출하창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(s.수량, ',', '') AS NUMERIC), ${weightCalc('s.수량', 'i.규격정보')}, 0, 0
        FROM west_division_sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE s.일자 = '${date}'
          
        UNION ALL
        
        -- III. Today's Purchases (HQ)
        SELECT ${getBranchExpr('HQ', 'p.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, 0, 0, CAST(REPLACE(p.수량, ',', '') AS NUMERIC), ${weightCalc('p.수량', 'i.규격정보')}
        FROM purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE p.일자 = '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('p.창고코드')}

        -- Today's Purchases (East)
        UNION ALL
        SELECT ${getBranchExpr('East', 'p.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, 0, 0, CAST(REPLACE(p.수량, ',', '') AS NUMERIC), ${weightCalc('p.수량', 'i.규격정보')}
        FROM east_division_purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE p.일자 = '${date}'

        -- Today's Purchases (West)
        UNION ALL
        SELECT ${getBranchExpr('West', 'p.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, 0, 0, CAST(REPLACE(p.수량, ',', '') AS NUMERIC), ${weightCalc('p.수량', 'i.규격정보')}
        FROM west_division_purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE p.일자 = '${date}'

        UNION ALL
        
        -- IV. Today's Internal Uses (HQ)
        SELECT ${getBranchExpr('HQ', 'w.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(u.수량, ',', '') AS NUMERIC), ${weightCalc('u.수량', 'i.규격정보')}, 0, 0
        FROM internal_uses u
        LEFT JOIN items i ON u.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON u.창고명 = w.창고명
        WHERE u.일자 = '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND (
            CASE 
              WHEN u.창고명 LIKE '%화성%' AND u.창고명 NOT LIKE '%기타%' THEN '05'
              WHEN u.창고명 LIKE '%창원%' THEN '06'
              WHEN u.창고명 LIKE '%본사직송%' THEN '09'
              WHEN u.창고명 LIKE '%기타%' THEN '34'
              WHEN u.창고명 LIKE '%auto%' OR u.창고명 LIKE '%중부%' THEN '42'
              WHEN u.창고명 LIKE '%부산%' THEN '50'
              WHEN u.창고명 LIKE '%제주%' THEN '51'
              WHEN u.창고명 LIKE '%B2B%' THEN '54'
              WHEN u.창고명 LIKE '%김진철%' THEN '32'
              WHEN u.창고명 LIKE '%최정호%' THEN '45'
              WHEN u.창고명 LIKE '%영일%' THEN 'P2'
              WHEN u.창고명 LIKE '%EHS%' THEN 'P1'
              WHEN u.창고명 LIKE '%백호%' THEN 'P3'
              WHEN u.창고명 LIKE '%다우%' THEN 'P4'
              WHEN u.창고명 LIKE '%동부%' OR u.창고명 LIKE '%남양주%' THEN '02'
              WHEN u.창고명 LIKE '%서부%' OR u.창고명 LIKE '%인천%' THEN '03'
              ELSE 'unknown'
            END IN ('02','03','05','06','09','34','42','50','51','54','32','36','45','P1','P2','P3','P4')
          )

        -- Today's Internal Uses (East)
        UNION ALL
        SELECT ${getBranchExpr('East', 'u.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(u.수량, ',', '') AS NUMERIC), ${weightCalc('u.수량', 'i.규격정보')}, 0, 0
        FROM east_internal_uses u
        LEFT JOIN items i ON u.품목코드 = i.품목코드
        WHERE u.월_일 = '${date}'

        -- Today's Internal Uses (West)
        UNION ALL
        SELECT ${getBranchExpr('West', 'u.창고명')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(u.수량, ',', '') AS NUMERIC), ${weightCalc('u.수량', 'i.규격정보')}, 0, 0
        FROM west_internal_uses u
        LEFT JOIN items i ON u.품목코드 = i.품목코드
        WHERE u.월_일 = '${date}'

        -- Today's Inbound Transfers (HQ)
        UNION ALL
        SELECT ${getBranchExpr('HQ', 'w.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, 0, 0, CAST(REPLACE(t.수량, ',', '') AS NUMERIC), ${weightCalc('t.수량', 'i.규격정보')}
        FROM inventory_transfer t LEFT JOIN items i ON t.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON t.[${colIpgo}] = w.창고명
        WHERE t.일자 = '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND (
            CASE 
              WHEN t.[${colIpgo}] LIKE '%화성%' AND t.[${colIpgo}] NOT LIKE '%기타%' THEN '05'
              WHEN t.[${colIpgo}] LIKE '%창원%' THEN '06'
              WHEN t.[${colIpgo}] LIKE '%본사직송%' THEN '09'
              WHEN t.[${colIpgo}] LIKE '%기타%' THEN '34'
              WHEN t.[${colIpgo}] LIKE '%auto%' OR t.[${colIpgo}] LIKE '%중부%' THEN '42'
              WHEN t.[${colIpgo}] LIKE '%부산%' THEN '50'
              WHEN t.[${colIpgo}] LIKE '%제주%' THEN '51'
              WHEN t.[${colIpgo}] LIKE '%B2B%' THEN '54'
              WHEN t.[${colIpgo}] LIKE '%김진철%' THEN '32'
              WHEN t.[${colIpgo}] LIKE '%최정호%' THEN '45'
              WHEN t.[${colIpgo}] LIKE '%영일%' THEN 'P2'
              WHEN t.[${colIpgo}] LIKE '%EHS%' THEN 'P1'
              WHEN t.[${colIpgo}] LIKE '%백호%' THEN 'P3'
              WHEN t.[${colIpgo}] LIKE '%다우%' THEN 'P4'
              WHEN t.[${colIpgo}] LIKE '%동부%' OR t.[${colIpgo}] LIKE '%남양주%' THEN '02'
              WHEN t.[${colIpgo}] LIKE '%서부%' OR t.[${colIpgo}] LIKE '%인천%' THEN '03'
              ELSE 'unknown'
            END IN ('02','03','05','06','09','34','42','50','51','54','32','36','45','P1','P2','P3','P4')
          )

        -- Today's Outbound Transfers (HQ)
        UNION ALL
        SELECT ${getBranchExpr('HQ', 'w.창고코드')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(t.수량, ',', '') AS NUMERIC), ${weightCalc('t.수량', 'i.규격정보')}, 0, 0
        FROM inventory_transfer t LEFT JOIN items i ON t.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON t.[${colChulgo}] = w.창고명
        WHERE t.일자 = '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND (
            CASE 
              WHEN t.[${colChulgo}] LIKE '%화성%' AND t.[${colChulgo}] NOT LIKE '%기타%' THEN '05'
              WHEN t.[${colChulgo}] LIKE '%창원%' THEN '06'
              WHEN t.[${colChulgo}] LIKE '%본사직송%' THEN '09'
              WHEN t.[${colChulgo}] LIKE '%기타%' THEN '34'
              WHEN t.[${colChulgo}] LIKE '%auto%' OR t.[${colChulgo}] LIKE '%중부%' THEN '42'
              WHEN t.[${colChulgo}] LIKE '%부산%' THEN '50'
              WHEN t.[${colChulgo}] LIKE '%제주%' THEN '51'
              WHEN t.[${colChulgo}] LIKE '%B2B%' THEN '54'
              WHEN t.[${colChulgo}] LIKE '%김진철%' THEN '32'
              WHEN t.[${colChulgo}] LIKE '%최정호%' THEN '45'
              WHEN t.[${colChulgo}] LIKE '%영일%' THEN 'P2'
              WHEN t.[${colChulgo}] LIKE '%EHS%' THEN 'P1'
              WHEN t.[${colChulgo}] LIKE '%백호%' THEN 'P3'
              WHEN t.[${colChulgo}] LIKE '%다우%' THEN 'P4'
              WHEN t.[${colChulgo}] LIKE '%동부%' OR t.[${colChulgo}] LIKE '%남양주%' THEN '02'
              WHEN t.[${colChulgo}] LIKE '%서부%' OR t.[${colChulgo}] LIKE '%인천%' THEN '03'
              ELSE 'unknown'
            END IN ('02','03','05','06','09','34','42','50','51','54','32','36','45','P1','P2','P3','P4')
          )

        -- Today's Production Inbound (HQ)
        UNION ALL
        SELECT ${getBranchExpr('HQ', 'pm.format_wh')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, 0, 0, CAST(REPLACE(pm.생산수량, ',', '') AS NUMERIC), 
               CAST(REPLACE(pm.생산수량, ',', '') AS NUMERIC) * 
               CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(i.규격정보, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
               CASE 
                 WHEN i.규격정보 LIKE '%G%' AND i.규격정보 NOT LIKE '%KG%' AND i.규격정보 NOT LIKE '%GL%' THEN 0.001
                 WHEN i.규격정보 LIKE '%ML%' THEN 0.001
                 ELSE 1.0
               END
        FROM (
          SELECT 일자, 생산품목코드, 생산수량,
            CASE WHEN 입고창고코드 GLOB '*[0-9]*' AND length(입고창고코드) = 1 THEN '0' || 입고창고코드 ELSE 입고창고코드 END as format_wh
          FROM production_material_consumption
        ) pm
        LEFT JOIN items i ON pm.생산품목코드 = i.품목코드
        WHERE pm.일자 = '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('pm.format_wh')}

        -- Today's Production Outbound (HQ)
        UNION ALL
        SELECT ${getBranchExpr('HQ', 'pm.format_wh')}, ${categoryCase('i')}, ${tierCase('i')}, 0, 0, CAST(REPLACE(pm.실제소모수량, ',', '') AS NUMERIC), 
               CAST(REPLACE(pm.실제소모수량, ',', '') AS NUMERIC) * 
               CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(i.규격정보, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
               CASE 
                 WHEN i.규격정보 LIKE '%G%' AND i.규격정보 NOT LIKE '%KG%' AND i.규격정보 NOT LIKE '%GL%' THEN 0.001
                 WHEN i.규격정보 LIKE '%ML%' THEN 0.001
                 ELSE 1.0
               END, 0, 0
        FROM (
          SELECT 일자, 소모품목코드, 실제소모수량,
            CASE 
              WHEN 출고창고코드 = 'P2' THEN '05'
              WHEN 출고창고코드 = 'P3' THEN '06'
              WHEN 출고창고코드 = 'P4' THEN '05'
              WHEN 출고창고코드 GLOB '*[0-9]*' AND length(출고창고코드) = 1 THEN '0' || 출고창고코드
              ELSE  출고창고코드 
            END as format_wh
          FROM production_material_consumption
        ) pm
        LEFT JOIN items i ON pm.소모품목코드 = i.품목코드
        WHERE pm.일자 = '${date}'
          AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('pm.format_wh')}
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
        branch,
        category,
        tier,
        SUM(transfer_qty) AS transfer_qty,
        SUM(transfer_w) AS transfer_w,
        SUM(roll_qty) AS roll_qty,
        SUM(roll_w) AS roll_w
      FROM (
        -- HQ Disposed
        SELECT
          ${getBranchExpr('HQ', 'd.창고명')} AS branch,
          ${categoryCase('i')} AS category,
          ${tierCase('i')} AS tier,
          SUM(CASE WHEN d.일자 = '${date}' THEN CAST(REPLACE(d.수량, ',', '') AS NUMERIC) ELSE 0 END) AS transfer_qty,
          SUM(CASE WHEN d.일자 = '${date}' THEN ${weightCalc('d.수량', 'i.규격정보')} ELSE 0 END) AS transfer_w,
          SUM(CASE WHEN ${rollWhenDisposed} THEN CAST(REPLACE(d.수량, ',', '') AS NUMERIC) ELSE 0 END) AS roll_qty,
          SUM(CASE WHEN ${rollWhenDisposed} THEN ${weightCalc('d.수량', 'i.규격정보')} ELSE 0 END) AS roll_w
        FROM disposed_inventory d
        LEFT JOIN items i ON d.품목코드 = i.품목코드
        WHERE ${hqWhFilter('d.창고명')}
        GROUP BY 1, 2, 3

        -- East Disposed
        UNION ALL
        SELECT
          ${getBranchExpr('East', 'COALESCE(w.창고명, CAST(d.창고코드 AS TEXT))')} AS branch,
          ${categoryCase('i')} AS category,
          ${tierCase('i')} AS tier,
          SUM(CASE WHEN d.일자 = '${date}' THEN CAST(REPLACE(d.수량, ',', '') AS NUMERIC) ELSE 0 END) AS transfer_qty,
          SUM(CASE WHEN d.일자 = '${date}' THEN ${weightCalc('d.수량', 'i.규격정보')} ELSE 0 END) AS transfer_w,
          SUM(CASE WHEN ${rollWhenDisposed} THEN CAST(REPLACE(d.수량, ',', '') AS NUMERIC) ELSE 0 END) AS roll_qty,
          SUM(CASE WHEN ${rollWhenDisposed} THEN ${weightCalc('d.수량', 'i.규격정보')} ELSE 0 END) AS roll_w
        FROM east_disposed_inventory d
        LEFT JOIN items i ON d.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON d.창고코드 = w.창고코드 OR CAST(d.창고코드 AS TEXT) = CAST(w.창고코드 AS TEXT)
        GROUP BY 1, 2, 3

        -- West Disposed
        UNION ALL
        SELECT
          ${getBranchExpr('West', 'd.창고명')} AS branch,
          ${categoryCase('i')} AS category,
          ${tierCase('i')} AS tier,
          SUM(CASE WHEN d.일자 = '${date}' THEN CAST(REPLACE(d.수량, ',', '') AS NUMERIC) ELSE 0 END) AS transfer_qty,
          SUM(CASE WHEN d.일자 = '${date}' THEN ${weightCalc('d.수량', 'i.규격정보')} ELSE 0 END) AS transfer_w,
          SUM(CASE WHEN ${rollWhenDisposed} THEN CAST(REPLACE(d.수량, ',', '') AS NUMERIC) ELSE 0 END) AS roll_qty,
          SUM(CASE WHEN ${rollWhenDisposed} THEN ${weightCalc('d.수량', 'i.규격정보')} ELSE 0 END) AS roll_w
        FROM west_disposed_inventory d
        LEFT JOIN items i ON d.품목코드 = i.품목코드
        GROUP BY 1, 2, 3
      ) GROUP BY 1, 2, 3
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
        branches: Array.from(branches).sort((a, b) => compareOffices(a, b, officeOrder)),
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
