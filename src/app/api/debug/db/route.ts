import { NextResponse } from 'next/server';
import { executeSQL, listTables } from '@/egdesk-helpers';

const BASE = '/t/vicky-cha4/p/youngillonc';

/**
 * Debug API: run queries against the DB. Table names per DB_KNOWLEDGE.md and egdesk.config.ts.
 *
 * CURL examples (dev server on port 3000; include base path):
 *
 *   # List tables (EGDesk user_data_list_tables)
 *   curl -s "http://localhost:3000${BASE}/api/debug/db?action=tables"
 *
 *   # Raw SELECT (query URL-encoded). DB_KNOWLEDGE §6: 발주서현황 = purchase_orders (egdesk.config TABLES.table6).
 *   curl -s -G "http://localhost:3000${BASE}/api/debug/db" \
 *     --data-urlencode "action=raw" \
 *     --data-urlencode "query=SELECT * FROM purchase_orders LIMIT 2"
 *
 *   # Ledger metadata (회사명, 기간, 계정별 보통예금 등)
 *   curl -s "http://localhost:3000${BASE}/api/debug/db?action=ledger_meta"
 *
 * GET ?action=tables  -> list table names
 * GET ?action=ledger&limit=N -> SELECT * FROM ledger LIMIT N (default 10)
 * GET ?action=ledger_meta -> distinct 회사명, 기간, 계정코드, 계정명, 계정코드_메타, 계정명_메타 + rows containing 보통예금
 * GET ?action=ledger_accounts -> distinct 계정명 from ledger (unique account names)
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

    if (action === 'ledger_meta') {
      const distinctQuery = `
        SELECT DISTINCT 회사명, 기간, 계정코드, 계정명, 계정코드_메타, 계정명_메타
        FROM ledger
        ORDER BY 계정명, 계정명_메타
        LIMIT 500
      `;
      const boguQuery = `
        SELECT id, 일자_no_, 회사명, 기간, 계정코드, 계정명, 계정코드_메타, 계정명_메타, 차변금액, 대변금액, 잔액
        FROM ledger
        WHERE (계정명 LIKE '%보통예금%' OR 계정명_메타 LIKE '%보통예금%' OR 계정코드_메타 LIKE '%보통예금%'
               OR 계정명 LIKE '%1039%' OR 계정명_메타 LIKE '%1039%' OR 계정코드_메타 LIKE '%1039%')
        ORDER BY id DESC
        LIMIT 50
      `;
      const [distinctRes, boguRes] = await Promise.all([
        executeSQL(distinctQuery),
        executeSQL(boguQuery),
      ]);
      const distinctRows = distinctRes?.rows ?? [];
      const boguRows = boguRes?.rows ?? [];
      return NextResponse.json({
        success: true,
        action: 'ledger_meta',
        distinct_meta_count: Array.isArray(distinctRows) ? distinctRows.length : 0,
        distinct_meta: distinctRows,
        보통예금_행_수: Array.isArray(boguRows) ? boguRows.length : 0,
        보통예금_행: boguRows,
        summary: boguRows.length > 0
          ? 'Found ledger rows with 보통예금 or 1039 in 계정명/계정명_메타/계정코드_메타.'
          : 'No ledger rows found with 보통예금 or 1039 in metadata. DB may be missing this for 보통예금 calculation.',
      });
    }

    if (action === 'ledger_accounts') {
      const query = `SELECT DISTINCT 계정명 FROM ledger ORDER BY 계정명`;
      const result = await executeSQL(query);
      const rows = result?.rows ?? [];
      return NextResponse.json({
        success: true,
        action: 'ledger_accounts',
        count: Array.isArray(rows) ? rows.length : 0,
        계정명_list: Array.isArray(rows) ? rows.map((r: any) => r?.계정명 ?? r).filter(Boolean) : [],
        raw: rows,
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
