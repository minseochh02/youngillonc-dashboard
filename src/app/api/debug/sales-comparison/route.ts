import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET() {
  try {
    // Query for AUTO (PVL/CVL) sales in February 2026
    const autoQuery = `
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

    const autoResult = await executeSQL(autoQuery);
    const autoData = autoResult?.rows?.[0] || { total_weight: 0, record_count: 0 };

    // Query for IL sales in February 2026
    const ilQuery = `
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
        AND i.품목그룹1코드 = 'IL'
    `;

    const ilResult = await executeSQL(ilQuery);
    const ilData = ilResult?.rows?.[0] || { total_weight: 0, record_count: 0 };

    // Get record counts by table
    const salesCountQuery = "SELECT COUNT(*) as count FROM sales WHERE substr(일자, 1, 7) = '2026-02'";
    const eastCountQuery = "SELECT COUNT(*) as count FROM east_division_sales WHERE substr(일자, 1, 7) = '2026-02'";
    const westCountQuery = "SELECT COUNT(*) as count FROM west_division_sales WHERE substr(일자, 1, 7) = '2026-02'";

    const [salesCountResult, eastCountResult, westCountResult] = await Promise.all([
      executeSQL(salesCountQuery),
      executeSQL(eastCountQuery),
      executeSQL(westCountQuery)
    ]);

    const salesCount = salesCountResult?.rows?.[0]?.count || 0;
    const eastCount = eastCountResult?.rows?.[0]?.count || 0;
    const westCount = westCountResult?.rows?.[0]?.count || 0;

    return NextResponse.json({
      success: true,
      data: {
        auto: {
          total_weight: autoData.total_weight,
          record_count: autoData.record_count,
          expected_from_excel: 316894,
          difference: autoData.total_weight - 316894
        },
        il: {
          total_weight: ilData.total_weight,
          record_count: ilData.record_count,
          expected_from_excel: 363256,
          difference: ilData.total_weight - 363256
        },
        table_counts: {
          sales: salesCount,
          east_division_sales: eastCount,
          west_division_sales: westCount,
          total: salesCount + eastCount + westCount,
          expected_from_excel: 3760
        }
      }
    });
  } catch (error: any) {
    console.error('Sales comparison error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
