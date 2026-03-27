import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint for B2B Daily Sales Profit Analysis
 * Fetches exactly from sales_profit table
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    // The user wants to display sales_profit table exactly as is.
    const query = `SELECT id, 품목코드, 품목명, 판매수량, 판매단가, 판매금액, 원가단가, 원가금액, 이익단가, 이익금액, 이익율, imported_at FROM sales_profit ORDER BY id DESC`;

    const result = await executeSQL(query);
    const data = result?.rows || [];

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('Sales Profit API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
