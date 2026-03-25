import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Count total clients
    const totalClientsResult = await executeSQL(
      'SELECT COUNT(*) as total FROM clients'
    );

    // 2. Count clients with any sales
    const clientsWithSalesResult = await executeSQL(`
      SELECT COUNT(DISTINCT 거래처코드) as count
      FROM (
        SELECT 거래처코드 FROM sales
        UNION
        SELECT 거래처코드 FROM east_division_sales
        UNION
        SELECT 거래처코드 FROM west_division_sales
        UNION
        SELECT 거래처코드 FROM south_division_sales
      )
    `);

    // 3. Get date range of sales
    const salesDateRangeResult = await executeSQL(`
      SELECT
        MIN(일자) as min_date,
        MAX(일자) as max_date
      FROM (
        SELECT 일자 FROM sales
        UNION ALL
        SELECT 일자 FROM east_division_sales
        UNION ALL
        SELECT 일자 FROM west_division_sales
        UNION ALL
        SELECT 일자 FROM south_division_sales
      )
    `);

    // 4. Sample of clients and their last transaction date
    const sampleClientsResult = await executeSQL(`
      SELECT
        c.거래처코드,
        c.거래처명,
        MAX(s.일자) as last_sale_date
      FROM clients c
      LEFT JOIN (
        SELECT 거래처코드, 일자 FROM sales
        UNION ALL
        SELECT 거래처코드, 일자 FROM east_division_sales
        UNION ALL
        SELECT 거래처코드, 일자 FROM west_division_sales
        UNION ALL
        SELECT 거래처코드, 일자 FROM south_division_sales
      ) s ON c.거래처코드 = s.거래처코드
      GROUP BY c.거래처코드, c.거래처명
      ORDER BY last_sale_date DESC NULLS LAST
      LIMIT 20
    `);

    // 5. Count clients inactive for 1 month (simple version without employee filter)
    const inactiveClientsResult = await executeSQL(`
      SELECT COUNT(*) as inactive_count
      FROM (
        SELECT
          c.거래처코드,
          MAX(s.일자) as last_sale_date
        FROM clients c
        LEFT JOIN (
          SELECT 거래처코드, 일자 FROM sales
          UNION ALL
          SELECT 거래처코드, 일자 FROM east_division_sales
          UNION ALL
          SELECT 거래처코드, 일자 FROM west_division_sales
          UNION ALL
          SELECT 거래처코드, 일자 FROM south_division_sales
        ) s ON c.거래처코드 = s.거래처코드
        GROUP BY c.거래처코드
        HAVING last_sale_date IS NULL OR last_sale_date < date('2025-03-31', '-1 month')
      )
    `);

    return NextResponse.json({
      success: true,
      data: {
        totalClients: totalClientsResult,
        clientsWithSales: clientsWithSalesResult,
        salesDateRange: salesDateRangeResult,
        sampleClients: sampleClientsResult,
        inactiveClients: inactiveClientsResult,
      },
    });
  } catch (error) {
    console.error('Error testing inactive query:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test inactive query',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
