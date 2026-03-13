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
        customer_name, 
        COUNT(*) as visit_count,
        MAX(activity_date) as last_visit
      FROM employee_activity_log
      WHERE employee_name = '${employeeName}'
        AND customer_name IS NOT NULL
        AND customer_name != ''
      GROUP BY customer_name
      ORDER BY visit_count DESC
    `;

    // 2. Get all activities with products_mentioned to process in JS
    // This avoids complex JSON SQL functions that might be restricted or incompatible
    const productsRawQuery = `
      SELECT products_mentioned, activity_date
      FROM employee_activity_log
      WHERE employee_name = '${employeeName}'
        AND products_mentioned IS NOT NULL
        AND products_mentioned != '[]'
        AND products_mentioned != ''
    `;

    // 3. Get employee profile info
    const masterQuery = `
      SELECT * FROM employee_master WHERE employee_name = '${employeeName}'
    `;

    const [customersResult, productsRawResult, masterResult] = await Promise.all([
      executeSQL(customersQuery),
      executeSQL(productsRawQuery),
      executeSQL(masterQuery)
    ]);

    // Process products in JavaScript
    const productStats: Record<string, { count: number, lastDate: string }> = {};
    const rawRows = productsRawResult?.rows || [];

    rawRows.forEach((row: any) => {
      try {
        const products = JSON.parse(row.products_mentioned);
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

    // Get unique product names to fetch categories
    const productNames = Object.keys(productStats);
    let productsWithCategories = [];

    if (productNames.length > 0) {
      // Fetch categories for these products
      const placeholders = productNames.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
      const mappingQuery = `
        SELECT "품목명", "품목그룹1명", "품목그룹2명"
        FROM product_mapping
        WHERE "품목명" IN (${placeholders})
      `;
      const mappingResult = await executeSQL(mappingQuery);
      const mappings: Record<string, any> = {};
      mappingResult?.rows?.forEach((r: any) => {
        mappings[r.품목명] = r;
      });

      productsWithCategories = productNames.map(name => ({
        product_name: name,
        mention_count: productStats[name].count,
        last_mentioned: productStats[name].lastDate,
        category1: mappings[name]?.품목그룹1명,
        category2: mappings[name]?.품목그룹2명
      })).sort((a, b) => b.mention_count - a.mention_count);
    }

    return NextResponse.json({
      success: true,
      data: {
        companies: customersResult?.rows || [],
        products: productsWithCategories,
        profile: masterResult?.rows?.[0] || { employee_name: employeeName }
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
