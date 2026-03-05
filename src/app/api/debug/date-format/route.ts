import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * Debug endpoint to check actual date formats in the database
 */
export async function GET(request: Request) {
  try {
    // Get sample dates from sales table
    const salesDatesQuery = `
      SELECT DISTINCT 일자
      FROM sales
      ORDER BY 일자 DESC
      LIMIT 20
    `;

    // Get sample dates from deposits table
    const depositsDatesQuery = `
      SELECT DISTINCT 전표번호
      FROM deposits
      ORDER BY 전표번호 DESC
      LIMIT 20
    `;

    // Get sample dates from purchases table
    const purchasesDatesQuery = `
      SELECT DISTINCT 일자
      FROM purchases
      ORDER BY 일자 DESC
      LIMIT 20
    `;

    // Get sample dates from ledger table
    const ledgerDatesQuery = `
      SELECT 일자, 일자_no
      FROM ledger
      ORDER BY 일자 DESC
      LIMIT 20
    `;

    const [salesRes, depositsRes, purchasesRes, ledgerRes] = await Promise.all([
      executeSQL(salesDatesQuery),
      executeSQL(depositsDatesQuery),
      executeSQL(purchasesDatesQuery),
      executeSQL(ledgerDatesQuery)
    ]);

    return NextResponse.json({
      success: true,
      salesDates: salesRes?.rows || [],
      depositsDates: depositsRes?.rows || [],
      purchasesDates: purchasesRes?.rows || [],
      ledgerDates: ledgerRes?.rows || []
    });
  } catch (error: any) {
    console.error('Date Format Debug Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch date formats'
    }, { status: 500 });
  }
}
