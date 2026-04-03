import { NextResponse } from 'next/server';
import { executeSQL, getTableSchema } from '@/egdesk-helpers';

/**
 * Test endpoint to compare different VAT calculation methods
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-03-01';

    // First, check what columns exist
    const schemaResult = await getTableSchema('sales');

    // Get a sample of records to compare
    const sampleQuery = `
      SELECT
        일자,
        품목코드,
        수량,
        단가,
        합계,
        CAST(REPLACE(수량, ',', '') AS NUMERIC) * 단가 as calculated_supply_price,
        CAST(REPLACE(합계, ',', '') AS NUMERIC) as total_with_vat,
        CAST(REPLACE(합계, ',', '') AS NUMERIC) / 1.1 as total_divided_by_1_1
      FROM sales
      WHERE 일자 = '${date}'
      LIMIT 5
    `;

    // Method 1: Sum of (합계 / 1.1) - current buggy method
    const method1Query = `
      SELECT
        '현재 방법: SUM(합계/1.1)' as method,
        COUNT(*) as record_count,
        SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC) / 1.1) as total
      FROM sales
      WHERE 일자 = '${date}'
    `;

    // Method 2: Sum of (수량 × 단가) - correct supply price!
    const method2Query = `
      SELECT
        '정확한 방법: SUM(수량×단가)' as method,
        COUNT(*) as record_count,
        SUM(CAST(REPLACE(수량, ',', '') AS NUMERIC) * 단가) as total
      FROM sales
      WHERE 일자 = '${date}'
    `;

    // Method 3: Compare with VAT-inclusive total
    const method3Query = `
      SELECT
        'VAT 포함: SUM(합계)' as method,
        COUNT(*) as record_count,
        SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as total
      FROM sales
      WHERE 일자 = '${date}'
    `;

    // Method 4: ROUND(Sum of (합계 / 1.1)) - if we must use 합계
    const method4Query = `
      SELECT
        '차선책: ROUND(SUM(합계/1.1))' as method,
        COUNT(*) as record_count,
        ROUND(SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC) / 1.1), 0) as total
      FROM sales
      WHERE 일자 = '${date}'
    `;

    const [sampleResult, method1, method2, method3, method4] = await Promise.all([
      executeSQL(sampleQuery),
      executeSQL(method1Query),
      executeSQL(method2Query),
      executeSQL(method3Query),
      executeSQL(method4Query)
    ]);

    return NextResponse.json({
      success: true,
      date,
      schema: schemaResult || {},
      sample: sampleResult?.rows || [],
      comparison: {
        method1_current_buggy: method1?.rows?.[0] || {},
        method2_correct_supply_price: method2?.rows?.[0] || {},
        method3_with_vat: method3?.rows?.[0] || {},
        method4_rounded_fallback: method4?.rows?.[0] || {}
      },
      explanation: {
        method1: "현재 사용중: SUM(합계 / 1.1) → 소수점 문제 발생",
        method2: "정확한 공급가액: SUM(수량 × 단가) → VAT 없는 정확한 금액!",
        method3: "참고용 VAT 포함: SUM(합계) → VAT 포함된 전체 금액",
        method4: "차선책: ROUND(SUM(합계 / 1.1)) → 반올림으로 소수점 제거"
      },
      recommendation: "Method 2 (수량 × 단가)를 사용하면 정확한 공급가액을 얻을 수 있습니다!"
    });
  } catch (error: any) {
    console.error('Test VAT calculation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
