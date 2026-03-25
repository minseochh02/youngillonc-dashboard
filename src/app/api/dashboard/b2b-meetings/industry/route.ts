import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || '2025-01-01';
  const endDate = searchParams.get('endDate') || '2025-12-31';

  try {
    const query = `
      SELECT
        ct.모빌분류,
        ct.산업분류,
        ct.업종분류코드,
        COUNT(DISTINCT s.거래처코드) as client_count,
        COUNT(DISTINCT s.id) as transaction_count,
        SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC) * CAST(REPLACE(s.단가, ',', '') AS NUMERIC)) as total_supply_amount,
        SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as total_amount
      FROM sales s
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
      WHERE s.일자 BETWEEN '${startDate}' AND '${endDate}'
        AND ec.b2c_팀 = 'B2B'
        AND ct.업종분류코드 IS NOT NULL
      GROUP BY ct.모빌분류, ct.산업분류, ct.업종분류코드
      ORDER BY ct.모빌분류, ct.산업분류, total_amount DESC
    `;

    console.log('Executing B2B industry query:', query);

    const result = await executeSQL(query);
    const data = result?.rows || [];

    // Get filter options
    const filterOptionsQuery = `
      SELECT DISTINCT
        ct.모빌분류,
        ct.산업분류,
        ct.업종분류코드
      FROM company_type ct
      WHERE ct.모빌분류 IS NOT NULL OR ct.산업분류 IS NOT NULL
      ORDER BY ct.모빌분류, ct.산업분류
    `;

    const filterResult = await executeSQL(filterOptionsQuery);
    const filterOptions = filterResult?.rows || [];

    return NextResponse.json({
      success: true,
      data,
      filterOptions,
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch B2B industry data',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
