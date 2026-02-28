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

    const getSalesBranchFilter = () => {
      if (division === '전체') return "(거래처그룹1코드명 LIKE '%사업소%' OR 거래처그룹1코드명 LIKE '%지사%')";
      if (division === '창원') return "(창고명 = '창원' OR 판매처명 = '테크젠 주식회사')";
      if (division === 'MB') return "거래처그룹1코드명 = 'MB'";
      return `(거래처그룹1코드명 LIKE '%${division}%' OR 창고명 LIKE '%${division}%')`;
    };

    const getPurchBranchFilter = () => {
      if (division === '전체') return "(거래처그룹1명 LIKE '%사업소%' OR 거래처그룹1명 LIKE '%지사%')";
      return `(거래처그룹1명 LIKE '%${division}%' OR 창고명 LIKE '%${division}%')`;
    };

    const getDepBranchFilter = () => {
      if (division === '전체') return "(부서명 LIKE '%사업소%' OR 부서명 LIKE '%지사%')";
      if (division === 'MB') return "부서명 = 'MB'";
      return `부서명 LIKE '%${division}%'`;
    };

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
            WHEN 판매처명 LIKE '메르세데스벤츠%' OR 품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN 판매처명 IN ('셰플러코리아 유한책임회사', '한백윤활유') OR 품목그룹1코드 = 'FU' THEN '훅스'
            WHEN 품목그룹1코드 = 'BL' THEN '블라자'
            WHEN 품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI') OR (품목그룹1코드 IS NULL AND (판매처명 = '테크젠 주식회사' OR 창고명 = '창원')) THEN 'Mobil'
            ELSE '기타(셸 외 타사제품)'
          END as category,
          CASE 
            WHEN 판매처명 LIKE '메르세데스벤츠%' OR 품목그룹1코드 = 'MB' THEN 0 
            ELSE CAST(REPLACE(합_계, ',', '') AS NUMERIC) 
          END as amount,
          CAST(REPLACE(중량, ',', '') AS NUMERIC) as weight,
          일자
        FROM sales
        WHERE ${getSalesBranchFilter()}
      )
      WHERE 일자 <= '${date}'
      GROUP BY category
    `;

    // 2. Collection Status Aggregation
    const collectionQuery = `
      SELECT 
        method,
        SUM(CASE WHEN date < '${date}' THEN amount ELSE 0 END) as prevTotal,
        SUM(CASE WHEN date = '${date}' THEN amount ELSE 0 END) as today,
        SUM(amount) as total
      FROM (
        SELECT 
          CASE 
            WHEN 계좌 LIKE '%카드%' OR 계좌 LIKE '%이니시스%' THEN '카드'
            ELSE 'Cash'
          END as method,
          CAST(REPLACE(금액, ',', '') AS NUMERIC) as amount,
          전표번호 as date
        FROM deposits
        WHERE 계정명 = '외상매출금' AND ${getDepBranchFilter()}
      )
      WHERE date <= '${date}'
      GROUP BY method
    `;

    // 3. Inventory Status Aggregation
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
        FROM purchases
        WHERE ${getPurchBranchFilter()}
        
        UNION ALL
        
        SELECT 
          CASE 
            WHEN 판매처명 LIKE '메르세데스벤츠%' OR 품목그룹1코드 = 'MB' THEN 'Mobil-MB'
            WHEN 판매처명 IN ('셰플러코리아 유한책임회사', '한백윤활유') OR 품목그룹1코드 = 'FU' THEN '훅스'
            WHEN 품목그룹1코드 = 'BL' THEN '블라자'
            WHEN 품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'AVI') OR (품목그룹1코드 IS NULL AND (판매처명 = '테크젠 주식회사' OR 창고명 = '창원')) THEN 'Mobil'
            ELSE '기타'
          END as category,
          CAST(REPLACE(중량, ',', '') AS NUMERIC) / 200.0 as amount,
          'out' as type,
          일자
        FROM sales
        WHERE ${getSalesBranchFilter()}
      )
      WHERE 일자 <= '${date}'
      GROUP BY category
    `;

    // 4. Flagship IL Metrics
    const flagshipQuery = `
      SELECT 
        SUM(CASE WHEN type = 'sales' THEN volume ELSE 0 END) as salesVol,
        SUM(CASE WHEN type = 'purchase' THEN volume ELSE 0 END) as purchaseVol
      FROM (
        SELECT CAST(REPLACE(중량, ',', '') AS NUMERIC) as volume, 'sales' as type
        FROM sales 
        WHERE 일자 = '${date}' AND 품목그룹3코드 = 'FLA' AND ${getSalesBranchFilter()}
        UNION ALL
        SELECT CAST(REPLACE(중량, ',', '') AS NUMERIC) as volume, 'purchase' as type
        FROM purchases 
        WHERE 일자 = '${date}' AND 품목그룹3코드 = 'FLA' AND ${getPurchBranchFilter()}
      )
    `;

    const [salesRes, collRes, invRes, flagRes] = await Promise.all([
      executeSQL(salesQuery),
      executeSQL(collectionQuery),
      executeSQL(inventoryQuery),
      executeSQL(flagshipQuery)
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

    const flagship = flagRes?.rows?.[0] || { salesVol: 0, purchaseVol: 0 };

    return NextResponse.json({
      success: true,
      salesData,
      collectionData,
      inventoryData,
      flagship: {
        salesVol: Number(flagship.salesVol) || 0,
        purchaseVol: Number(flagship.purchaseVol) || 0
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
