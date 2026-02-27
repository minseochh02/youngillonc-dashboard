import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/** YYYY-MM-DD → YYYY/MM/DD for ledger 일자_no_ (e.g. 2026/01/05 -29) */
function toLedgerDate(date: string): string {
  return date.replace(/-/g, '/');
}

/** Previous day in YYYY-MM-DD */
function prevDate(date: string): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Parse amount string (DB_KNOWLEDGE §3: comma cleaning) */
function parseAmount(v: unknown): number {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/,/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** From ledger rows for one day: latest 잔액 per 계정명 (max id), and sum of 차변/대변 */
function aggregateLedgerDay(rows: { id: number; 계정명: string; 차변금액: unknown; 대변금액: unknown; 잔액: unknown }[]) {
  const byAccount = new Map<string, { id: number; 잔액: number }>();
  let inc = 0;
  let dec = 0;
  for (const r of rows) {
    const acc = r.계정명 ?? '기타';
    const existing = byAccount.get(acc);
    if (!existing || r.id > existing.id) {
      byAccount.set(acc, { id: r.id, 잔액: parseAmount(r.잔액) });
    }
    inc += parseAmount(r.차변금액);
    dec += parseAmount(r.대변금액);
  }
  const current = Array.from(byAccount.values()).reduce((s, x) => s + x.잔액, 0);
  return { current, inc, dec };
}

/**
 * API Endpoint to fetch Daily Funds Status (자금현황)
 * Sources: ledger (현금 시재금), deposits (외상매출금), promissory_notes. No expenses table.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-04';
    const ledgerDate = toLedgerDate(date);
    const ledgerPrevDate = toLedgerDate(prevDate(date));

    // 1. Ledger: 현금 시재금 (balance and daily flow). 일자_no_ format: YYYY/MM/DD -n
    const ledgerCurQuery = `SELECT id, 계정명, 차변금액, 대변금액, 잔액 FROM ledger WHERE 일자_no_ LIKE '${ledgerDate}%'`;
    const ledgerPrevQuery = `SELECT id, 계정명, 차변금액, 대변금액, 잔액 FROM ledger WHERE 일자_no_ LIKE '${ledgerPrevDate}%'`;

    const [ledgerCurRes, ledgerPrevRes] = await Promise.all([
      executeSQL(ledgerCurQuery),
      executeSQL(ledgerPrevQuery),
    ]);

    const curRows = (ledgerCurRes?.rows ?? []) as { id: number; 계정명: string; 차변금액: unknown; 대변금액: unknown; 잔액: unknown }[];
    const prevRows = (ledgerPrevRes?.rows ?? []) as { id: number; 계정명: string; 차변금액: unknown; 대변금액: unknown; 잔액: unknown }[];

    const curLedger = aggregateLedgerDay(curRows);
    const prevLedger = aggregateLedgerDay(prevRows);

    // 2. Deposits (외상매출금), promissory_notes. No expenses table.
    const krwQuery = `
      SELECT 
        (SELECT SUM(CAST(REPLACE(COALESCE(금액,'0'), ',', '') AS NUMERIC)) FROM deposits WHERE 전표번호 = '${date}' AND 계정명 = '외상매출금') as ordinaryInc,
        (SELECT SUM(COALESCE(증가금액,0)) FROM promissory_notes WHERE 일자 = '${date}' AND 증감구분 = '증가') as notesInc
    `;
    const krwResult = await executeSQL(krwQuery);
    const flow = krwResult?.rows?.[0] || { ordinaryInc: 0, notesInc: 0 };

    const ordinaryInc = Number(flow.ordinaryInc) || 0;
    const notesInc = Number(flow.notesInc) || 0;

    const data = {
      krw: [
        {
          category: "현금 시재금",
          prev: prevLedger.current,
          inc: curLedger.inc,
          dec: curLedger.dec,
          current: curLedger.current,
        },
        {
          category: "보통예금 (당일)",
          prev: 0,
          inc: ordinaryInc,
          dec: 0,
          current: ordinaryInc,
        },
        {
          category: "받을어음 (당일)",
          prev: 0,
          inc: notesInc,
          dec: 0,
          current: notesInc,
        },
      ],
      foreign: [],
      loans: [],
    };

    return NextResponse.json({
      success: true,
      data,
      date
    });
  } catch (error: any) {
    console.error('Funds API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch funds status data'
    }, { status: 500 });
  }
}
