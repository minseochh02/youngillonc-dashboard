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
 * Starting balances (이월잔액) from 계정별원장-거래처코드포함2.xlsx as of 2026/02/01.
 * Values are in KRW.
 */
const CARRIED_FORWARD_BALANCES: Record<string, number> = {
  /** 현금 시재금 (서울+창원+화성) - Feb 1st total */
  '현금 시재금': 2406000,
  /** 보통예금 (Feb 1st) */
  '보통예금': 1114812666,
  /** 외화예금 (Feb 1st totals by currency from image) */
  '외화예금_USD': 461029209, // 303,545,509 (current) + 157,483,700 (fixed)
  '외화예금_EUR': 62716576,  // 62,716,543 (current) + 33 (other)
  '외화예금_JPY': 4968937,
  '외화예금_GBP': 38,
  /** 받을어음 (Feb 1st total) */
  '받을어음': 1107221919,
  /** 외담대 (Baseline split from Feb 1st total - TBD) */
  '외담대': 1070000000,
  /** 전자어음 (Baseline split from Feb 1st total - TBD) */
  '전자어음': 37221919,
  /** 적금 (정기예.적금 Feb 1st) */
  '정기예.적금': 700000000,
  /** 보험 (장기금융상품 Feb 1st) */
  '장기금융상품': 284928000,
  /** CMA (기타단기금융상품 Feb 1st) */
  '기타단기금융상품': 3570587122,
  /** 퇴직연금운용자산 (Feb 1st) */
  '퇴직연금운용자산': 891061296,
  /** 단기차입금 (Feb 1st) */
  '단기차입금': 9300000000,
  /** 장기차입금 (Feb 1st) */
  '장기차입금': 0,
};

/** Foreign baseline amounts for display only (as of Feb 1st) */
const FOREIGN_BASELINES: Record<string, { amount: number, currency: string }> = {
  'USD': { amount: 313844, currency: 'USD' }, // 211,342 + 102,502
  'EUR': { amount: 41150, currency: 'EUR' },
  'JPY': { amount: 530620, currency: 'JPY' },
  'GBP': { amount: 0, currency: 'GBP' }
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

/** Account codes for ledger filtering (DB_KNOWLEDGE §8.2) */
const ACCOUNT_CODES = {
  CASH_HAND_ALL: ['1019', '1023', '1024', '1025'],
  ORDINARY_DEPOSIT: '1039',
  PENSION_ASSETS: '3350',
  PROMISSORY_NOTES: '1109',
  FOREIGN_DEPOSIT: '1040',
  SAVINGS: '1059',
  INSURANCE: '1774',
  CMA: '1063',
  LOANS: ['2515', '2519', '2539', '2549', '2559', '2629'], // Added common loan codes starting with 2
} as const;

/** Ledger row type (DB_KNOWLEDGE §8) */
type LedgerRow = { id: number; 일자: string; 계정코드: string; 거래처코드: string; 적요?: string; 차변금액: unknown; 대변금액: unknown };

/** Map bank account codes to currencies from bank_accounts table */
const CURRENCY_ACCOUNT_MAP: Record<string, string> = {
  // USD
  '3110161465600017': 'USD',
  '3110161465600017(10001': 'USD',
  // JPY
  '3110161465600017-1': 'JPY',
  '3110161465600024': 'JPY',
  // EUR
  '3110161465600017-2': 'EUR',
  '3110161465600031': 'EUR',
  // GBP
  '31101614656000173': 'GBP'
};

/** Extract currency from transaction metadata */
function detectCurrency(row: LedgerRow): string {
  // 1. Try mapping by bank account code (거래처코드 for bank entries)
  const codeMatch = CURRENCY_ACCOUNT_MAP[row.거래처코드];
  if (codeMatch) return codeMatch;

  // 2. Fallback to regex on 적요
  const name = row.적요 || '';
  const match = name.match(/\((USD|JPY|EUR|GBP)\)/i);
  return match ? match[1].toUpperCase() : 'USD'; // Default to USD if not found
}

function filterBy계정코드(rows: LedgerRow[], filter: string | string[]): LedgerRow[] {
  if (Array.isArray(filter)) {
    const set = new Set(filter);
    return rows.filter((r) => set.has(r.계정코드));
  }
  return rows.filter((r) => r.계정코드 === filter);
}

/**
 * API Endpoint to fetch Daily Funds Status (자금현황)
 * DB_KNOWLEDGE §8: ledger filtered by 계정코드. 받을어음 당일 flow from promissory_notes.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const ledgerDate = toLedgerDate(date);
    const ledgerPrevDate = toLedgerDate(prevDate(date));

    // 1. Ledger queries:
    //    - "flow" rows: only the selected/prev day (for 당일 inc/dec)
    //    - "balance as-of" rows: all rows up to selected/prev day (for running 잔액 calculation)
    //    Using 일자 column which stores dates in YYYY-MM-DD format
    const ledgerCurFlowQuery   = `SELECT id, 일자, 계정코드, 거래처코드, 적요, 차변금액, 대변금액 FROM ledger WHERE 일자 = '${ledgerDate}'`;
    const ledgerCurBalQuery    = `SELECT id, 일자, 계정코드, 거래처코드, 적요, 차변금액, 대변금액 FROM ledger WHERE 일자 <= '${ledgerDate}'`;
    const ledgerPrevFlowQuery  = `SELECT id, 일자, 계정코드, 거래처코드, 적요, 차변금액, 대변금액 FROM ledger WHERE 일자 = '${ledgerPrevDate}'`;
    const ledgerPrevBalQuery   = `SELECT id, 일자, 계정코드, 거래처코드, 적요, 차변금액, 대변금액 FROM ledger WHERE 일자 <= '${ledgerPrevDate}'`;

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
    function buildAccount(codeFilter: string | string[], accountKey?: string) {
      return {
        cur: aggregateLedgerDay(
          filterBy계정코드(curFlowRows, codeFilter),
          filterBy계정코드(curBalRows, codeFilter),
          accountKey
        ),
        prev: aggregateLedgerDay(
          filterBy계정코드(prevFlowRows, codeFilter),
          filterBy계정코드(prevBalRows, codeFilter),
          accountKey
        ),
      };
    }

    const cash = buildAccount(ACCOUNT_CODES.CASH_HAND_ALL as any, '현금 시재금');
    const bogu = buildAccount(ACCOUNT_CODES.ORDINARY_DEPOSIT, '보통예금');
    const pension = buildAccount(ACCOUNT_CODES.PENSION_ASSETS, '퇴직연금운용자산');

    // 2. 받을어음 logic (Split into 외담대 and 전자어음)
    const allNotesFlow = filterBy계정코드(curFlowRows, ACCOUNT_CODES.PROMISSORY_NOTES);
    const allNotesPrevFlow = filterBy계정코드(prevFlowRows, ACCOUNT_CODES.PROMISSORY_NOTES);
    const allNotesBal = filterBy계정코드(curBalRows, ACCOUNT_CODES.PROMISSORY_NOTES);
    const allNotesPrevBal = filterBy계정코드(prevBalRows, ACCOUNT_CODES.PROMISSORY_NOTES);

    const notesLedger = buildAccount(ACCOUNT_CODES.PROMISSORY_NOTES, '받을어음');

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
    const savings = buildAccount(ACCOUNT_CODES.SAVINGS, '정기예.적금');
    const insurance = buildAccount(ACCOUNT_CODES.INSURANCE, '장기금융상품');
    const cma = buildAccount(ACCOUNT_CODES.CMA, '기타단기금융상품');

    // 4. 받을어음 당일 flow (promissory_notes) as cross-check
    const notesQuery = `
      SELECT SUM(COALESCE(증가금액, 0)) as notesInc
      FROM promissory_notes WHERE 일자 = '${date}' AND 증감구분 = '증가'
    `;
    const notesResult = await executeSQL(notesQuery);
    const notesIncRaw = Number(notesResult?.rows?.[0]?.notesInc) || 0;
    const finalNotesInc = notesLedger.cur.inc || notesIncRaw;

    // 3. Foreign (외화): detect currencies from 외화예금 거래처명
    const foreignBaseRowsCur = filterBy계정코드(curFlowRows, ACCOUNT_CODES.FOREIGN_DEPOSIT);
    const foreignBaseRowsBal = filterBy계정코드(curBalRows, ACCOUNT_CODES.FOREIGN_DEPOSIT);
    const foreignBaseRowsPrevFlow = filterBy계정코드(prevFlowRows, ACCOUNT_CODES.FOREIGN_DEPOSIT);
    const foreignBaseRowsPrevBal = filterBy계정코드(prevBalRows, ACCOUNT_CODES.FOREIGN_DEPOSIT);

    // Find all currencies mentioned across all relevant rows, but always include USD, JPY, EUR, GBP
    const allForeignRows = [...foreignBaseRowsBal, ...foreignBaseRowsPrevBal];
    const detectedCurrencies = allForeignRows.map(detectCurrency);
    const currencies = Array.from(new Set(['USD', 'JPY', 'EUR', 'GBP', ...detectedCurrencies]));

    const foreignItems = currencies.map(ccy => {
      const cur = aggregateLedgerDay(
        foreignBaseRowsCur.filter(r => detectCurrency(r) === ccy),
        foreignBaseRowsBal.filter(r => detectCurrency(r) === ccy),
        `외화예금_${ccy}`
      );
      const prev = aggregateLedgerDay(
        foreignBaseRowsPrevFlow.filter(r => detectCurrency(r) === ccy),
        foreignBaseRowsPrevBal.filter(r => detectCurrency(r) === ccy),
        `외화예금_${ccy}`
      );

      // Estimate foreign amounts based on baseline rate
      const baseline = FOREIGN_BASELINES[ccy];
      const baselineKRW = CARRIED_FORWARD_BALANCES[`외화예금_${ccy}`] || 0;
      const rate = baseline && baseline.amount > 0 ? baselineKRW / baseline.amount : 0;
      
      const calcForeign = (krw: number) => rate > 0 ? krw / rate : 0;

      return {
        category: `외화예금 (${ccy})`,
        prev: prev.current,
        inc: cur.inc,
        dec: cur.dec,
        current: cur.current,
        currency: 'KRW',
        foreignPrev: Number(calcForeign(prev.current).toFixed(2)),
        foreignInc: Number(calcForeign(cur.inc).toFixed(2)),
        foreignDec: Number(calcForeign(cur.dec).toFixed(2)),
        foreignCurrent: Number(calcForeign(cur.current).toFixed(2)),
        foreignCurrency: ccy
      };
    });

    // 4. Loans / liabilities (차입금·부채): sum as (Credit - Debit) for positive display
    const loanItems = ACCOUNT_CODES.LOANS.map((code) => {
      const flow = filterBy계정코드(curFlowRows, code);
      const prevFlow = filterBy계정코드(prevFlowRows, code);
      const bal = filterBy계정코드(curBalRows, code);
      const prevBal = filterBy계정코드(prevBalRows, code);
      
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

      const cur = aggregateLoan(flow, bal, code === '2515' ? '단기차입금' : undefined);
      const prev = aggregateLoan(prevFlow, prevBal, code === '2515' ? '단기차입금' : undefined);

      // Map codes back to display names for UI
      const displayMap: Record<string, string> = {
        '2515': '단기차입금',
        '2519': '기타단기차입금',
        '2539': '미지급금',
        '2549': '미지급비용',
        '2559': '예수금',
        '2629': '장기차입금'
      };

      return {
        category: displayMap[code] || `차입금(${code})`,
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
