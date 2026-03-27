import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const employeeName = searchParams.get('employee');
  const now = new Date();
  const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastDayOfMonthStr = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;

  const startDate = searchParams.get('startDate') || firstDayOfMonth;
  const endDate = searchParams.get('endDate') || lastDayOfMonthStr;

  if (!employeeName) {
    return NextResponse.json({ 
      success: false, 
      error: 'Employee name is required' 
    }, { status: 400 });
  }

  try {
    const query = `
      SELECT
        eal.id,
        eal.activity_date,
        eal.activity_type,
        eal.activity_label,
        krm.message as activity_summary,
        eal.customer as customer_name,
        eal.location,
        eal.products as products_mentioned,
        eal.outcome,
        eal.issue_severity,
        eal.action_taken,
        eal.resolved_by,
        eal.confidence_score
      FROM employee_activity_log eal
      JOIN kakaotalk_raw_messages krm ON eal.source_message_id = krm.id
      WHERE eal.employee_name = '${employeeName}'
        AND eal.activity_date >= '${startDate}'
        AND eal.activity_date <= '${endDate}'
      ORDER BY eal.activity_date ASC
    `;

    const result = await executeSQL(query);
    const rows = result?.rows || [];

    // Process rows to parse JSON safely in JS
    const activities = rows.map((row: any) => {
      let products = [];
      if (row.products_mentioned && row.products_mentioned !== '[]') {
        try {
          products = JSON.parse(row.products_mentioned);
        } catch (e) {
          // If not JSON, it might be a comma-separated string
          products = row.products_mentioned.split(',').map((p: string) => p.trim()).filter(Boolean);
        }
      }
      return {
        id: row.id,
        activity_date: row.activity_date,
        activity_type: row.activity_type,
        activity_label: row.activity_label,
        activity_summary: row.activity_summary,
        customer_name: row.customer_name,
        location: row.location,
        products_mentioned: Array.isArray(products) ? products : [],
        outcome: row.outcome,
        issue_severity: row.issue_severity,
        action_taken: row.action_taken,
        resolved_by: row.resolved_by,
        confidence_score: row.confidence_score
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
