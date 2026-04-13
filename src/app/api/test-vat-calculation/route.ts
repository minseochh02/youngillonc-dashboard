import { NextResponse } from 'next/server';
import { executeSQL, getTableSchema } from '@/egdesk-helpers';

/**
 * Test endpoint to compare VAT-related amount aggregations.
 * Production dashboards use `공급가액` for ex-VAT (see `vat-amount-sql.ts`), not 합계/1.1.
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
        공급가액,
        CAST(REPLACE(수량, ',', '') AS NUMERIC) * 단가 as calculated_supply_price,
        CAST(REPLACE(합계, ',', '') AS NUMERIC) as total_with_vat,
        CAST(REPLACE(합계, ',', '') AS NUMERIC) / 1.1 as legacy_divided_by_1_1,
        CAST(REPLACE(공급가액, ',', '') AS NUMERIC) as supply_from_column
      FROM sales
      WHERE 일자 = '${date}'
      LIMIT 5
    `;

    // Method 1: Sum of (합계 / 1.1) — legacy; do not use for new code
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

    // Method 4: ROUND(Sum of (합계 / 1.1)) - legacy rounded
    const method4Query = `
      SELECT
        '차선책: ROUND(SUM(합계/1.1))' as method,
        COUNT(*) as record_count,
        ROUND(SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC) / 1.1), 0) as total
      FROM sales
      WHERE 일자 = '${date}'
    `;

    const method5Query = `
      SELECT
        '권장: SUM(공급가액)' as method,
        COUNT(*) as record_count,
        SUM(CAST(REPLACE(공급가액, ',', '') AS NUMERIC)) as total
      FROM sales
      WHERE 일자 = '${date}'
    `;

    const [sampleResult, method1, method2, method3, method4, method5] = await Promise.all([
      executeSQL(sampleQuery),
      executeSQL(method1Query),
      executeSQL(method2Query),
      executeSQL(method3Query),
      executeSQL(method4Query),
      executeSQL(method5Query)
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
        method4_rounded_fallback: method4?.rows?.[0] || {},
        method5_sum_supply_column: method5?.rows?.[0] || {}
      },
      explanation: {
        method1: "레거시: SUM(합계 / 1.1) — 대시보드에서 제거됨",
        method2: "참고: SUM(수량 × 단가) — 단가 정의에 따라 ERP 공급가액과 다를 수 있음",
        method3: "VAT 포함: SUM(합계)",
        method4: "레거시: ROUND(SUM(합계 / 1.1))",
        method5: "권장: SUM(공급가액) — ERP 동기화 컬럼 기준 (앱 기본)"
      },
      recommendation: "Ex-VAT 금액은 SUM(공급가액)을 사용합니다. 합계/1.1은 레거시 비교용입니다."
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
