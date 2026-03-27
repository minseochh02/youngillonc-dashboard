import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Daily Closing Status (Excel rendition)
 * Specifically for the /dashboard/daily-status/sales page
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const division = searchParams.get('division') || '창원';
    const includeVat = searchParams.get('includeVat') === 'true';

    const divisor = includeVat ? '1.0' : '1.1';

    // Calculate the start of the month for the given date
    const startDate = `${date.substring(0, 7)}-01`;

    const getSalesBranchFilter = () => {
      if (division === '전체') return "1=1";
      if (division === '창원') return "(COALESCE(c2.거래처그룹1명, c.거래처그룹1명) LIKE '%창원%' OR COALESCE(c2.거래처그룹1명, c.거래처그룹1명) = '경남사업소' OR COALESCE(c2.거래처명, c.거래처명) = '테크젠 주식회사')";
      if (division === 'MB') return "(COALESCE(c2.거래처그룹1명, c.거래처그룹1명) LIKE '%벤츠%' OR COALESCE(c2.거래처그룹1명, c.거래처그룹1명) LIKE '%MB%')";
      if (division === '화성') return "COALESCE(c2.거래처그룹1명, c.거래처그룹1명) LIKE '%화성%'";
      return `COALESCE(c2.거래처그룹1명, c.거래처그룹1명) LIKE '%${division}%'`;
    };

    const getPurchBranchFilter = () => {
      if (division === '전체') return "1=1";
      if (division === '창원') return "창고명 LIKE '%창원%'";
      return `창고명 LIKE '%${division}%'`;
    };

    const getDepBranchFilter = (alias: string = '', isLedger: boolean = false) => {
      const prefix = alias ? `${alias}.` : '';
      if (division === '전체') return "1=1";
      if (isLedger) {
        if (division === 'MB') return `(${prefix}거래처그룹1명 LIKE '%MB%' OR ${prefix}거래처그룹1명 LIKE '%벤츠%')`;
        return `${prefix}거래처그룹1명 LIKE '%${division}%'`;
      }
      if (division === 'MB') return `${prefix}부서명 = 'MB'`;
      return `${prefix}부서명 LIKE '%${division}%'`;
    };

    // 0. Base subquery to combine sales tables (excluding south division)
    const baseSalesSubquery = `
      (
        SELECT 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 출하창고코드, 실납업체 FROM sales
        UNION ALL
        SELECT 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 창고코드 as 출하창고코드, 실납업체 FROM east_division_sales
        UNION ALL
        SELECT 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 창고코드 as 출하창고코드, 실납업체 FROM west_division_sales
      )
    `;

    // Base subquery for purchases
    const basePurchSubquery = `
      (
        SELECT 일자, 거래처코드, 품목코드, 중량, 합_계 as 합계, 창고코드 FROM purchases
        UNION ALL
        SELECT 일자, 거래처코드, 품목코드, 중량, 합_계 as 합계, 창고명 as 창고코드 FROM east_division_purchases
        UNION ALL
        SELECT 일자, 거래처코드, 품목코드, 중량, 합_계 as 합계, 창고명 as 창고코드 FROM west_division_purchases
      )
    `;

    // 1. Sales Status Aggregation
    const salesQuery = `
      SELECT
        category,
        SUM(CASE WHEN 일자 < '${date}' THEN amount ELSE 0 END) as prevTotal,
        SUM(CASE WHEN 일자 = '${date}' THEN amount ELSE 0 END) as today,
        SUM(amount) as total,
        SUM(CASE WHEN 일자 = '${date}' THEN weight ELSE 0 END) / 200.0 as weightDM
      FROM (
        SELECT
          CASE
            WHEN i.품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN i.품목그룹1코드 = 'FU' THEN '훅스'
            WHEN i.품목그룹1코드 = 'BL' THEN '블라자'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI', 'MAR') THEN 'Mobil'
            ELSE '기타(셸 외 타사제품)'
          END as category,
          CASE
            WHEN i.품목그룹1코드 = 'MB' THEN 0
            ELSE CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}
          END as amount,
          CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as weight,
          s.일자
        FROM (${baseSalesSubquery}) s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN clients c2 ON (s.실납업체 IS NOT NULL AND s.실납업체 != '' AND s.실납업체 = c2.거래처코드)
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE ${getSalesBranchFilter()}
          AND s.일자 >= '${startDate}' AND s.일자 <= '${date}'
      )
      GROUP BY category
    `;

    // 2. Collection Status Aggregation (using ledger and promissory_notes)
    // Updated Mar 24: Pulling customer collections directly from ledger (Account 1089)
    const collectionQuery = `
      SELECT
        method,
        SUM(CASE WHEN 일자 < '${date}' THEN amount ELSE 0 END) as prevTotal,
        SUM(CASE WHEN 일자 = '${date}' THEN amount ELSE 0 END) as today,
        SUM(amount) as total
      FROM (
        SELECT
          CASE
            WHEN l.적요 LIKE '%카드%' OR l.적요 LIKE '%이니시스%' OR l.적요 LIKE '%삼성%' OR l.적요 LIKE '%비씨%' 
              OR l.적요 LIKE '%현대%' OR l.적요 LIKE '%신한%' OR l.적요 LIKE '%국민%' OR l.적요 LIKE '%롯데%' OR l.적요 LIKE '%하나%' 
            THEN '카드'
            ELSE 'Cash'
          END as method,
          COALESCE(l.대변금액, 0) as amount,
          l.일자 as 일자
        FROM ledger l
        LEFT JOIN clients c ON l.거래처코드 = c.거래처코드
        WHERE l.계정코드 = '1089'
          AND l.대변금액 > 0
          AND l.적요 NOT LIKE '%할인%'
          AND ${getDepBranchFilter('c', true)}
          AND l.일자 >= '${startDate}' AND l.일자 <= '${date}'

        UNION ALL

        SELECT
          '어음' as method,
          CAST(REPLACE(증가금액, ',', '') AS NUMERIC) as amount,
          일자
        FROM promissory_notes
        WHERE 증감구분 = '증가'
          AND ${getDepBranchFilter()}
          AND 일자 >= '${startDate}' AND 일자 <= '${date}'
      )
      GROUP BY method
    `;

    // 3. Inventory Status Aggregation (Using Feb 01 baseline from esz018r_6)
    const BASELINE_DATE = '2026-02-01';
    const inventoryQuery = `
      SELECT
        category,
        SUM(CASE WHEN type = 'baseline' THEN amount 
                 WHEN 일자 < '${date}' AND type = 'in' THEN amount 
                 WHEN 일자 < '${date}' AND type = 'out' THEN -amount 
                 ELSE 0 END) as prevStock,
        SUM(CASE WHEN 일자 = '${date}' AND type = 'in' THEN amount ELSE 0 END) as inflow,
        SUM(CASE WHEN 일자 = '${date}' AND type = 'out' THEN amount ELSE 0 END) as outflow,
        SUM(CASE WHEN type = 'baseline' OR type = 'in' THEN amount 
                 WHEN type = 'out' THEN -amount 
                 ELSE 0 END) as stock
      FROM (
        -- 1. Baseline (Feb 1st)
        SELECT
          CASE
            WHEN i.품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI', 'MAR') THEN 'Mobil'
            WHEN i.품목그룹1코드 = 'FU' THEN '훅스'
            WHEN i.품목그룹1코드 = 'BL' THEN '블라자'
            ELSE '기타(셸 외 타사제품)'
          END as category,
          CAST(REPLACE(CAST(b.중량 AS TEXT), ',', '') AS NUMERIC) / 200.0 as amount,
          'baseline' as type,
          '${BASELINE_DATE}' as 일자
        FROM esz018r_6 b
        LEFT JOIN items i ON b.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON b.창고코드 = w.창고코드 OR b.창고코드 = CAST(w.창고코드 AS TEXT)
        WHERE ${getPurchBranchFilter()}

        UNION ALL

        -- 2. Purchases (Feb 1st onwards)
        SELECT
          CASE
            WHEN i.품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN i.품목그룹1코드 = 'FU' THEN '훅스'
            WHEN i.품목그룹1코드 = 'BL' THEN '블라자'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI', 'MAR') THEN 'Mobil'
            ELSE '기타(셸 외 타사제품)'
          END as category,
          CAST(REPLACE(p.중량, ',', '') AS NUMERIC) / 200.0 as amount,
          'in' as type,
          p.일자
        FROM ${basePurchSubquery} p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON p.창고코드 = w.창고코드 OR p.창고코드 = w.창고명
        LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
        WHERE ${getPurchBranchFilter()} AND p.일자 >= '${BASELINE_DATE}' AND p.일자 <= '${date}'

        UNION ALL

        -- 3. Sales (Feb 1st onwards)
        SELECT
          CASE
            WHEN i.품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN i.품목그룹1코드 = 'FU' THEN '훅스'
            WHEN i.품목그룹1코드 = 'BL' THEN '블라자'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI', 'MAR') THEN 'Mobil'
            ELSE '기타(셸 외 타사제품)'
          END as category,
          CAST(REPLACE(s.중량, ',', '') AS NUMERIC) / 200.0 as amount,
          'out' as type,
          s.일자
        FROM ${baseSalesSubquery} s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN clients c2 ON (s.실납업체 IS NOT NULL AND s.실납업체 != '' AND s.실납업체 = c2.거래처코드)
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE ${getSalesBranchFilter()} AND s.일자 >= '${BASELINE_DATE}' AND s.일자 <= '${date}'
      )
      GROUP BY category
    `;

    // 4. Flagship IL Metrics
    const flagshipQuery = `
      SELECT
        SUM(CASE WHEN type = 'sales' AND 일자 = '${date}' THEN volume ELSE 0 END) as salesToday,
        SUM(CASE WHEN type = 'purchase' AND 일자 = '${date}' THEN volume ELSE 0 END) as purchaseToday,
        SUM(CASE WHEN type = 'sales' THEN volume ELSE 0 END) as salesMTD,
        SUM(CASE WHEN type = 'purchase' THEN volume ELSE 0 END) as purchaseMTD
      FROM (
        SELECT CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as volume, 'sales' as type, s.일자
        FROM ${baseSalesSubquery} s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN clients c2 ON (s.실납업체 IS NOT NULL AND s.실납업체 != '' AND s.실납업체 = c2.거래처코드)
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 >= '${startDate}' AND s.일자 <= '${date}' AND i.품목그룹3코드 = 'FLA' AND i.품목그룹1코드 = 'IL' AND ${getSalesBranchFilter()}
        UNION ALL
        SELECT CAST(REPLACE(p.중량, ',', '') AS NUMERIC) as volume, 'purchase' as type, p.일자
        FROM ${basePurchSubquery} p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON p.창고코드 = w.창고코드 OR p.창고코드 = w.창고명
        WHERE p.일자 >= '${startDate}' AND p.일자 <= '${date}' AND i.품목그룹3코드 = 'FLA' AND i.품목그룹1코드 = 'IL' AND ${getPurchBranchFilter()}
      )
    `;

    // 5. Mobil Purchase Metrics (당일 입고량 / 매입액)
    const purchaseMetricsQuery = `
      SELECT
        SUM(CASE WHEN 일자 = '${date}' THEN volume ELSE 0 END) as todayVolume,
        SUM(CASE WHEN 일자 = '${date}' THEN amount ELSE 0 END) as todayAmount
      FROM (
        SELECT
          CAST(REPLACE(p.중량, ',', '') AS NUMERIC) as volume,
          CAST(REPLACE(p.합계, ',', '') AS NUMERIC) / ${divisor} as amount,
          p.일자
        FROM ${basePurchSubquery} p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        LEFT JOIN warehouses w ON p.창고코드 = w.창고코드 OR p.창고코드 = w.창고명
        WHERE p.일자 >= '${startDate}' AND p.일자 <= '${date}'
          AND i.품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'MB', 'AVI', 'MAR')
          AND ${getPurchBranchFilter()}
      )
    `;

    const [salesRes, collRes, invRes, flagRes, purchRes] = await Promise.all([
      executeSQL(salesQuery),
      executeSQL(collectionQuery),
      executeSQL(inventoryQuery),
      executeSQL(flagshipQuery),
      executeSQL(purchaseMetricsQuery)
    ]);

    // Map Sales Results
    const salesCategories = ['Mobil', 'Mobil-MB', '블라자', '훅스', '기타(셸 외 타사제품)'];
    const salesData = salesCategories.map(cat => {
      const row = salesRes?.rows?.find((r: any) => r.category === cat) || { prevTotal: 0, today: 0, total: 0, weightDM: 0 };
      return {
        category: cat,
        prevTotal: Number(row.prevTotal) || 0,
        today: Number(row.today) || 0,
        total: Number(row.total) || 0,
        remarks: row.today > 0 || row.weightDM > 0 ? `${(Number(row.weightDM) || 0).toFixed(2)} D/M` : '-'
      };
    });

    // Map Collection Results
    const collMethods = ['Cash', '어음', '카드'];
    const collectionData = collMethods.map(method => {
      const row = collRes?.rows?.find((r: any) => r.method === method) || { prevTotal: 0, today: 0, total: 0 };
      return {
        method,
        prevTotal: Number(row.prevTotal) || 0,
        today: Number(row.today) || 0,
        total: Number(row.total) || 0
      };
    });

    // Map Inventory Results
    const invCategories = ['Mobil', 'Mobil-MB', '블라자', '훅스', '기타(셸 외 타사제품)'];
    const inventoryData = invCategories.map(cat => {
      const row = invRes?.rows?.find((r: any) => r.category === cat) || { prevStock: 0, inflow: 0, outflow: 0, stock: 0 };
      return {
        category: cat,
        unit: 'D/M',
        prevStock: Number(row.prevStock) || 0,
        in: Number(row.inflow) || 0,
        out: Number(row.outflow) || 0,
        stock: Number(row.stock) || 0
      };
    });

    const flagship = flagRes?.rows?.[0] || { salesToday: 0, purchaseToday: 0, salesMTD: 0, purchaseMTD: 0 };
    const purchaseMetrics = purchRes?.rows?.[0] || { todayVolume: 0, todayAmount: 0 };

    return NextResponse.json({
      success: true,
      salesData,
      collectionData,
      inventoryData,
      flagship: {
        salesVol: Number(flagship.salesToday) || 0,
        purchaseVol: Number(flagship.purchaseToday) || 0,
        salesMTD: Number(flagship.salesMTD) || 0,
        purchaseMTD: Number(flagship.purchaseMTD) || 0
      },
      purchaseData: {
        todayVolume: Number(purchaseMetrics.todayVolume) || 0,
        todayAmount: Number(purchaseMetrics.todayAmount) || 0
      },
      date,
      division
    });
  } catch (error: any) {
    console.error('Daily Sales Closing API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch closing status data'
    }, { status: 500 });
  }
}
