import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * Test endpoint to fetch all 중량 (weight) values from all sales tables
 */
export async function GET() {
  try {
    const query = `
      SELECT
        '영일본사' as source,
        일자,
        거래처코드,
        품목코드,
        수량,
        중량,
        공급가액
      FROM sales

      UNION ALL

      SELECT
        '동부사업소' as source,
        일자,
        거래처코드,
        품목코드,
        수량,
        중량,
        공급가액
      FROM east_division_sales

      UNION ALL

      SELECT
        '서부사업소' as source,
        일자,
        거래처코드,
        품목코드,
        수량,
        중량,
        공급가액
      FROM west_division_sales

      UNION ALL

      SELECT
        '남부사업소' as source,
        일자,
        거래처코드,
        품목코드,
        수량,
        중량,
        공급가액
      FROM south_division_sales

      ORDER BY 일자 DESC
      LIMIT 1000
    `;

    const result = await executeSQL(query);
    const rows = result?.rows || [];

    // Calculate some statistics
    const totalRows = rows.length;
    const totalWeight = rows.reduce((sum: number, row: any) => {
      const weight = parseFloat(String(row.중량 || '0').replace(/,/g, ''));
      return sum + (isNaN(weight) ? 0 : weight);
    }, 0);

    const sourceCounts = rows.reduce((acc: any, row: any) => {
      acc[row.source] = (acc[row.source] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        rows,
        statistics: {
          totalRows,
          totalWeight,
          sourceCounts
        }
      }
    });
  } catch (error: any) {
    console.error('All Sales Weight API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
