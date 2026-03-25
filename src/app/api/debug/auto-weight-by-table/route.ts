import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET() {
  try {
    // Query for AUTO weight in sales table excluding 김도량
    const salesTableQuery = `
      SELECT
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        COUNT(*) as record_count
      FROM sales s
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
        AND i.품목그룹1코드 IN ('PVL', 'CVL')
        AND e.사원_담당_명 != '김도량'
    `;

    // Query for AUTO weight in east_division_sales table excluding 김도량
    const eastTableQuery = `
      SELECT
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        COUNT(*) as record_count
      FROM east_division_sales s
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
        AND i.품목그룹1코드 IN ('PVL', 'CVL')
        AND e.사원_담당_명 != '김도량'
    `;

    // Query for AUTO weight in west_division_sales table excluding 김도량
    const westTableQuery = `
      SELECT
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
        COUNT(*) as record_count
      FROM west_division_sales s
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE substr(s.일자, 1, 7) = '2026-02'
        AND i.품목그룹1코드 IN ('PVL', 'CVL')
        AND e.사원_담당_명 != '김도량'
    `;

    const [salesResult, eastResult, westResult] = await Promise.all([
      executeSQL(salesTableQuery),
      executeSQL(eastTableQuery),
      executeSQL(westTableQuery)
    ]);

    const sales = salesResult?.rows?.[0] || { total_weight: 0, record_count: 0 };
    const east = eastResult?.rows?.[0] || { total_weight: 0, record_count: 0 };
    const west = westResult?.rows?.[0] || { total_weight: 0, record_count: 0 };

    const total_weight = sales.total_weight + east.total_weight + west.total_weight;
    const total_records = sales.record_count + east.record_count + west.record_count;

    return NextResponse.json({
      success: true,
      data: {
        sales_table: {
          total_weight: sales.total_weight,
          record_count: sales.record_count
        },
        east_division_sales_table: {
          total_weight: east.total_weight,
          record_count: east.record_count
        },
        west_division_sales_table: {
          total_weight: west.total_weight,
          record_count: west.record_count
        },
        combined_total: {
          total_weight: total_weight,
          record_count: total_records
        }
      }
    });
  } catch (error: any) {
    console.error('AUTO weight by table error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
