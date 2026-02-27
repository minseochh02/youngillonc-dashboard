import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/** YYYY-MM-DD → YYYY/MM/DD for ledger 일자_no_ (DB_KNOWLEDGE §8.1) */
function toLedgerDate(date: string): string {
  return date.replace(/-/g, '/');
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

    // 1. Inflow from deposits
    const depositQuery = `
      SELECT 
        계정명 as type,
        거래처명 as source,
        CAST(REPLACE(COALESCE(금액,'0'), ',', '') AS NUMERIC) as amount,
        계좌 as detail
      FROM deposits
      WHERE 전표번호 = '${date}'
      ORDER BY amount DESC
    `;
    const depositResult = await executeSQL(depositQuery);
    const realDeposits = depositResult?.rows || [];

    // 2. 지출 내역 (payments) from ledger: 대변금액 = credit = outflow (DB_KNOWLEDGE §8.1)
    const withdrawalQuery = `
      SELECT 
        계정명 as type,
        거래처명 as source,
        CAST(REPLACE(REPLACE(COALESCE(대변금액,'0'), ',', ''), ' ', '') AS NUMERIC) as amount,
        적요 as detail
      FROM ledger
      WHERE 일자_no_ LIKE '${ledgerDate}%'
        AND CAST(REPLACE(REPLACE(COALESCE(대변금액,'0'), ',', ''), ' ', '') AS NUMERIC) > 0
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
