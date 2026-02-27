import { NextResponse } from 'next/server';
import { executeSQL, listTables } from '@/egdesk-helpers';

/**
 * Debug API: run queries against the DB. Table names per DB_KNOWLEDGE.md and egdesk.config.ts.
 *
 * CURL examples (dev server on port 3000; use apiFetch basePath in EGDesk per EGDESK-README.md):
 *
 *   # List tables (EGDesk user_data_list_tables)
 *   curl -s "http://localhost:3000/api/debug/db?action=tables"
 *
 *   # Raw SELECT (query URL-encoded). DB_KNOWLEDGE §6: 발주서현황 = purchase_orders (egdesk.config TABLES.table6).
 *   curl -s -G "http://localhost:3000/api/debug/db" \
 *     --data-urlencode "action=raw" \
 *     --data-urlencode "query=SELECT * FROM purchase_orders LIMIT 2"
 *
 * GET ?action=tables  -> list table names
 * GET ?action=ledger&limit=N -> SELECT * FROM ledger LIMIT N (default 10)
 * GET ?action=mobil&date=YYYY-MM-DD -> same query as mobil-payments (purchase_orders per DB_KNOWLEDGE §6)
 * GET ?action=raw&query=URL_ENCODED_SELECT -> run raw SELECT
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'tables';
    const date = searchParams.get('date') || '2026-02-04';
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 100);

    if (action === 'tables') {
      const tables = await listTables();
      return NextResponse.json({ success: true, action: 'tables', data: tables });
    }

    if (action === 'ledger') {
      const query = `SELECT * FROM ledger LIMIT ${limit}`;
      const result = await executeSQL(query);
      return NextResponse.json({
        success: true,
        action: 'ledger',
        limit,
        data: result?.rows ?? result,
        raw: result,
      });
    }

    if (action === 'mobil') {
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
          FROM purchase_orders
          WHERE 월_일 = '${date}'
            AND 거래처명 LIKE '%모빌%'
            AND (창고명 LIKE '%사업소%' OR 창고명 LIKE '%지사%' OR 창고명 = 'MB')
          GROUP BY REPLACE(REPLACE(COALESCE(창고명, '기타'), '사업소', ''), '지사', '')
        )
        ORDER BY total DESC
      `;
      const result = await executeSQL(query);
      return NextResponse.json({
        success: true,
        action: 'mobil',
        date,
        data: result?.rows || [],
        raw: result,
      });
    }

    if (action === 'raw') {
      const encoded = searchParams.get('query');
      if (!encoded) {
        return NextResponse.json(
          { success: false, error: 'Missing query param (URL-encoded SELECT)' },
          { status: 400 }
        );
      }
      const query = decodeURIComponent(encoded);
      if (!/^\s*SELECT\s+/i.test(query)) {
        return NextResponse.json(
          { success: false, error: 'Only SELECT queries allowed' },
          { status: 400 }
        );
      }
      const result = await executeSQL(query);
      return NextResponse.json({
        success: true,
        action: 'raw',
        data: result?.rows ?? result,
        raw: result,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action. Use action=tables|ledger|mobil|raw' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Debug DB API Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
