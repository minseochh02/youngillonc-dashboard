import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';
import { TABLE_NAMES } from '@/egdesk.config';

/**
 * API Endpoint to fetch Daily Mobil Payment Details (모빌결제내역)
 * Data source: 발주서현황 (purchase_orders)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-01-02';

    const tableName = TABLE_NAMES.table6;

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
          REPLACE(REPLACE(COALESCE(창고명, '기타'), '사업소', ''), '지사', '') as branch,
          SUM(CASE WHEN 품목그룹1코드 = 'IL' THEN 합계 ELSE 0 END) as il,
          SUM(CASE WHEN 품목그룹1코드 IN ('PVL', 'CVL') THEN 합계 ELSE 0 END) as auto,
          SUM(CASE WHEN 품목그룹1코드 IN ('MB', 'AVI') THEN 합계 ELSE 0 END) as mbk
        FROM ${tableName}
        WHERE 월_일 = '${date}'
          AND 거래처명 LIKE '%모빌%'
          AND (창고명 LIKE '%사업소%' OR 창고명 LIKE '%지사%' OR 창고명 = 'MB')
        GROUP BY REPLACE(REPLACE(COALESCE(창고명, '기타'), '사업소', ''), '지사', '')
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
