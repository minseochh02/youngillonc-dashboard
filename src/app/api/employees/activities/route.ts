import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const employeeName = searchParams.get('employee');
  const startDate = searchParams.get('startDate') || '2024-01-01';
  const endDate = searchParams.get('endDate') || '2026-12-31';

  if (!employeeName) {
    return NextResponse.json({ 
      success: false, 
      error: 'Employee name is required' 
    }, { status: 400 });
  }

  try {
    const query = `
      SELECT 
        id,
        activity_date,
        activity_type,
        activity_summary,
        customer_name,
        products_mentioned,
        confidence_score
      FROM employee_activity_log
      WHERE employee_name = '${employeeName}'
        AND activity_date >= '${startDate}'
        AND activity_date <= '${endDate}'
      ORDER BY activity_date ASC
    `;

    const result = await executeSQL(query);
    const rows = result?.rows || [];

    // Process rows to parse JSON safely in JS
    const activities = rows.map((row: any) => {
      let products = [];
      try {
        if (row.products_mentioned && row.products_mentioned !== '[]') {
          products = JSON.parse(row.products_mentioned);
        }
      } catch (e) {
        // Skip invalid JSON
      }
      return {
        ...row,
        products_mentioned: Array.isArray(products) ? products : []
      };
    });

    return NextResponse.json({
      success: true,
      data: activities
    });
  } catch (error: any) {
    console.error('Error fetching employee activities:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
