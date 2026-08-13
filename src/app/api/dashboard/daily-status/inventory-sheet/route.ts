import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';
import { compareOffices, loadOfficeOrderMap } from '@/lib/display-order';
import { rebuildComputedInventoryDaily } from '@/lib/computed-inventory-utils';

export const dynamic = 'force-dynamic';

function getBranchName(branchSource: string, whCode: string, viewMode: 'division' | 'office'): string {
  if (viewMode === 'division') {
    if (branchSource === 'HQ') return '본사';
    if (branchSource === 'East') return '동부';
    return '서부';
  }
  
  if (branchSource === 'HQ') {
    const col = whCode || '';
    if (col === '02' || col === '2') return '동부';
    if (col === '03' || col === '3') return '서부';
    if (col === '05' || col === '5') return '화성';
    if (col === '06' || col === '6') return '창원';
    if (col === '09' || col === '9') return '본사';
    if (col === '42') return '중부';
    if (col === '50') return '부산';
    if (col === '51') return '제주';
    if (col === '54') return '화성(B2B)';
    if (col === 'P1') return 'EHS';
    if (col === 'P2') return '영일유화';
    if (col === 'P3') return '백호테크원';
    if (col === 'P4') return '다우기업';
    
    // Fallback for safety
    if (col === 'MB') return 'MB';
    if (col.includes('중부')) return '중부';
    if (col.includes('남부')) return '남부';
    if (col.includes('서부')) return '서부';
    if (col.includes('동부')) return '동부';
    if (col.includes('화성')) return '화성';
    if (col.includes('창원')) return '창원';
    if (col.includes('제주')) return '제주';
    if (col.includes('부산')) return '부산';
    return '본사';
  } else if (branchSource === 'East') {
    return '동부';
  } else {
    return '서부';
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const viewMode = (searchParams.get('viewMode') || searchParams.get('mode') || 'division') as 'division' | 'office';
    const officeOrder = await loadOfficeOrderMap();

    const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    // Yesterday relative to the requested date (KST)
    const yesterdayObj = new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayObj.toISOString().slice(0, 10);

    // Calculate real yesterday's date relative to today
    const realYesterdayObj = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    realYesterdayObj.setDate(realYesterdayObj.getDate() - 1);
    const realYesterdayStr = realYesterdayObj.toISOString().slice(0, 10);

    // 1. Freshness Check & Incremental Cache Rebuild
    const maxCacheRes = await executeSQL("SELECT MAX(date) as max_date FROM computed_inventory_daily");
    const maxCacheDate = maxCacheRes.rows[0]?.max_date;
    
    if (!maxCacheDate || maxCacheDate < realYesterdayStr) {
      console.log(`Daily inventory cache is stale (latest: ${maxCacheDate || 'none'} vs required: ${realYesterdayStr}). Rebuilding...`);
      await rebuildComputedInventoryDaily(maxCacheDate || '2026-01-01');
    }

    const stats: Record<string, Record<string, {
      beginning: number;
      beginning_weight: number;
      purchase: number;
      purchase_weight: number;
      transfer_in: number;
      transfer_in_weight: number;
      sales: number;
      sales_weight: number;
      transfer_out: number;
      transfer_out_weight: number;
      internal_use: number;
      internal_use_weight: number;
      disposed: number;
      disposed_weight: number;
      adjustment: number;
      adjustment_weight: number;
      inventory: number;
      inventory_weight: number;
    }>> = {};
    const branches = new Set<string>();

    if (date < todayStr) {
      // 2. HISTORICAL QUERY: Look up precomputed table directly
      const query = `
        SELECT branch_source, warehouse_code, category, tier,
               beginning, beginning_weight,
               purchase, purchase_weight,
               transfer_in, transfer_in_weight,
               sales, sales_weight,
               transfer_out, transfer_out_weight,
               internal_use, internal_use_weight,
               disposed, disposed_weight,
               adjustment, adjustment_weight,
               ending, ending_weight
        FROM computed_inventory_daily
        WHERE date = '${date}'
      `;
      const res = await executeSQL(query);

      for (const r of res.rows) {
        const branch = getBranchName(r.branch_source, r.warehouse_code, viewMode);
        if (!branch) continue;

        branches.add(branch);
        if (!stats[branch]) stats[branch] = {};

        const catKey = `${r.category}_${r.tier}`;
        const existing = stats[branch][catKey] || {
          beginning: 0, beginning_weight: 0,
          purchase: 0, purchase_weight: 0,
          transfer_in: 0, transfer_in_weight: 0,
          sales: 0, sales_weight: 0,
          transfer_out: 0, transfer_out_weight: 0,
          internal_use: 0, internal_use_weight: 0,
          disposed: 0, disposed_weight: 0,
          adjustment: 0, adjustment_weight: 0,
          inventory: 0, inventory_weight: 0
        };

        stats[branch][catKey] = {
          beginning: existing.beginning + Number(r.beginning),
          beginning_weight: existing.beginning_weight + Number(r.beginning_weight),
          purchase: existing.purchase + Number(r.purchase),
          purchase_weight: existing.purchase_weight + Number(r.purchase_weight),
          transfer_in: existing.transfer_in + Number(r.transfer_in),
          transfer_in_weight: existing.transfer_in_weight + Number(r.transfer_in_weight),
          sales: existing.sales + Number(r.sales),
          sales_weight: existing.sales_weight + Number(r.sales_weight),
          transfer_out: existing.transfer_out + Number(r.transfer_out),
          transfer_out_weight: existing.transfer_out_weight + Number(r.transfer_out_weight),
          internal_use: existing.internal_use + Number(r.internal_use),
          internal_use_weight: existing.internal_use_weight + Number(r.internal_use_weight),
          disposed: existing.disposed + Number(r.disposed),
          disposed_weight: existing.disposed_weight + Number(r.disposed_weight),
          adjustment: existing.adjustment + Number(r.adjustment),
          adjustment_weight: existing.adjustment_weight + Number(r.adjustment_weight),
          inventory: existing.inventory + Number(r.ending),
          inventory_weight: existing.inventory_weight + Number(r.ending_weight)
        };
      }
    } else {
      // 3. TODAY/FUTURE FALLBACK: Yesterday's Cached Baseline + Today's dynamic transactions
      const baselineQuery = `
        SELECT branch_source, warehouse_code, category, tier, ending as beginning, ending_weight as beginning_weight
        FROM computed_inventory_daily
        WHERE date = '${yesterdayStr}'
      `;
      const baselineRes = await executeSQL(baselineQuery);

      const vehicleExclusionList = "'10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '32', '33', '34', '36', '37', '38', '40', '41', '42', '45', '52', '56', '57', '58', '59'";

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
        (CAST(${column} AS TEXT) IN ('02', '2', '03', '3', '05', '5', '06', '6', '09', '9', '42', '50', '51', '54', 'P1', 'P2', 'P3', 'P4'))
      `;

      const excludeVehiclesFilter = (column: string) => `
        (CAST(${column} AS TEXT) NOT IN (${vehicleExclusionList}))
      `;
      const excludeVehiclesJoinFilter = (whAlias: string) => `
        (${whAlias}.창고코드 IS NULL OR CAST(${whAlias}.창고코드 AS TEXT) NOT IN (${vehicleExclusionList}))
      `;

      const colIpgo = String.fromCharCode(0xc785, 0xace0, 0xcc3d, 0xace0, 0xba85);
      const colChulgo = String.fromCharCode(0xcd9c, 0xace0, 0xcc3d, 0xace0, 0xba85);

      const txSql = `
        SELECT branch_source, warehouse_code, category, tier,
          SUM(purchase_qty) as purchase_qty, SUM(purchase_w) as purchase_w,
          SUM(transfer_in_qty) as transfer_in_qty, SUM(transfer_in_w) as transfer_in_w,
          SUM(sales_qty) as sales_qty, SUM(sales_w) as sales_w,
          SUM(transfer_out_qty) as transfer_out_qty, SUM(transfer_out_w) as transfer_out_w,
          SUM(internal_use_qty) as internal_use_qty, SUM(internal_use_w) as internal_use_w,
          SUM(disposed_qty) as disposed_qty, SUM(disposed_w) as disposed_w,
          SUM(adjustment_qty) as adjustment_qty, SUM(adjustment_w) as adjustment_w
        FROM (
          -- 1. HQ Sales
          SELECT 
            'HQ' as branch_source, CAST(s.출하창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as sales_qty, ${weightCalc('s.수량', 'i.규격정보')} as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM sales s LEFT JOIN items i ON s.품목코드 = i.품목코드
          WHERE s.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('s.출하창고코드')}

          UNION ALL

          -- 2. East Sales
          SELECT 
            'East' as branch_source, CAST(s.출하창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as sales_qty, ${weightCalc('s.수량', 'i.규격정보')} as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM east_division_sales s LEFT JOIN items i ON s.품목코드 = i.품목코드
          WHERE s.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('s.출하창고코드')}

          UNION ALL

          -- 3. West Sales
          SELECT 
            'West' as branch_source, CAST(s.출하창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as sales_qty, ${weightCalc('s.수량', 'i.규격정보')} as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM west_division_sales s LEFT JOIN items i ON s.품목코드 = i.품목코드
          WHERE s.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('s.출하창고코드')}

          UNION ALL

          -- 4. HQ Purchases
          SELECT 
            'HQ' as branch_source, CAST(p.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            CAST(REPLACE(p.수량, ',', '') AS NUMERIC) as purchase_qty, ${weightCalc('p.수량', 'i.규격정보')} as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM purchases p LEFT JOIN items i ON p.품목코드 = i.품목코드
          WHERE p.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('p.창고코드')}

          UNION ALL

          -- 5. East Purchases
          SELECT 
            'East' as branch_source, CAST(p.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            CAST(REPLACE(p.수량, ',', '') AS NUMERIC) as purchase_qty, ${weightCalc('p.수량', 'i.규격정보')} as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM east_division_purchases p LEFT JOIN items i ON p.품목코드 = i.품목코드
          WHERE p.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('p.창고코드')}

          UNION ALL

          -- 6. West Purchases
          SELECT 
            'West' as branch_source, CAST(p.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            CAST(REPLACE(p.수량, ',', '') AS NUMERIC) as purchase_qty, ${weightCalc('p.수량', 'i.규격정보')} as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM west_division_purchases p LEFT JOIN items i ON p.품목코드 = i.품목코드
          WHERE p.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('p.창고코드')}

          UNION ALL

          -- 7. HQ Internal Uses
          SELECT 
            'HQ' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            CAST(REPLACE(u.수량, ',', '') AS NUMERIC) as internal_use_qty, ${weightCalc('u.수량', 'i.규격정보')} as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM internal_uses u 
          LEFT JOIN items i ON u.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON u.창고명 = w.창고명
          WHERE u.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('w.창고코드')}

          UNION ALL

          -- 8. East Internal Uses
          SELECT 
            'East' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            CAST(REPLACE(u.수량, ',', '') AS NUMERIC) as internal_use_qty, ${weightCalc('u.수량', 'i.규격정보')} as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM east_internal_uses u 
          LEFT JOIN items i ON u.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON u.창고명 = w.창고명
          WHERE u.월_일 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesJoinFilter('w')}

          UNION ALL

          -- 9. West Internal Uses
          SELECT 
            'West' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            CAST(REPLACE(u.수량, ',', '') AS NUMERIC) as internal_use_qty, ${weightCalc('u.수량', 'i.규격정보')} as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM west_internal_uses u 
          LEFT JOIN items i ON u.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON u.창고명 = w.창고명
          WHERE u.월_일 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesJoinFilter('w')}

          UNION ALL

          -- 10. HQ Transfers In
          SELECT 
            'HQ' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_in_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM inventory_transfer t 
          LEFT JOIN items i ON t.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON t.[${colIpgo}] = w.창고명
          WHERE t.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('w.창고코드')}

          UNION ALL

          -- 11. HQ Transfers Out
          SELECT 
            'HQ' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_out_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM inventory_transfer t 
          LEFT JOIN items i ON t.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON t.[${colChulgo}] = w.창고명
          WHERE t.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('w.창고코드')}

          UNION ALL

          -- 12. East Transfers In
          SELECT 
            'East' as branch_source, '02' as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_in_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM east_inventory_transfers t
          LEFT JOIN items i ON t.품목명_규격 = i.품목명 || ' [' || i.규격정보 || ']'
            OR (t.품목명_규격 = 'MOBIL 1 SYNTHETIC LV ATF HP CTN 6X1L [1/6]' AND i.품목코드 = '140618')
            OR (t.품목명_규격 = 'M SUP TP SMART PLUS PRO 0W20 CTN1LX12:KR [1/12]' AND i.품목코드 = '143207')
          LEFT JOIN warehouses w ON t.입고창고명 = w.창고명
          WHERE t.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND w.창고코드 = '02'

          UNION ALL

          -- 13. East Transfers Out
          SELECT 
            'East' as branch_source, '02' as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_out_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM east_inventory_transfers t
          LEFT JOIN items i ON t.품목명_규격 = i.품목명 || ' [' || i.규격정보 || ']'
            OR (t.품목명_규격 = 'MOBIL 1 SYNTHETIC LV ATF HP CTN 6X1L [1/6]' AND i.품목코드 = '140618')
            OR (t.품목명_규격 = 'M SUP TP SMART PLUS PRO 0W20 CTN1LX12:KR [1/12]' AND i.품목코드 = '143207')
          LEFT JOIN warehouses w ON t.출고창고명 = w.창고명
          WHERE t.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND w.창고코드 = '02'

          UNION ALL

          -- 14. West Transfers In
          SELECT 
            'West' as branch_source, '03' as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_in_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM west_internal_transfers t
          LEFT JOIN items i ON t."품목명_규격_" = i.품목명 || ' [' || i.규격정보 || ']'
            OR (t."품목명_규격_" = 'MOBIL 1 SYNTHETIC LV ATF HP CTN 6X1L [1/6]' AND i.품목코드 = '140618')
            OR (t."품목명_규격_" = 'M SUP TP SMART PLUS PRO 0W20 CTN1LX12:KR [1/12]' AND i.품목코드 = '143207')
          LEFT JOIN warehouses w ON t.입고창고명 = w.창고명
          WHERE t.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND w.창고코드 = '03'

          UNION ALL

          -- 15. West Transfers Out
          SELECT 
            'West' as branch_source, '03' as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_out_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM west_internal_transfers t
          LEFT JOIN items i ON t."품목명_규격_" = i.품목명 || ' [' || i.규격정보 || ']'
            OR (t."품목명_규격_" = 'MOBIL 1 SYNTHETIC LV ATF HP CTN 6X1L [1/6]' AND i.품목코드 = '140618')
            OR (t."품목명_규격_" = 'M SUP TP SMART PLUS PRO 0W20 CTN1LX12:KR [1/12]' AND i.품목코드 = '143207')
          LEFT JOIN warehouses w ON t.출고창고명 = w.창고명
          WHERE t.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND w.창고코드 = '03'

          -- 16. HQ Production Inbound
          UNION ALL
          SELECT 
            'HQ' as branch_source, CAST(pm.format_wh AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            CAST(REPLACE(pm.생산수량, ',', '') AS NUMERIC) as purchase_qty, 
            CAST(REPLACE(pm.생산수량, ',', '') AS NUMERIC) * 
            CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(i.규격정보, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
            CASE 
              WHEN i.규격정보 LIKE '%G%' AND i.규격정보 NOT LIKE '%KG%' AND i.규격정보 NOT LIKE '%GL%' THEN 0.001
              WHEN i.규격정보 LIKE '%ML%' THEN 0.001
              ELSE 1.0
            END as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM (
            SELECT 일자, 생산품목코드, 생산수량,
              CASE WHEN 입고창고코드 GLOB '*[0-9]*' AND length(입고창고코드) = 1 THEN '0' || 입고창고코드 ELSE 입고창고코드 END as format_wh
            FROM production_material_consumption
          ) pm LEFT JOIN items i ON pm.생산품목코드 = i.품목코드
          WHERE pm.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('pm.format_wh')}

          -- 17. HQ Production Outbound
          UNION ALL
          SELECT 
            'HQ' as branch_source, CAST(pm.format_wh AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            CAST(REPLACE(pm.실제소모수량, ',', '') AS NUMERIC) as internal_use_qty, 
            CAST(REPLACE(pm.실제소모수량, ',', '') AS NUMERIC) * 
            CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(i.규격정보, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
            CASE 
              WHEN i.규격정보 LIKE '%G%' AND i.규격정보 NOT LIKE '%KG%' AND i.규격정보 NOT LIKE '%GL%' THEN 0.001
              WHEN i.규격정보 LIKE '%ML%' THEN 0.001
              ELSE 1.0
            END as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
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
          ) pm LEFT JOIN items i ON pm.소모품목코드 = i.품목코드
          WHERE pm.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('pm.format_wh')}

          -- 18. HQ Disposed
          UNION ALL
          SELECT 
            'HQ' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            CAST(REPLACE(d.수량, ',', '') AS NUMERIC) as disposed_qty, ${weightCalc('d.수량', 'i.규격정보')} as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM disposed_inventory d 
          LEFT JOIN items i ON d.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON d.창고명 = w.창고명
          WHERE d.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('w.창고코드')}

          -- 19. East Disposed
          UNION ALL
          SELECT 
            'East' as branch_source, CAST(COALESCE(w.창고코드, d.창고코드) AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            CAST(REPLACE(d.수량, ',', '') AS NUMERIC) as disposed_qty, ${weightCalc('d.수량', 'i.규격정보')} as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM east_disposed_inventory d 
          LEFT JOIN items i ON d.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON d.창고코드 = w.창고코드 OR CAST(d.창고코드 AS TEXT) = CAST(w.창고코드 AS TEXT)
          WHERE d.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesJoinFilter('w')}

          -- 20. West Disposed
          UNION ALL
          SELECT 
            'West' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            CAST(REPLACE(d.수량, ',', '') AS NUMERIC) as disposed_qty, ${weightCalc('d.수량', 'i.규격정보')} as disposed_w,
            0 as adjustment_qty, 0 as adjustment_w
          FROM west_disposed_inventory d 
          LEFT JOIN items i ON d.품목코드 = i.품목코드
          LEFT JOIN warehouses w ON d.창고명 = w.창고명
          WHERE d.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesJoinFilter('w')}

          -- 21. East Adjustments
          UNION ALL
          SELECT 
            'East' as branch_source, CAST(adj.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            CAST(REPLACE(adj.조정수량, ',', '') AS NUMERIC) as adjustment_qty, ${weightCalc('adj.조정수량', 'i.규격정보')} as adjustment_w
          FROM east_inventory_adjustments adj LEFT JOIN items i ON adj.품목코드 = i.품목코드
          WHERE adj.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('adj.창고코드')}

          -- 22. West Adjustments
          UNION ALL
          SELECT 
            'West' as branch_source, CAST(adj.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            CAST(REPLACE(adj.조정수량, ',', '') AS NUMERIC) as adjustment_qty, ${weightCalc('adj.조정수량', 'i.규격정보')} as adjustment_w
          FROM west_inventory_adjustments adj LEFT JOIN items i ON adj.품목코드 = i.품목코드
          WHERE adj.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('adj.창고코드')}

          -- 23. HQ Adjustments
          UNION ALL
          SELECT 
            'HQ' as branch_source, CAST(adj.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
            0 as purchase_qty, 0 as purchase_w,
            0 as transfer_in_qty, 0 as transfer_in_w,
            0 as sales_qty, 0 as sales_w,
            0 as transfer_out_qty, 0 as transfer_out_w,
            0 as internal_use_qty, 0 as internal_use_w,
            0 as disposed_qty, 0 as disposed_w,
            CAST(REPLACE(adj.조정수량, ',', '') AS NUMERIC) as adjustment_qty, ${weightCalc('adj.조정수량', 'i.규격정보')} as adjustment_w
          FROM inventory_adjustments adj LEFT JOIN items i ON adj.품목코드 = i.품목코드
          WHERE adj.일자 = '${date}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('adj.창고코드')}
        )
        GROUP BY branch_source, warehouse_code, category, tier
      `;
      const txRes = await executeSQL(txSql);

      const txMap = new Map<string, any>();
      for (const r of txRes.rows) {
        const k = `${r.branch_source}|${r.warehouse_code}|${r.category}|${r.tier}`;
        txMap.set(k, r);
      }

      const allCombos = new Set<string>();
      const baselineMap = new Map<string, { beginning: number; beginning_weight: number }>();

      for (const r of baselineRes.rows) {
        const combo = `${r.branch_source}|${r.warehouse_code}|${r.category}|${r.tier}`;
        allCombos.add(combo);
        baselineMap.set(combo, {
          beginning: Number(r.beginning) || 0,
          beginning_weight: Number(r.beginning_weight) || 0
        });
      }

      for (const r of txRes.rows) {
        allCombos.add(`${r.branch_source}|${r.warehouse_code}|${r.category}|${r.tier}`);
      }

      for (const combo of allCombos) {
        const [branch_source, warehouse_code, category, tier] = combo.split('|');
        const branch = getBranchName(branch_source, warehouse_code, viewMode);
        if (!branch) continue;

        branches.add(branch);
        if (!stats[branch]) stats[branch] = {};

        const catKey = `${category}_${tier}`;
        const base = baselineMap.get(combo) || { beginning: 0, beginning_weight: 0 };
        const tx = txMap.get(combo) || {
          purchase_qty: 0, purchase_w: 0,
          transfer_in_qty: 0, transfer_in_w: 0,
          sales_qty: 0, sales_w: 0,
          transfer_out_qty: 0, transfer_out_w: 0,
          internal_use_qty: 0, internal_use_w: 0,
          disposed_qty: 0, disposed_w: 0,
          adjustment_qty: 0, adjustment_w: 0
        };

        const beginning = base.beginning;
        const beginning_weight = base.beginning_weight;

        const purchase = Number(tx.purchase_qty) || 0;
        const purchase_weight = Number(tx.purchase_w) || 0;
        const transfer_in = Number(tx.transfer_in_qty) || 0;
        const transfer_in_weight = Number(tx.transfer_in_w) || 0;
        const sales = Number(tx.sales_qty) || 0;
        const sales_weight = Number(tx.sales_w) || 0;
        const transfer_out = Number(tx.transfer_out_qty) || 0;
        const transfer_out_weight = Number(tx.transfer_out_w) || 0;
        const internal_use = Number(tx.internal_use_qty) || 0;
        const internal_use_weight = Number(tx.internal_use_w) || 0;
        const disposed = Number(tx.disposed_qty) || 0;
        const disposed_weight = Number(tx.disposed_w) || 0;
        const adj = Number(tx.adjustment_qty) || 0;
        const adj_w = Number(tx.adjustment_w) || 0;

        const ending = beginning + purchase + transfer_in - sales - transfer_out - internal_use - disposed + adj;
        const ending_weight = beginning_weight + purchase_weight + transfer_in_weight - sales_weight - transfer_out_weight - internal_use_weight - disposed_weight + adj_w;

        const existing = stats[branch][catKey] || {
          beginning: 0, beginning_weight: 0,
          purchase: 0, purchase_weight: 0,
          transfer_in: 0, transfer_in_weight: 0,
          sales: 0, sales_weight: 0,
          transfer_out: 0, transfer_out_weight: 0,
          internal_use: 0, internal_use_weight: 0,
          disposed: 0, disposed_weight: 0,
          adjustment: 0, adjustment_weight: 0,
          inventory: 0, inventory_weight: 0
        };

        stats[branch][catKey] = {
          beginning: existing.beginning + beginning,
          beginning_weight: existing.beginning_weight + beginning_weight,
          purchase: existing.purchase + purchase,
          purchase_weight: existing.purchase_weight + purchase_weight,
          transfer_in: existing.transfer_in + transfer_in,
          transfer_in_weight: existing.transfer_in_weight + transfer_in_weight,
          sales: existing.sales + sales,
          sales_weight: existing.sales_weight + sales_weight,
          transfer_out: existing.transfer_out + transfer_out,
          transfer_out_weight: existing.transfer_out_weight + transfer_out_weight,
          internal_use: existing.internal_use + internal_use,
          internal_use_weight: existing.internal_use_weight + internal_use_weight,
          disposed: existing.disposed + disposed,
          disposed_weight: existing.disposed_weight + disposed_weight,
          adjustment: existing.adjustment + adj,
          adjustment_weight: existing.adjustment_weight + adj_w,
          inventory: existing.inventory + ending,
          inventory_weight: existing.inventory_weight + ending_weight
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        branches: Array.from(branches).sort((a, b) => compareOffices(a, b, officeOrder)),
        stats,
        date
      }
    });

  } catch (error: unknown) {
    console.error('Daily Inventory API Error:', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: errMessage || 'Internal Server Error' 
    }, { status: 500 });
  }
}
