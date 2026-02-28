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

/**
 * From ledger rows (already date-filtered): latest 잔액 per 계정명 (max id) for balance,
 * and sum of 차변/대변 for daily flow.
 * NOTE: for balance we need rows fetched with "as-of" semantics (all rows up to the date),
 * not just today's rows. Pass balanceRows separately when calling for that purpose.
 */
function aggregateLedgerDay(
  flowRows: LedgerRow[],  // rows for the specific day (inc/dec)
  balanceRows?: LedgerRow[] // rows up-to-date for balance; defaults to flowRows if omitted
) {
  const bRows = balanceRows ?? flowRows;
  const byAccount = new Map<string, { id: number; 잔액: number }>();
  for (const r of bRows) {
    const acc = r.계정명 ?? '기타';
    const existing = byAccount.get(acc);
    if (!existing || r.id > existing.id) {
      byAccount.set(acc, { id: r.id, 잔액: parseAmount(r.잔액) });
    }
  }
  let inc = 0;
  let dec = 0;
  for (const r of flowRows) {
    inc += parseAmount(r.차변금액);
    dec += parseAmount(r.대변금액);
  }
  const current = Array.from(byAccount.values()).reduce((s, x) => s + x.잔액, 0);
  return { current, inc, dec };
}

/** Ledger row type (DB_KNOWLEDGE §8) */
type LedgerRow = { id: number; 계정명: string; 거래처명?: string; 차변금액: unknown; 대변금액: unknown; 잔액: unknown };

/** Funds-relevant 계정명 mapping (DB_KNOWLEDGE §8.2). Cash uses prefix; others exact match. */
const FUNDS_계정명 = {
  /** 현금 시재금: prefix match (현금 시재금-서울, 현금 시재금-창원, 현금 시재금-화성) */
  cashPrefix: '현금 시재금',
  /** KRW deposit */
  보통예금: '보통예금',
  /** 퇴직연금 */
  퇴직연금: '퇴직연금운용자산',
  /** 받을어음: exact match */
  받을어음: '받을어음',
  /** Foreign-currency / 외화: split by currency marker in 거래처명 */
  foreignBase: '외화예금',
  foreignExtra: '외환차익',
  /** Liabilities / 차입금·부채: exact 계정명 list */
  loans: [
    '단기차입금',
    '장기차입금',
    // '미지급금',
    // '미지급비용',
    // '외상매입금',
    // '예수금',
    // '부가세예수금'
  ] as const,
} as const;

/** Extract currency from 거래처명 (e.g. "기업-외화(USD)" -> "USD") */
function detectCurrency(row: LedgerRow): string {
  const name = row.거래처명 || '';
  const match = name.match(/\((USD|JPY|EUR|GBP)\)/i);
  return match ? match[1].toUpperCase() : 'USD'; // Default to USD if not found
}

function filterBy계정명(rows: LedgerRow[], filter: string | { prefix?: string; exact?: string[] }): LedgerRow[] {
  if (typeof filter === 'string') {
    return rows.filter((r) => (r.계정명 ?? '').startsWith(filter));
  }
  if (filter.prefix) {
    return rows.filter((r) => (r.계정명 ?? '').startsWith(filter.prefix!));
  }
  if (filter.exact?.length) {
    const set = new Set(filter.exact);
    return rows.filter((r) => set.has(r.계정명 ?? ''));
  }
  return [];
}

/**
 * API Endpoint to fetch Daily Funds Status (자금현황)
 * DB_KNOWLEDGE §8: ledger filtered by 계정명 (현금 시재금%, 보통예금, 외화예금). 받을어음 당일 flow from promissory_notes.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-04';
    const ledgerDate = toLedgerDate(date);
    const ledgerPrevDate = toLedgerDate(prevDate(date));

    // 1. Ledger queries:
    //    - "flow" rows: only the selected/prev day (for 당일 inc/dec)
    //    - "balance as-of" rows: all rows up to selected/prev day (for running 잔액)
    //    '~' (ASCII 126) is greater than ' ' (32) so LIKE 'YYYY/MM/DD~%' won't match;
    //    using <= 'YYYY/MM/DD~' captures all rows whose date part is <= that date.
    const ledgerCurFlowQuery   = `SELECT id, 계정명, 차변금액, 대변금액, 잔액 FROM ledger WHERE 일자_no_ LIKE '${ledgerDate}%'`;
    const ledgerCurBalQuery    = `SELECT id, 계정명, 잔액 FROM ledger WHERE 일자_no_ <= '${ledgerDate}~'`;
    const ledgerPrevFlowQuery  = `SELECT id, 계정명, 차변금액, 대변금액, 잔액 FROM ledger WHERE 일자_no_ LIKE '${ledgerPrevDate}%'`;
    const ledgerPrevBalQuery   = `SELECT id, 계정명, 잔액 FROM ledger WHERE 일자_no_ <= '${ledgerPrevDate}~'`;

    const [curFlowRes, curBalRes, prevFlowRes, prevBalRes] = await Promise.all([
      executeSQL(ledgerCurFlowQuery),
      executeSQL(ledgerCurBalQuery),
      executeSQL(ledgerPrevFlowQuery),
      executeSQL(ledgerPrevBalQuery),
    ]);

    const curFlowRows = (curFlowRes?.rows ?? []) as LedgerRow[];
    const curBalRows  = (curBalRes?.rows  ?? []) as LedgerRow[];
    const prevFlowRows = (prevFlowRes?.rows ?? []) as LedgerRow[];
    const prevBalRows  = (prevBalRes?.rows  ?? []) as LedgerRow[];

    // Helper: build aggregated account for one category
    function buildAccount(filter: string | { prefix?: string; exact?: string[] }) {
      return {
        cur: aggregateLedgerDay(
          filterBy계정명(curFlowRows, filter),
          filterBy계정명(curBalRows, filter)
        ),
        prev: aggregateLedgerDay(
          filterBy계정명(prevFlowRows, filter),
          filterBy계정명(prevBalRows, filter)
        ),
      };
    }

    const cash = buildAccount(FUNDS_계정명.cashPrefix);
    const bogu = buildAccount({ exact: [FUNDS_계정명.보통예금] });
    const notesLedger = buildAccount({ exact: [FUNDS_계정명.받을어음] });
    const pension = buildAccount({ exact: [FUNDS_계정명.퇴직연금] });

    // 2. 받을어음 당일 flow (promissory_notes) as cross-check
    const notesQuery = `
      SELECT SUM(CAST(REPLACE(COALESCE(증가금액,'0'), ',', '') AS NUMERIC)) as notesInc
      FROM promissory_notes WHERE 일자 = '${date}' AND 증감구분 = '증가'
    `;
    const notesResult = await executeSQL(notesQuery);
    const notesIncRaw = Number(notesResult?.rows?.[0]?.notesInc) || 0;
    const finalNotesInc = notesLedger.cur.inc || notesIncRaw;

    // 3. Foreign (외화): detect currencies from 외화예금 거래처명
    const foreignBaseRowsCur = filterBy계정명(curFlowRows, { exact: [FUNDS_계정명.foreignBase] });
    const foreignBaseRowsBal = filterBy계정명(curBalRows, { exact: [FUNDS_계정명.foreignBase] });
    const foreignBaseRowsPrevFlow = filterBy계정명(prevFlowRows, { exact: [FUNDS_계정명.foreignBase] });
    const foreignBaseRowsPrevBal = filterBy계정명(prevBalRows, { exact: [FUNDS_계정명.foreignBase] });

    // Find all currencies mentioned across all relevant rows, but always include USD, JPY, EUR, GBP
    const allForeignRows = [...foreignBaseRowsBal, ...foreignBaseRowsPrevBal];
    const detectedCurrencies = allForeignRows.map(detectCurrency);
    const currencies = Array.from(new Set(['USD', 'JPY', 'EUR', 'GBP', ...detectedCurrencies]));

    const foreignItems = currencies.map(ccy => {
      const cur = aggregateLedgerDay(
        foreignBaseRowsCur.filter(r => detectCurrency(r) === ccy),
        foreignBaseRowsBal.filter(r => detectCurrency(r) === ccy)
      );
      const prev = aggregateLedgerDay(
        foreignBaseRowsPrevFlow.filter(r => detectCurrency(r) === ccy),
        foreignBaseRowsPrevBal.filter(r => detectCurrency(r) === ccy)
      );
      return {
        category: `외화예금 (${ccy})`,
        prev: prev.current,
        inc: cur.inc,
        dec: cur.dec,
        current: cur.current,
        currency: 'KRW', // Ledger stores the converted KRW value
      };
    });

    // Add 외환차익 as a separate item if it has any non-zero values
    const extraCcy = buildAccount({ exact: [FUNDS_계정명.foreignExtra] });
    if (extraCcy.cur.current !== 0 || extraCcy.cur.inc !== 0 || extraCcy.cur.dec !== 0) {
      foreignItems.push({
        category: FUNDS_계정명.foreignExtra,
        prev: extraCcy.prev.current,
        inc: extraCcy.cur.inc,
        dec: extraCcy.cur.dec,
        current: extraCcy.cur.current,
        currency: 'KRW',
      });
    }

    // 4. Loans / liabilities (차입금·부채): one item per 계정명, always include
    const loanItems = FUNDS_계정명.loans.map((계정명) => {
      const { cur, prev } = buildAccount({ exact: [계정명] });
      return {
        category: 계정명,
        prev: prev.current,
        inc: cur.inc,
        dec: cur.dec,
        current: cur.current,
        currency: 'KRW',
      };
    });

    const longTermFinance = buildAccount({ exact: ['장기금융상품'] });

    const data = {
      krw: [
        {
          category: "현금 시재금",
          prev: cash.prev.current,
          inc: cash.cur.inc,
          dec: cash.cur.dec,
          current: cash.cur.current,
          currency: 'KRW',
        },
        {
          category: "보통예금",
          prev: bogu.prev.current,
          inc: bogu.cur.inc,
          dec: bogu.cur.dec,
          current: bogu.cur.current,
          currency: 'KRW',
        },
        {
          category: "적금",
          prev: longTermFinance.prev.current,
          inc: longTermFinance.cur.inc,
          dec: longTermFinance.cur.dec,
          current: longTermFinance.cur.current,
          currency: 'KRW',
        },
        /*
        {
          category: "보험",
          prev: 0, inc: 0, dec: 0, current: 0,
          currency: 'KRW',
        },
        {
          category: "CMA (미래에셋,대신증권)",
          prev: 0, inc: 0, dec: 0, current: 0,
          currency: 'KRW',
        },
        */
        {
          category: "퇴직연금운용자산",
          prev: pension.prev.current,
          inc: pension.cur.inc,
          dec: pension.cur.dec,
          current: pension.cur.current,
          currency: 'KRW',
        },
        {
          category: "받을어음",
          prev: notesLedger.prev.current,
          inc: finalNotesInc,
          dec: notesLedger.cur.dec,
          current: notesLedger.cur.current,
          currency: 'KRW',
        },
      ],
      foreign: foreignItems,
      loans: loanItems,
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
