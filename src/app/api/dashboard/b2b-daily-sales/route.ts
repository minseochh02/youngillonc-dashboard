import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint for B2B Daily Purchase Analysis
 * Groups purchases by 사업소 → 담당자 → 구매처
 * Shows: 수량, 단가, 공급가
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const branch = searchParams.get('branch') || 'all'; // 'all', 'MB', '화성', '창원', etc.

    // Build branch filter
    let branchFilter = '';
    const branchMapping = `
      CASE
        WHEN c.거래처그룹1명 = '벤츠' THEN 'MB'
        WHEN c.거래처그룹1명 = '경남사업소' THEN '창원'
        WHEN c.거래처그룹1명 LIKE '%화성%' THEN '화성'
        WHEN c.거래처그룹1명 LIKE '%남부%' THEN '남부'
        WHEN c.거래처그룹1명 LIKE '%중부%' THEN '중부'
        WHEN c.거래처그룹1명 LIKE '%서부%' THEN '서부'
        WHEN c.거래처그룹1명 LIKE '%동부%' THEN '동부'
        WHEN c.거래처그룹1명 LIKE '%제주%' THEN '제주'
        WHEN c.거래처그룹1명 LIKE '%부산%' THEN '부산'
        ELSE REPLACE(REPLACE(COALESCE(c.거래처그룹1명, ''), '사업소', ''), '지사', '')
      END
    `;

    if (branch !== 'all') {
      branchFilter = `AND ${branchMapping} = '${branch}'`;
    }

    // Query purchases grouped by 사업소 → 담당자 → 구매처 → Items
    // Note: main purchases table is normalized, division tables are denormalized
    const purchaseQuery = `
      SELECT
        ${branchMapping} as branch,
        COALESCE(e.사원_담당_명, '미지정') as person_in_charge,
        COALESCE(vendor_client.거래처명, '미지정') as vendor,
        COALESCE(i.품목명, '미지정') as item_name,
        p.품목코드 as item_code,
        SUM(CAST(REPLACE(p.수량, ',', '') AS NUMERIC)) as quantity,
        SUM(CAST(REPLACE(p.공급가액, ',', '') AS NUMERIC)) as supply_amount,
        CASE
          WHEN SUM(CAST(REPLACE(p.수량, ',', '') AS NUMERIC)) > 0
          THEN SUM(CAST(REPLACE(p.공급가액, ',', '') AS NUMERIC)) / SUM(CAST(REPLACE(p.수량, ',', '') AS NUMERIC))
          ELSE 0
        END as unit_price
      FROM (
        SELECT 일자, 거래처코드, 품목코드, 수량, 공급가액 FROM purchases
        UNION ALL
        SELECT 일자, 거래처코드, 품목코드, 수량, 공급가액 FROM east_division_purchases
        UNION ALL
        SELECT 일자, 거래처코드, 품목코드, 수량, 공급가액 FROM west_division_purchases
        UNION ALL
        SELECT 일자, 거래처코드, 품목코드, 수량, 공급가액 FROM south_division_purchases
      ) p
      LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
      LEFT JOIN clients vendor_client ON p.거래처코드 = vendor_client.거래처코드
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE p.일자 = '${date}'
        ${branchFilter}
      GROUP BY
        branch,
        COALESCE(e.사원_담당_명, '미지정'),
        COALESCE(vendor_client.거래처명, '미지정'),
        COALESCE(i.품목명, '미지정'),
        p.품목코드
      ORDER BY branch, person_in_charge, vendor, item_name
    `;

    const result = await executeSQL(purchaseQuery);
    const data = result?.rows || [];

    // Format the data as a hierarchical structure for easier frontend rendering
    const formattedData = data.map((row: any) => ({
      branch: row.branch || '미분류',
      person_in_charge: row.person_in_charge || '미지정',
      vendor: row.vendor || '미지정',
      item_name: row.item_name || '미지정',
      item_code: row.item_code || '',
      quantity: Number(row.quantity) || 0,
      unit_price: Number(row.unit_price) || 0,
      supply_amount: Number(row.supply_amount) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
      date,
      branch
    });
  } catch (error) {
    console.error('B2B Daily Purchase Analysis Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
