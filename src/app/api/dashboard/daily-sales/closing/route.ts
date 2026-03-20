import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Daily Closing Status (Excel rendition)
 * Specifically for the /dashboard/daily-sales page
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2025-11-01';
    const division = searchParams.get('division') || '창원';

    // Calculate the start of the month for the given date
    const startDate = `${date.substring(0, 7)}-01`;

    const getSalesBranchFilter = () => {
      if (division === '전체') return "1=1";
      if (division === '창원') return "(ec.전체사업소 = '경남사업소' OR w.창고명 = '창원' OR c.거래처명 = '테크젠 주식회사')";
      if (division === 'MB') return "ec.전체사업소 = '벤츠'";
      if (division === '화성') return "ec.전체사업소 LIKE '%화성%'";
      return `(ec.전체사업소 LIKE '%${division}%' OR w.창고명 LIKE '%${division}%')`;
    };

    const getPurchBranchFilter = () => {
      if (division === '전체') return "1=1";
      return `(거래처그룹1명 LIKE '%${division}%' OR 창고명 LIKE '%${division}%')`;
    };

    const getDepBranchFilter = () => {
      if (division === '전체') return "1=1";
      if (division === 'MB') return "부서명 = 'MB'";
      return `부서명 LIKE '%${division}%'`;
    };

    // 0. Base subquery for sales with UNION across all division tables
    const baseSalesSubquery = `
      SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM sales
      UNION ALL
      SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM east_division_sales
      UNION ALL
      SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM west_division_sales
      UNION ALL
      SELECT 일자, 거래처코드, NULL as 담당자코드, 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, NULL as 신규일, NULL as 적요, NULL as 적요2 FROM south_division_sales
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
            WHEN c.거래처명 LIKE '메르세데스벤츠%' OR i.품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN c.거래처명 IN ('셰플러코리아 유한책임회사', '한백윤활유') OR i.품목그룹1코드 = 'FU' THEN '훅스'
            WHEN i.품목그룹1코드 = 'BL' THEN '블라자'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI') OR (i.품목그룹1코드 IS NULL AND (c.거래처명 = '테크젠 주식회사' OR w.창고명 = '창원')) THEN 'Mobil'
            ELSE '기타(셸 외 타사제품)'
          END as category,
          CASE
            WHEN c.거래처명 LIKE '메르세데스벤츠%' OR i.품목그룹1코드 = 'MB' THEN 0
            ELSE CAST(REPLACE(s.합계, ',', '') AS NUMERIC)
          END as amount,
          CAST(REPLACE(s.중량, ',', '') AS NUMERIC) as weight,
          s.일자
        FROM (${baseSalesSubquery}) s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE ${getSalesBranchFilter()}
          AND s.일자 >= '${startDate}' AND s.일자 <= '${date}'
      )
      GROUP BY category
    `;

    // 2. Collection Status Aggregation (using deposits and promissory_notes for better metadata)
    const collectionQuery = `
      SELECT
        method,
        SUM(CASE WHEN 일자 < '${date}' THEN amount ELSE 0 END) as prevTotal,
        SUM(CASE WHEN 일자 = '${date}' THEN amount ELSE 0 END) as today,
        SUM(amount) as total
      FROM (
        SELECT
          CASE
            WHEN 계좌 LIKE '%카드%' OR 계좌 LIKE '%이니시스%' OR 적요 LIKE '%이니시스%' THEN '카드'
            ELSE 'Cash'
          END as method,
          CAST(REPLACE(금액, ',', '') AS NUMERIC) as amount,
          전표번호 as 일자
        FROM deposits
        WHERE 계정명 = '외상매출금'
          AND ${getDepBranchFilter()}
          AND 전표번호 >= '${startDate}' AND 전표번호 <= '${date}'

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

    // 3. Inventory Status Aggregation (Inventory always needs historical data for beginning stock)
    const inventoryQuery = `
      SELECT
        category,
        SUM(CASE WHEN 일자 < '${date}' AND type = 'in' THEN amount WHEN 일자 < '${date}' AND type = 'out' THEN -amount ELSE 0 END) as prevStock,
        SUM(CASE WHEN 일자 = '${date}' AND type = 'in' THEN amount ELSE 0 END) as inflow,
        SUM(CASE WHEN 일자 = '${date}' AND type = 'out' THEN amount ELSE 0 END) as outflow,
        SUM(CASE WHEN type = 'in' THEN amount ELSE -amount END) as stock
      FROM (
        SELECT
          CASE
            WHEN 구매처명 LIKE '메르세데스벤츠%' OR 품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN 구매처명 IN ('셰플러코리아 유한책임회사', '한백윤활유') OR 품목그룹1코드 = 'FU' THEN '훅스'
            WHEN 품목그룹1코드 = 'BL' THEN '블라자'
            WHEN 품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI') OR (품목그룹1코드 IS NULL AND (창고명 = '창원')) THEN 'Mobil'
            ELSE '기타'
          END as category,
          CAST(REPLACE(중량, ',', '') AS NUMERIC) / 200.0 as amount,
          'in' as type,
          일자
        FROM (
          SELECT 일자, 거래처그룹1명, 창고명, 중량, 품목그룹1코드, 구매처명 FROM purchases
          UNION ALL
          SELECT 일자, 거래처그룹1명, 창고명, 중량, 품목그룹1코드, 구매처명 FROM east_division_purchases
          UNION ALL
          SELECT 일자, 거래처그룹1명, 창고명, 중량, 품목그룹1코드, 구매처명 FROM west_division_purchases
          UNION ALL
          SELECT 일자, 거래처그룹1명, 창고명, 중량, 품목그룹1코드, 구매처명 FROM south_division_purchases
        )
        WHERE ${getPurchBranchFilter()} AND 일자 <= '${date}'

        UNION ALL

        SELECT
          CASE
            WHEN c.거래처명 LIKE '메르세데스벤츠%' OR i.품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN c.거래처명 IN ('셰플러코리아 유한책임회사', '한백윤활유') OR i.품목그룹1코드 = 'FU' THEN '훅스'
            WHEN i.품목그룹1코드 = 'BL' THEN '블라자'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI') OR (i.품목그룹1코드 IS NULL AND (c.거래처명 = '테크젠 주식회사' OR w.창고명 = '창원')) THEN 'Mobil'
            ELSE '기타'
          END as category,
          CAST(REPLACE(s.중량, ',', '') AS NUMERIC) / 200.0 as amount,
          'out' as type,
          s.일자
        FROM (${baseSalesSubquery}) s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE ${getSalesBranchFilter()} AND s.일자 <= '${date}'
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
        FROM (${baseSalesSubquery}) s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 >= '${startDate}' AND s.일자 <= '${date}' AND i.품목그룹3코드 = 'FLA' AND i.품목그룹1코드 = 'IL' AND ${getSalesBranchFilter()}
        UNION ALL
        SELECT CAST(REPLACE(중량, ',', '') AS NUMERIC) as volume, 'purchase' as type, 일자
        FROM (
          SELECT 일자, 중량, 품목그룹3코드, 품목그룹1코드, 거래처그룹1명, 창고명 FROM purchases
          UNION ALL
          SELECT 일자, 중량, 품목그룹3코드, 품목그룹1코드, 거래처그룹1명, 창고명 FROM east_division_purchases
          UNION ALL
          SELECT 일자, 중량, 품목그룹3코드, 품목그룹1코드, 거래처그룹1명, 창고명 FROM west_division_purchases
          UNION ALL
          SELECT 일자, 중량, 품목그룹3코드, 품목그룹1코드, 거래처그룹1명, 창고명 FROM south_division_purchases
        )
        WHERE 일자 >= '${startDate}' AND 일자 <= '${date}' AND 품목그룹3코드 = 'FLA' AND 품목그룹1코드 = 'IL' AND ${getPurchBranchFilter()}
      )
    `;

    // 5. Mobil Purchase Metrics (당일 입고량 / 매입액)
    const purchaseQuery = `
      SELECT
        SUM(CASE WHEN 일자 = '${date}' THEN volume ELSE 0 END) as todayVolume,
        SUM(CASE WHEN 일자 = '${date}' THEN amount ELSE 0 END) as todayAmount
      FROM (
        SELECT
          CAST(REPLACE(중량, ',', '') AS NUMERIC) as volume,
          CAST(REPLACE(합_계, ',', '') AS NUMERIC) as amount,
          일자
        FROM (
          SELECT 일자, 중량, 합_계, 품목그룹1코드, 거래처그룹1명, 창고명 FROM purchases
          UNION ALL
          SELECT 일자, 중량, 합_계, 품목그룹1코드, 거래처그룹1명, 창고명 FROM east_division_purchases
          UNION ALL
          SELECT 일자, 중량, 합_계, 품목그룹1코드, 거래처그룹1명, 창고명 FROM west_division_purchases
          UNION ALL
          SELECT 일자, 중량, 합_계, 품목그룹1코드, 거래처그룹1명, 창고명 FROM south_division_purchases
        )
        WHERE 일자 >= '${startDate}' AND 일자 <= '${date}'
          AND 품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI', 'MB')
          AND ${getPurchBranchFilter()}
      )
    `;

    const [salesRes, collRes, invRes, flagRes, purchRes] = await Promise.all([
      executeSQL(salesQuery),
      executeSQL(collectionQuery),
      executeSQL(inventoryQuery),
      executeSQL(flagshipQuery),
      executeSQL(purchaseQuery)
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
    const invCategories = ['Mobil', 'Mobil-MB', '블라자', '훅스', '기타'];
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
