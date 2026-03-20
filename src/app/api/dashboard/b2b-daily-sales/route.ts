import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint for B2B Daily Sales Analysis by Product
 * Shows sales, purchases (DSP/ASP), profit, and profit margins for B2B transactions
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const branch = searchParams.get('branch') || 'all'; // 'all', 'MB', '화성', '창원', etc.

    // Build branch filter for sales (using employee_category)
    let branchFilter = '';
    if (branch !== 'all') {
      if (branch === 'MB') {
        branchFilter = "AND ec.전체사업소 = '벤츠'";
      } else if (branch === '창원') {
        branchFilter = "AND ec.전체사업소 = '경남사업소'";
      } else {
        branchFilter = `AND ec.전체사업소 LIKE '%${branch}%'`;
      }
    }

    // First, get B2B sales data across all three tables
    const salesQuery = `
      SELECT
        i.품목명 as product_name,
        i.품목코드 as product_code,
        i.품목그룹1코드 as category,
        SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as sales_quantity,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight,
        SUM(CAST(REPLACE(s.공급가액, ',', '') AS NUMERIC)) as supply_amount,
        SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as total_amount
      FROM (
        SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM sales
        UNION ALL
        SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM east_division_sales
        UNION ALL
        SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM west_division_sales
        UNION ALL
        SELECT 일자, 거래처코드, NULL as 담당자코드, 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, NULL as 신규일, NULL as 적요, NULL as 적요2 FROM south_division_sales
      ) s
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE s.일자 = '${date}'
        AND ec.b2c_팀 = 'B2B'
        AND e.사원_담당_명 != '김도량'
        ${branchFilter}
      GROUP BY i.품목명, i.품목코드, i.품목그룹1코드
      ORDER BY i.품목그룹1코드, i.품목명
    `;

    // Get purchase data
    const purchaseQuery = `
      SELECT
        p.품목코드 as product_code,
        SUM(CAST(REPLACE(p.수량, ',', '') AS NUMERIC)) as purchase_quantity,
        SUM(CAST(REPLACE(p.공급가액, ',', '') AS NUMERIC)) as purchase_supply_amount,
        SUM(CASE WHEN p.구매처명 LIKE '%모빌%' THEN CAST(REPLACE(p.공급가액, ',', '') AS NUMERIC) ELSE 0 END) as dsp_amount,
        SUM(CASE WHEN p.구매처명 LIKE '%모빌%' THEN CAST(REPLACE(p.수량, ',', '') AS NUMERIC) ELSE 0 END) as dsp_quantity,
        SUM(CASE WHEN p.구매처명 NOT LIKE '%모빌%' THEN CAST(REPLACE(p.공급가액, ',', '') AS NUMERIC) ELSE 0 END) as asp_amount,
        SUM(CASE WHEN p.구매처명 NOT LIKE '%모빌%' THEN CAST(REPLACE(p.수량, ',', '') AS NUMERIC) ELSE 0 END) as asp_quantity
      FROM purchases p
      WHERE p.일자 = '${date}'
      GROUP BY p.품목코드
    `;

    const [salesResult, purchaseResult] = await Promise.all([
      executeSQL(salesQuery),
      executeSQL(purchaseQuery)
    ]);

    const salesData = salesResult?.rows || [];
    const purchaseData = purchaseResult?.rows || [];

    // Create a map of purchase data by product code
    const purchaseMap = new Map();
    purchaseData.forEach((p: any) => {
      purchaseMap.set(p.product_code, p);
    });

    // Combine the data and calculate metrics
    const result = salesData.map((sale: any) => {
      const purchase = purchaseMap.get(sale.product_code) || {
        purchase_quantity: 0,
        purchase_supply_amount: 0,
        dsp_amount: 0,
        dsp_quantity: 0,
        asp_amount: 0,
        asp_quantity: 0
      };

      const sales_quantity = Number(sale.sales_quantity) || 0;
      const supply_amount = Number(sale.supply_amount) || 0;
      const dsp_amount = Number(purchase.dsp_amount) || 0;
      const dsp_quantity = Number(purchase.dsp_quantity) || 0;
      const asp_amount = Number(purchase.asp_amount) || 0;
      const asp_quantity = Number(purchase.asp_quantity) || 0;

      return {
        product_name: sale.product_name,
        product_code: sale.product_code,
        category: sale.category,
        sales_quantity,
        sales_weight: Number(sale.sales_weight) || 0,
        supply_amount,
        total_amount: Number(sale.total_amount) || 0,
        unit_price: sales_quantity > 0 ? Math.round(supply_amount / sales_quantity) : 0,
        purchase_quantity: Number(purchase.purchase_quantity) || 0,
        purchase_supply_amount: Number(purchase.purchase_supply_amount) || 0,
        dsp_amount,
        dsp_quantity,
        dsp_unit_price: dsp_quantity > 0 ? Math.round(dsp_amount / dsp_quantity) : 0,
        asp_amount,
        asp_quantity,
        asp_unit_price: asp_quantity > 0 ? Math.round(asp_amount / asp_quantity) : 0,
        other_costs: 0,
        profit_dsp: supply_amount - dsp_amount,
        profit_asp: supply_amount - asp_amount,
        profit_rate_dsp: supply_amount > 0 ? ((supply_amount - dsp_amount) / supply_amount * 100) : 0,
        profit_rate_asp: supply_amount > 0 ? ((supply_amount - asp_amount) / supply_amount * 100) : 0
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
      date,
      branch
    });
  } catch (error) {
    console.error('B2B Daily Sales Analysis Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
