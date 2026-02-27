import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Daily Deposit and Withdrawal Status (입출금현황)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-04';

    // 1. Fetch real Inflow data from 'deposits'
    const depositQuery = `
      SELECT 
        계정명 as type,
        거래처명 as source,
        CAST(REPLACE(금액, ',', '') AS NUMERIC) as amount,
        계좌 as detail
      FROM deposits
      WHERE 전표번호 = '${date}'
      ORDER BY amount DESC
    `;
    const depositResult = await executeSQL(depositQuery);
    const realDeposits = depositResult?.rows || [];

    // 2. Fetch withdrawal data from 'expenses' table
    const expenseQuery = `
      SELECT 
        계정명 as type,
        거래처명 as source,
        CAST(REPLACE(금액, ',', '') AS NUMERIC) as amount,
        적요 as detail
      FROM expenses
      WHERE 전표번호 = '${date}'
      ORDER BY amount DESC
    `;
    const expenseResult = await executeSQL(expenseQuery);
    const realWithdrawals = expenseResult?.rows || [];

    return NextResponse.json({
      success: true,
      data: {
        deposits: realDeposits,
        withdrawals: realWithdrawals
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
