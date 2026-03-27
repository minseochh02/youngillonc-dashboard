import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/** Keep date in YYYY-MM-DD format for ledger 일자 column */
function toLedgerDate(date: string): string {
  return date; // ledger.일자 uses YYYY-MM-DD format
}

/**
 * API Endpoint to fetch Daily Deposit and Withdrawal Status (입출금현황)
 * All flow data from ledger table (Account 1039: Ordinary Deposits).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const ledgerDate = toLedgerDate(date);

    // 1. Inflow (입금) from ledger: 차변금액 = debit = inflow
    const inflowQuery = `
      SELECT
        '보통예금' as type,
        COALESCE(c.거래처명, ba.계좌명, l.거래처코드) as source,
        COALESCE(l.차변금액, 0) as amount,
        l.적요 as detail
      FROM ledger l
      LEFT JOIN bank_accounts ba ON l.거래처코드 = ba.계좌코드
      LEFT JOIN ledger counter ON l.일자 = counter.일자 
        AND l.적요 = counter.적요 
        AND COALESCE(l.차변금액, 0) = COALESCE(counter.대변금액, 0)
        AND counter.계정코드 != '1039'
      LEFT JOIN clients c ON counter.거래처코드 = c.거래처코드
      WHERE l.일자 = '${ledgerDate}'
        AND l.계정코드 = '1039'
        AND l.차변금액 > 0
      GROUP BY l.id -- Prevent duplicates if multiple counterparties match
      ORDER BY 3 DESC
    `;
    const inflowResult = await executeSQL(inflowQuery);
    const inflows = inflowResult?.rows || [];

    // 2. 지출 내역 (payments) from ledger: 대변금액 = credit = outflow (DB_KNOWLEDGE §8.1)
    const outflowQuery = `
      SELECT
        '보통예금' as type,
        COALESCE(c.거래처명, ba.계좌명, l.거래처코드) as source,
        COALESCE(l.대변금액, 0) as amount,
        l.적요 as detail
      FROM ledger l
      LEFT JOIN bank_accounts ba ON l.거래처코드 = ba.계좌코드
      LEFT JOIN ledger counter ON l.일자 = counter.일자 
        AND l.적요 = counter.적요 
        AND COALESCE(l.대변금액, 0) = COALESCE(counter.차변금액, 0)
        AND counter.계정코드 != '1039'
      LEFT JOIN clients c ON counter.거래처코드 = c.거래처코드
      WHERE l.일자 = '${ledgerDate}'
        AND l.계정코드 = '1039'
        AND l.대변금액 > 0
      GROUP BY l.id
      ORDER BY 3 DESC
    `;
    const outflowResult = await executeSQL(outflowQuery);
    const outflows = outflowResult?.rows || [];

    return NextResponse.json({
      success: true,
      data: {
        inflows,
        outflows
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
