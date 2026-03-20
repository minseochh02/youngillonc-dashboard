import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const employeeName = searchParams.get('employee');

  if (!employeeName) {
    return NextResponse.json({
      success: false,
      error: 'Employee name is required'
    }, { status: 400 });
  }

  try {
    // 1. Get unique customers and their visit counts
    const customersQuery = `
      SELECT
        customer as customer_name,
        COUNT(*) as visit_count,
        MAX(activity_date) as last_visit
      FROM employee_activity_log
      WHERE employee_name = '${employeeName}'
        AND customer IS NOT NULL
        AND customer != ''
      GROUP BY customer
      ORDER BY visit_count DESC
    `;

    // 2. Get all activities with products to process in JS
    // This avoids complex JSON SQL functions that might be restricted or incompatible
    const productsRawQuery = `
      SELECT products, activity_date
      FROM employee_activity_log
      WHERE employee_name = '${employeeName}'
        AND products IS NOT NULL
        AND products != '[]'
        AND products != ''
    `;

    const [customersResult, productsRawResult] = await Promise.all([
      executeSQL(customersQuery),
      executeSQL(productsRawQuery)
    ]);

    // Process products in JavaScript
    const productStats: Record<string, { count: number, lastDate: string }> = {};
    const rawRows = productsRawResult?.rows || [];

    rawRows.forEach((row: any) => {
      try {
        const products = JSON.parse(row.products);
        if (Array.isArray(products)) {
          products.forEach(p => {
            if (!productStats[p]) {
              productStats[p] = { count: 0, lastDate: row.activity_date };
            }
            productStats[p].count++;
            if (row.activity_date > productStats[p].lastDate) {
              productStats[p].lastDate = row.activity_date;
            }
          });
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Get unique product names
    const productNames = Object.keys(productStats);
    const productsWithCategories = productNames.map(name => ({
      product_name: name,
      mention_count: productStats[name].count,
      last_mentioned: productStats[name].lastDate
    })).sort((a, b) => b.mention_count - a.mention_count);

    return NextResponse.json({
      success: true,
      data: {
        companies: customersResult?.rows || [],
        products: productsWithCategories,
        profile: {
          employee_name: employeeName,
          employment_status: 'active'
        }
      }
    });
  } catch (error: any) {
    console.error('Error in employee summary API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to load employee summary'
    }, { status: 500 });
  }
}
