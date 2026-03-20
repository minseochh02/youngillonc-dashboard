import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET() {
  try {
    // Query for AUTO (PVL/CVL) sales in February 2026 - ONLY sales table
    const autoQuery = `
      SELECT
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        COUNT(*) as record_count
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
        AND i.품목그룹1코드 IN ('PVL', 'CVL')
    `;

    const autoResult = await executeSQL(autoQuery);
    const autoData = autoResult?.rows?.[0] || { total_weight: 0, record_count: 0 };

    // Query for IL sales in February 2026 - ONLY sales table
    const ilQuery = `
      SELECT
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        COUNT(*) as record_count
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
        AND i.품목그룹1코드 = 'IL'
    `;

    const ilResult = await executeSQL(ilQuery);
    const ilData = ilResult?.rows?.[0] || { total_weight: 0, record_count: 0 };

    // Get total record count from sales table
    const salesCountQuery = "SELECT COUNT(*) as count FROM sales WHERE substr(일자, 1, 7) = '2026-02'";
    const salesCountResult = await executeSQL(salesCountQuery);
    const salesCount = salesCountResult?.rows?.[0]?.count || 0;

    return NextResponse.json({
      success: true,
      comparison: {
        auto: {
          database: autoData.total_weight,
          excel: 316894,
          match: autoData.total_weight === 316894,
          difference: autoData.total_weight - 316894,
          record_count_db: autoData.record_count,
          record_count_excel: 1250
        },
        il: {
          database: ilData.total_weight,
          excel: 363256,
          match: ilData.total_weight === 363256,
          difference: ilData.total_weight - 363256,
          record_count_db: ilData.record_count,
          record_count_excel: 1282
        },
        total_records: {
          database: salesCount,
          excel: 3760,
          match: salesCount === 3760
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
