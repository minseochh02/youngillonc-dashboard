import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/** Keep date in YYYY-MM-DD format for ledger 일자 column */
function toLedgerDate(date: string): string {
  return date; // ledger.일자 uses YYYY-MM-DD format
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
 * Starting balances (이월잔액) from 계정별원장.csv as of 2026/01/01.
 * Values are in KRW.
 */
const CARRIED_FORWARD_BALANCES: Record<string, number> = {
  /** 현금 시재금 (서울+창원+화성) */
  '현금 시재금': 574760,
  /** 보통예금 (Line 41) */
  '보통예금': 1785378579,
  /** 외화예금 (Line 2766) */
  '외화예금': 527217883,
  /** 받을어음 (Line 5868) */
  '받을어음': 1192789752,
  /** 외담대 (Implied from Feb 26 verified 전잔) */
  '외담대': 1155434382,
  /** 전자어음 (Implied from total - 외담대) */
  '전자어음': 37355370,
  /** 적금 (정기예.적금 Line 2779) */
  '정기예.적금': 700000000,
  /** 보험 (장기금융상품 Line 7375) */
  '장기금융상품': 278484800,
  /** CMA (기타단기금융상품 Line 2781) */
  '기타단기금융상품': 3570587122,
  /** 퇴직연금운용자산 (From 1iKvrLravEbuFmPY.xlsx Line 4716) */
  '퇴직연금운용자산': 891061296,
  /** 단기차입금 (Line 7598) */
  '단기차입금': 9300000000,
  /** 장기차입금 (Not found in CSV, default to 0) */
  '장기차입금': 0,
};

/**
 * From ledger rows (already date-filtered): calculate current balance by cumulative sum of (debit - credit)
 * starting from the hardcoded 이월잔액.
 */
function aggregateLedgerDay(
  flowRows: LedgerRow[],  // rows for the specific day (inc/dec)
  balanceRows: LedgerRow[], // rows up-to-date for balance
  accountKey?: string      // key into CARRIED_FORWARD_BALANCES
) {
  let currentBalance = accountKey ? (CARRIED_FORWARD_BALANCES[accountKey] || 0) : 0;
  
  for (const r of balanceRows) {
    currentBalance += parseAmount(r.차변금액) - parseAmount(r.대변금액);
  }
  
  let inc = 0;
  let dec = 0;
  for (const r of flowRows) {
    inc += parseAmount(r.차변금액);
    dec += parseAmount(r.대변금액);
  }
  
  return { current: currentBalance, inc, dec };
}

/** Ledger row type (DB_KNOWLEDGE §8) */
type LedgerRow = { id: number; 일자: string; 계정명: string; 적요?: string; 차변금액: unknown; 대변금액: unknown };

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
  /** Other specific categories (Ledger Analysis Guide) */
  savings: '정기예.적금',
  insurance: '장기금융상품',
  cma: '기타단기금융상품',
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

/** Extract currency from 적요 (e.g. "기업-외화(USD)" -> "USD") */
function detectCurrency(row: LedgerRow): string {
  const name = row.적요 || '';
  const match = name.match(/\((USD|JPY|EUR|GBP)\)/i);
  return match ? match[1].toUpperCase() : 'USD'; // Default to USD if not found
}

function filterBy계정명(rows: LedgerRow[], filter: string | { prefix?: string; exact?: string[] }): LedgerRow[] {
  const normalize = (s: string) => (s ?? '').trim();
  if (typeof filter === 'string') {
    return rows.filter((r) => normalize(r.계정명).startsWith(filter));
  }
  if (filter.prefix) {
    return rows.filter((r) => normalize(r.계정명).startsWith(filter.prefix!));
  }
  if (filter.exact?.length) {
    const set = new Set(filter.exact.map(s => s.trim()));
    return rows.filter((r) => set.has(normalize(r.계정명)));
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
    //    - "balance as-of" rows: all rows up to selected/prev day (for running 잔액 calculation)
    //    Using 일자 column which stores dates in YYYY-MM-DD format
    const ledgerCurFlowQuery   = `SELECT id, 일자, 계정명, 적요, 차변금액, 대변금액 FROM ledger WHERE 일자 = '${ledgerDate}'`;
    const ledgerCurBalQuery    = `SELECT id, 일자, 계정명, 적요, 차변금액, 대변금액 FROM ledger WHERE 일자 <= '${ledgerDate}'`;
    const ledgerPrevFlowQuery  = `SELECT id, 일자, 계정명, 적요, 차변금액, 대변금액 FROM ledger WHERE 일자 = '${ledgerPrevDate}'`;
    const ledgerPrevBalQuery   = `SELECT id, 일자, 계정명, 적요, 차변금액, 대변금액 FROM ledger WHERE 일자 <= '${ledgerPrevDate}'`;

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
    function buildAccount(filter: string | { prefix?: string; exact?: string[] }, accountKey?: string) {
      return {
        cur: aggregateLedgerDay(
          filterBy계정명(curFlowRows, filter),
          filterBy계정명(curBalRows, filter),
          accountKey
        ),
        prev: aggregateLedgerDay(
          filterBy계정명(prevFlowRows, filter),
          filterBy계정명(prevBalRows, filter),
          accountKey
        ),
      };
    }

    const cash = buildAccount(FUNDS_계정명.cashPrefix, '현금 시재금');
    const bogu = buildAccount({ exact: [FUNDS_계정명.보통예금] }, '보통예금');
    const pension = buildAccount({ exact: [FUNDS_계정명.퇴직연금] }, '퇴직연금운용자산');

    // 2. 받을어음 logic (Split into 외담대 and 전자어음)
    const allNotesFlow = filterBy계정명(curFlowRows, { exact: [FUNDS_계정명.받을어음] });
    const allNotesPrevFlow = filterBy계정명(prevFlowRows, { exact: [FUNDS_계정명.받을어음] });
    const allNotesBal = filterBy계정명(curBalRows, { exact: [FUNDS_계정명.받을어음] });
    const allNotesPrevBal = filterBy계정명(prevBalRows, { exact: [FUNDS_계정명.받을어음] });

    const notesLedger = buildAccount({ exact: [FUNDS_계정명.받을어음] }, '받을어음');

    // 외담대 (Accounts Receivable Secured Loans)
    // Inc: 차변금액 for "매출채권", Dec: 대변금액 for "어음만기"
    const oedamFlow = {
      inc: allNotesFlow.filter(r => (r.적요 || '').includes('매출채권')).reduce((s, r) => s + parseAmount(r.차변금액), 0),
      dec: allNotesFlow.filter(r => (r.적요 || '').includes('어음만기')).reduce((s, r) => s + parseAmount(r.대변금액), 0),
    };
    const oedamPrevFlow = {
      inc: allNotesPrevFlow.filter(r => (r.적요 || '').includes('매출채권')).reduce((s, r) => s + parseAmount(r.차변금액), 0),
      dec: allNotesPrevFlow.filter(r => (r.적요 || '').includes('어음만기')).reduce((s, r) => s + parseAmount(r.대변금액), 0),
    };

    // Since we need sub-filtered balance, we must calculate it manually from all rows or use guide's logic:
    // "전자어음 balance is the portion NOT tagged as 매출채권"
    const calculateOedamBalance = (rows: LedgerRow[]) => {
      let bal = CARRIED_FORWARD_BALANCES['외담대'] || 0;
      for (const r of rows) {
        if ((r.적요 || '').includes('매출채권')) bal += parseAmount(r.차변금액);
        if ((r.적요 || '').includes('어음만기')) bal -= parseAmount(r.대변금액);
      }
      return bal;
    };

    const oedamBalance = calculateOedamBalance(allNotesBal);
    const oedamPrevBalance = calculateOedamBalance(allNotesPrevBal);

    // 전자어음 (Electronic Notes)
    const eNoteFlow = {
      inc: allNotesFlow.filter(r => (r.적요 || '').includes('전자어음')).reduce((s, r) => s + parseAmount(r.차변금액), 0),
      dec: allNotesFlow.reduce((s, r) => s + parseAmount(r.대변금액), 0) - oedamFlow.dec,
    };
    const eNotePrevFlow = {
      inc: allNotesPrevFlow.filter(r => (r.적요 || '').includes('전자어음')).reduce((s, r) => s + parseAmount(r.차변금액), 0),
      dec: allNotesPrevFlow.reduce((s, r) => s + parseAmount(r.대변금액), 0) - oedamPrevFlow.dec,
    };

    // 전자어음 balance = Total Balance - 외담대 Balance
    const eNoteBalance = notesLedger.cur.current - oedamBalance;
    const eNotePrevBalance = notesLedger.prev.current - oedamPrevBalance;

    // 3. Other Specific Categories (적금, 보험, CMA)
    const savings = buildAccount({ exact: [FUNDS_계정명.savings] }, '정기예.적금');
    const insurance = buildAccount({ exact: [FUNDS_계정명.insurance] }, '장기금융상품');
    const cma = buildAccount({ exact: [FUNDS_계정명.cma] }, '기타단기금융상품');

    // 4. 받을어음 당일 flow (promissory_notes) as cross-check
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
        foreignBaseRowsBal.filter(r => detectCurrency(r) === ccy),
        ccy === 'USD' ? '외화예금' : undefined // Assuming USD is the primary foreign account for now
      );
      const prev = aggregateLedgerDay(
        foreignBaseRowsPrevFlow.filter(r => detectCurrency(r) === ccy),
        foreignBaseRowsPrevBal.filter(r => detectCurrency(r) === ccy),
        ccy === 'USD' ? '외화예금' : undefined
      );
      return {
        category: `외화예금 (${ccy})`,
        prev: prev.current,
        inc: cur.inc,
        dec: cur.dec,
        current: cur.current,
        currency: 'KRW', // Ledger stores the converted KRW value
      };
    }).filter(item => {
      // Hide JPY, EUR, GBP if all values are zero as requested by user
      const isTargetCcy = item.category.includes('JPY') || item.category.includes('EUR') || item.category.includes('GBP');
      if (isTargetCcy) {
        return item.prev !== 0 || item.inc !== 0 || item.dec !== 0 || item.current !== 0;
      }
      return true;
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

    // 4. Loans / liabilities (차입금·부채): sum as (Credit - Debit) for positive display
    const loanItems = FUNDS_계정명.loans.map((계정명) => {
      const flow = filterBy계정명(curFlowRows, { exact: [계정명] });
      const prevFlow = filterBy계정명(prevFlowRows, { exact: [계정명] });
      const bal = filterBy계정명(curBalRows, { exact: [계정명] });
      const prevBal = filterBy계정명(prevBalRows, { exact: [계정명] });
      
      const aggregateLoan = (fRows: LedgerRow[], bRows: LedgerRow[], accountKey?: string) => {
        let balance = accountKey ? (CARRIED_FORWARD_BALANCES[accountKey] || 0) : 0;
        for (const r of bRows) {
          balance += parseAmount(r.대변금액) - parseAmount(r.차변금액);
        }
        let inc = 0;
        let dec = 0;
        for (const r of fRows) {
          inc += parseAmount(r.대변금액);
          dec += parseAmount(r.차변금액);
        }
        return { current: balance, inc, dec };
      };

      const cur = aggregateLoan(flow, bal, 계정명);
      const prev = aggregateLoan(prevFlow, prevBal, 계정명);

      return {
        category: 계정명,
        prev: prev.current,
        inc: cur.inc,
        dec: cur.dec,
        current: cur.current,
        currency: 'KRW',
      };
    });

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
          prev: savings.prev.current,
          inc: savings.cur.inc,
          dec: savings.cur.dec,
          current: savings.cur.current,
          currency: 'KRW',
        },
        {
          category: "보험 (장기금융상품)",
          prev: insurance.prev.current,
          inc: insurance.cur.inc,
          dec: insurance.cur.dec,
          current: insurance.cur.current,
          currency: 'KRW',
        },
        {
          category: "CMA",
          prev: cma.prev.current,
          inc: cma.cur.inc,
          dec: cma.cur.dec,
          current: cma.cur.current,
          currency: 'KRW',
        },
        {
          category: "퇴직연금운용자산",
          prev: pension.prev.current,
          inc: pension.cur.inc,
          dec: pension.cur.dec,
          current: pension.cur.current,
          currency: 'KRW',
        },
        {
          category: "외담대",
          prev: oedamPrevBalance,
          inc: oedamFlow.inc,
          dec: oedamFlow.dec,
          current: oedamBalance,
          currency: 'KRW',
        },
        {
          category: "전자어음",
          prev: eNotePrevBalance,
          inc: eNoteFlow.inc,
          dec: eNoteFlow.dec,
          current: eNoteBalance,
          currency: 'KRW',
        },
        {
          category: "받을어음 (합계)",
          prev: notesLedger.prev.current,
          inc: finalNotesInc, // still cross-checked with promissory_notes for inc
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
