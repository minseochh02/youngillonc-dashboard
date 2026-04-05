import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET() {
  try {
    // Query for AUTO weight excluding 김도량 - all three tables combined
    const autoWithFilterQuery = `
      SELECT
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        COUNT(*) as record_count
      FROM (
        SELECT * FROM sales
        UNION ALL
        SELECT * FROM east_division_sales
        UNION ALL
        SELECT * FROM west_division_sales
      ) s
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
        AND i.품목그룹1코드 IN ('PVL', 'CVL')
        AND e.사원_담당_명 != '김도량'
    `;

    // Query for AUTO weight WITHOUT excluding 김도량 - all three tables combined
    const autoWithoutFilterQuery = `
      SELECT
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        COUNT(*) as record_count
      FROM (
        SELECT * FROM sales
        UNION ALL
        SELECT * FROM east_division_sales
        UNION ALL
        SELECT * FROM west_division_sales
      ) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
        AND i.품목그룹1코드 IN ('PVL', 'CVL')
    `;

    // Check 김도량's AUTO sales
    const kimDoRyangQuery = `
      SELECT
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        COUNT(*) as record_count
      FROM (
        SELECT * FROM sales
        UNION ALL
        SELECT * FROM east_division_sales
        UNION ALL
        SELECT * FROM west_division_sales
      ) s
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
        AND i.품목그룹1코드 IN ('PVL', 'CVL')
        AND e.사원_담당_명 = '김도량'
    `;

    const [withFilterResult, withoutFilterResult, kimDoRyangResult] = await Promise.all([
      executeSQL(autoWithFilterQuery),
      executeSQL(autoWithoutFilterQuery),
      executeSQL(kimDoRyangQuery)
    ]);

    const withFilter = withFilterResult?.rows?.[0] || { total_weight: 0, record_count: 0 };
    const withoutFilter = withoutFilterResult?.rows?.[0] || { total_weight: 0, record_count: 0 };
    const kimDoRyang = kimDoRyangResult?.rows?.[0] || { total_weight: 0, record_count: 0 };

    return NextResponse.json({
      success: true,
      data: {
        auto_excluding_kim: {
          total_weight: withFilter.total_weight,
          record_count: withFilter.record_count
        },
        auto_including_kim: {
          total_weight: withoutFilter.total_weight,
          record_count: withoutFilter.record_count
        },
        kim_doryang_only: {
          total_weight: kimDoRyang.total_weight,
          record_count: kimDoRyang.record_count
        },
        verification: {
          excluding_plus_kim_equals_including:
            (withFilter.total_weight + kimDoRyang.total_weight) === withoutFilter.total_weight
        }
      }
    });
  } catch (error: any) {
    console.error('AUTO weight check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
