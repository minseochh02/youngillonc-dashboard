import { NextResponse } from 'next/server';
import { executeSQL, UNIFIED_SALES_SUBQUERY } from '@/egdesk-helpers';

/**
 * API Endpoint for Product Status
 * Shows quarterly sales data across 9 product category sections
 */
export async function GET(request: Request) {
  try {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    // Unified sales subquery across all four tables
    const combinedSales = UNIFIED_SALES_SUBQUERY;

    // Section 1: Auto by B2C vs B2B
    const autoQuery = `
      SELECT
        CASE
          WHEN ec.b2c_팀 != 'B2B' THEN 'B2C'
          ELSE 'B2B'
        END as category,
        strftime('%Y', s.일자) as year,
        CASE
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 1 AND 3 THEN 'Q1'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 4 AND 6 THEN 'Q2'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 7 AND 9 THEN 'Q3'
          ELSE 'Q4'
        END as quarter,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ) as total_weight
      FROM ${combinedSales} s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND ca.업종분류코드 IS NOT NULL
        AND ec.b2c_팀 IS NOT NULL
        AND e.사원_담당_명 != '김도량'
      GROUP BY category, year, quarter
    `;

    // Section 2: B2C by teams
    const b2cTeamsQuery = `
      SELECT
        ec.b2c_팀 as category,
        strftime('%Y', s.일자) as year,
        CASE
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 1 AND 3 THEN 'Q1'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 4 AND 6 THEN 'Q2'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 7 AND 9 THEN 'Q3'
          ELSE 'Q4'
        END as quarter,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
      FROM ${combinedSales} s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND ec.b2c_팀 IS NOT NULL
        AND ec.b2c_팀 != 'B2B'
        AND e.사원_담당_명 != '김도량'
      GROUP BY ec.b2c_팀, year, quarter
    `;

    // Section 3: Mobil 1 by 사업소 (branch)
    const mobil1BranchQuery = `
      SELECT
        CASE
          WHEN ec.전체사업소 = '벤츠' THEN 'MB'
          WHEN ec.전체사업소 = '경남사업소' THEN '창원'
          WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
          WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
          WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
          WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
          WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
          WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
          WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
          ELSE REPLACE(REPLACE(ec.전체사업소, '사업소', ''), '지사', '')
        END as category,
        strftime('%Y', s.일자) as year,
        CASE
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 1 AND 3 THEN 'Q1'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 4 AND 6 THEN 'Q2'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 7 AND 9 THEN 'Q3'
          ELSE 'Q4'
        END as quarter,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
      FROM ${combinedSales} s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.제품군 = 'Mobil 1'
        AND ec.전체사업소 IS NOT NULL
        AND e.사원_담당_명 != '김도량'
      GROUP BY category, year, quarter
    `;

    // Section 4: Mobil 1 by B2C teams
    const mobil1TeamsQuery = `
      SELECT
        ec.b2c_팀 as category,
        strftime('%Y', s.일자) as year,
        CASE
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 1 AND 3 THEN 'Q1'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 4 AND 6 THEN 'Q2'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 7 AND 9 THEN 'Q3'
          ELSE 'Q4'
        END as quarter,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
      FROM ${combinedSales} s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.제품군 = 'Mobil 1'
        AND ec.b2c_팀 IS NOT NULL
        AND ec.b2c_팀 != 'B2B'
        AND e.사원_담당_명 != '김도량'
      GROUP BY ec.b2c_팀, year, quarter
    `;

    // Section 5: AIOP by teams
    const aiopQuery = `
      SELECT
        ec.b2c_팀 as category,
        strftime('%Y', s.일자) as year,
        CASE
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 1 AND 3 THEN 'Q1'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 4 AND 6 THEN 'Q2'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 7 AND 9 THEN 'Q3'
          ELSE 'Q4'
        END as quarter,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
      FROM ${combinedSales} s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.제품군 = 'AIOP'
        AND ec.b2c_팀 IS NOT NULL
        AND e.사원_담당_명 != '김도량'
      GROUP BY ec.b2c_팀, year, quarter
    `;

    // Section 6: TP by teams
    const tpQuery = `
      SELECT
        ec.b2c_팀 as category,
        strftime('%Y', s.일자) as year,
        CASE
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 1 AND 3 THEN 'Q1'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 4 AND 6 THEN 'Q2'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 7 AND 9 THEN 'Q3'
          ELSE 'Q4'
        END as quarter,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
      FROM ${combinedSales} s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.제품군 = 'TP'
        AND ec.b2c_팀 IS NOT NULL
        AND e.사원_담당_명 != '김도량'
      GROUP BY ec.b2c_팀, year, quarter
    `;

    // Section 8: CVL by teams
    const cvlQuery = `
      SELECT
        ec.b2c_팀 as category,
        strftime('%Y', s.일자) as year,
        CASE
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 1 AND 3 THEN 'Q1'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 4 AND 6 THEN 'Q2'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 7 AND 9 THEN 'Q3'
          ELSE 'Q4'
        END as quarter,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
      FROM ${combinedSales} s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.품목그룹1코드 = 'CVL'
        AND ec.b2c_팀 IS NOT NULL
        AND e.사원_담당_명 != '김도량'
      GROUP BY ec.b2c_팀, year, quarter
    `;

    // Section 9: LEGEND by teams
    const legendQuery = `
      SELECT
        ec.b2c_팀 as category,
        strftime('%Y', s.일자) as year,
        CASE
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 1 AND 3 THEN 'Q1'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 4 AND 6 THEN 'Q2'
          WHEN CAST(strftime('%m', s.일자) AS INTEGER) BETWEEN 7 AND 9 THEN 'Q3'
          ELSE 'Q4'
        END as quarter,
        SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
      FROM ${combinedSales} s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.품목그룹1코드 = 'CVL'
        AND i.품목명 LIKE '%LEGEND%'
        AND ec.b2c_팀 IS NOT NULL
        AND e.사원_담당_명 != '김도량'
      GROUP BY ec.b2c_팀, year, quarter
    `;

    // Execute all queries in parallel
    const [auto, b2cTeams, mobil1Branch, mobil1Teams, aiop, tp, cvl, legend] =
      await Promise.all([
        executeSQL(autoQuery),
        executeSQL(b2cTeamsQuery),
        executeSQL(mobil1BranchQuery),
        executeSQL(mobil1TeamsQuery),
        executeSQL(aiopQuery),
        executeSQL(tpQuery),
        executeSQL(cvlQuery),
        executeSQL(legendQuery)
      ]);

    // Transform data helper function
    const transformData = (rawData: any) => {
      const rows = rawData?.rows || [];
      const categories = new Set<string>();
      const dataMap = new Map<string, any>();

      // Build data structure
      rows.forEach((row: any) => {
        categories.add(row.category);
        const key = `${row.category}-${row.year}-${row.quarter}`;
        dataMap.set(key, row.total_weight || 0);
      });

      // Convert to array format
      return Array.from(categories).map(category => {
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map(quarter => {
          const currentKey = `${category}-${currentYear}-${quarter}`;
          const previousKey = `${category}-${lastYear}-${quarter}`;

          return {
            quarter,
            actual: dataMap.get(currentKey) || 0,
            previousYear: dataMap.get(previousKey) || 0
          };
        });

        return { category, quarters };
      });
    };

    // Transform all sections
    const sections = [
      { id: 'auto-b2c-b2b', title: 'Auto by B2C vs B2B', data: transformData(auto) },
      { id: 'b2c-teams', title: 'B2C by teams', data: transformData(b2cTeams) },
      { id: 'mobil1-branch', title: 'Mobil 1 by 사업소', data: transformData(mobil1Branch) },
      { id: 'mobil1-teams', title: 'Mobil 1 by B2C teams', data: transformData(mobil1Teams) },
      { id: 'aiop-teams', title: 'AIOP by teams', data: transformData(aiop) },
      { id: 'tp-teams', title: 'TP by teams', data: transformData(tp) },
      { id: 'special-plus', title: 'Special plus by teams', data: [] },
      { id: 'cvl-teams', title: 'CVL by teams', data: transformData(cvl) },
      { id: 'legend-teams', title: 'LEGEND by teams', data: transformData(legend) }
    ];

    return NextResponse.json({
      success: true,
      data: {
        sections,
        currentYear,
        lastYear
      }
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch product status data'
    }, { status: 500 });
  }
}
