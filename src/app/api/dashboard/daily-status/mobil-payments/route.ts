import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * 모빌결제내역 — per DB_KNOWLEDGE §6 and egdesk.config (TABLES.table6).
 * Table: purchase_orders (발주서현황), exclusive source. Amount column: 합계.
 * Numeric aggregation per DB_KNOWLEDGE §3: REPLACE commas, CAST to NUMERIC.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const includeVat = searchParams.get('includeVat') === 'true';
    const divisor = includeVat ? '1.0' : '1.1';

    const query = `
      SELECT 
        branch,
        CASE 
          WHEN il >= auto AND il >= mbk THEN 'IL'
          WHEN auto >= il AND auto >= mbk THEN 'AUTO'
          WHEN mbk >= il AND mbk >= auto THEN 'MBK'
          ELSE ''
        END as industryGroup,
        il,
        auto,
        mbk,
        (il + auto + mbk) as total
      FROM (
        SELECT 
          COALESCE(w.창고명, p.창고코드, '기타') as branch,
          SUM(CASE WHEN p.품목그룹1코드 = 'IL' THEN CAST(REPLACE(REPLACE(CAST(COALESCE(p.합계,'0') AS TEXT), ',', ''), '₩', '') AS NUMERIC) / ${divisor} ELSE 0 END) as il,
          SUM(CASE WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN CAST(REPLACE(REPLACE(CAST(COALESCE(p.합계,'0') AS TEXT), ',', ''), '₩', '') AS NUMERIC) / ${divisor} ELSE 0 END) as auto,
          SUM(CASE WHEN p.품목그룹1코드 = 'MB' THEN CAST(REPLACE(REPLACE(CAST(COALESCE(p.합계,'0') AS TEXT), ',', ''), '₩', '') AS NUMERIC) / ${divisor} ELSE 0 END) as mbk
        FROM purchase_orders p
        LEFT JOIN warehouses w ON p.창고코드 = w.창고코드 OR p.창고코드 = CAST(w.창고코드 AS INTEGER)
        WHERE p.일자 = '${date}'
          AND p.품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'MB')
        GROUP BY branch
      )
      ORDER BY total DESC
    `;

    const resultData = await executeSQL(query);
    const data = resultData?.rows || [];

    return NextResponse.json({
      success: true,
      data,
      date
    });
  } catch (error: any) {
    console.error('Mobil Payments API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch mobil payment data'
    }, { status: 500 });
  }
}
