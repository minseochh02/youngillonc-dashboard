import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/** Keep date in YYYY-MM-DD format for ledger 일자 column */
function toLedgerDate(date: string): string {
  return date; // ledger.일자 uses YYYY-MM-DD format
}

/**
 * API Endpoint to fetch Daily Deposit and Withdrawal Status (입출금현황)
 * Inflow from deposits; 지출 내역 (payments) from ledger 대변금액 (credit = outflow).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-04';
    const ledgerDate = toLedgerDate(date);

    // 1. Inflow (입금) from ledger: 차변금액 = debit = inflow
    const depositQuery = `
      SELECT
        계정명 as type,
        부서명 as source,
        CAST(REPLACE(REPLACE(COALESCE(차변금액,'0'), ',', ''), ' ', '') AS NUMERIC) as amount,
        적요 as detail
      FROM ledger
      WHERE 일자 = '${ledgerDate}'
        AND TRIM(계정명) = '보통예금'
        AND (차변금액 IS NOT NULL AND 차변금액 != '' AND 차변금액 != '0')
      ORDER BY 3 DESC
    `;
    const depositResult = await executeSQL(depositQuery);
    const realDeposits = depositResult?.rows || [];

    // 2. 지출 내역 (payments) from ledger: 대변금액 = credit = outflow (DB_KNOWLEDGE §8.1)
    const withdrawalQuery = `
      SELECT
        계정명 as type,
        부서명 as source,
        CAST(REPLACE(REPLACE(COALESCE(대변금액,'0'), ',', ''), ' ', '') AS NUMERIC) as amount,
        적요 as detail
      FROM ledger
      WHERE 일자 = '${ledgerDate}'
        AND TRIM(계정명) = '보통예금'
        AND (대변금액 IS NOT NULL AND 대변금액 != '' AND 대변금액 != '0')
      ORDER BY 3 DESC
    `;
    const withdrawalResult = await executeSQL(withdrawalQuery);
    const withdrawals = withdrawalResult?.rows || [];

    return NextResponse.json({
      success: true,
      data: {
        deposits: realDeposits,
        withdrawals
      },
      date
    });
  } catch (error: any) {
    console.error('InOut API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch in-out status data'
    }, { status: 500 });
  }
}
