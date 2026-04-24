import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';
import { compareOffices, compareTeams, loadFullDisplayOrderContext } from '@/lib/display-order';
import {
  sqlAndEmployeeNotSpecialHandling,
  sqlAndSalesRemarkNotExact,
  sqlPurchaseExcludedClientPredicate,
} from '@/lib/special-handling-employees';

/**
 * API Endpoint for Product Status
 * Shows quarterly sales data across 9 product category sections
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const selectedMonthParam = searchParams.get('month');

    // Discover the actual months available in the database
    const dateRangeQuery = `
      SELECT DISTINCT substr(일자, 1, 7) as month FROM (
        SELECT 일자 FROM sales
        UNION ALL SELECT 일자 FROM east_division_sales
        UNION ALL SELECT 일자 FROM west_division_sales
        UNION ALL SELECT 일자 FROM purchases WHERE ${sqlPurchaseExcludedClientPredicate('거래처코드')}
      ) WHERE 일자 IS NOT NULL AND 일자 != '' AND 일자 LIKE '202%'
      ORDER BY month ASC
    `;

    const dateRangeResult = await executeSQL(dateRangeQuery);
    const availableMonths = dateRangeResult?.rows.map((r: any) => r.month) || [];

    // Use the latest available month as the reference point if no month is selected
    const latestMonthStr = availableMonths[availableMonths.length - 1] || new Date().toISOString().slice(0, 7);
    const currentMonthStr = selectedMonthParam && availableMonths.includes(selectedMonthParam)
      ? selectedMonthParam
      : latestMonthStr;

    const [latestYear] = currentMonthStr.split('-').map(Number);
    const currentYear = latestYear;
    const lastYear = currentYear - 1;

    const orderCtx = await loadFullDisplayOrderContext();

    // Base table for sales
    const baseSalesTable = 'sales';

    // Section 1: Auto by B2C vs B2B
    const salesUnion = `
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 실납업체, 적요 FROM sales
      UNION ALL 
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 실납업체, 적요 FROM east_division_sales
      UNION ALL 
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 실납업체, 적요 FROM west_division_sales
    `;

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
      FROM (${salesUnion}) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND ca.업종분류코드 IS NOT NULL
        AND ec.b2c_팀 IS NOT NULL
        ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
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
      FROM (${salesUnion}) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND ec.b2c_팀 IS NOT NULL
        AND ec.b2c_팀 != 'B2B'
        ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
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
      FROM (${salesUnion}) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.제품군 = 'MOBIL 1'
        AND ec.전체사업소 IS NOT NULL
        ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
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
      FROM (${salesUnion}) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.제품군 = 'MOBIL 1'
        AND ec.b2c_팀 IS NOT NULL
        AND ec.b2c_팀 != 'B2B'
        ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
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
      FROM (${salesUnion}) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.제품군 = 'AIOP'
        AND ec.b2c_팀 IS NOT NULL
        ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
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
      FROM (${salesUnion}) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.제품군 = 'TP'
        AND ec.b2c_팀 IS NOT NULL
        ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
      GROUP BY ec.b2c_팀, year, quarter
    `;

    // Section 7: Special P by teams
    const specialPlusQuery = `
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
      FROM (${salesUnion}) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.제품군 = 'SPECIAL P'
        AND ec.b2c_팀 IS NOT NULL
        ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
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
      FROM (${salesUnion}) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.품목그룹1코드 = 'CVL'
        AND ec.b2c_팀 IS NOT NULL
        ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
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
      FROM (${salesUnion}) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 >= '${lastYear}-01-01'
        AND s.일자 <= '${currentYear}-12-31'
        AND i.품목그룹1코드 = 'CVL'
        AND i.품목명 LIKE '%LEGEND%'
        AND ec.b2c_팀 IS NOT NULL
        ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
      GROUP BY ec.b2c_팀, year, quarter
    `;

    // Execute all queries in parallel
    const [auto, b2cTeams, mobil1Branch, mobil1Teams, aiop, tp, specialPlus, cvl, legend] =
      await Promise.all([
        executeSQL(autoQuery),
        executeSQL(b2cTeamsQuery),
        executeSQL(mobil1BranchQuery),
        executeSQL(mobil1TeamsQuery),
        executeSQL(aiopQuery),
        executeSQL(tpQuery),
        executeSQL(specialPlusQuery),
        executeSQL(cvlQuery),
        executeSQL(legendQuery)
      ]);

    // Transform data helper function
    const transformData = (rawData: any, categorySort: 'none' | 'team' | 'office' = 'none') => {
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
      const list = Array.from(categories).map(category => {
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

      if (categorySort === 'team') {
        list.sort((a, b) => compareTeams(a.category, b.category, orderCtx.teamB2c, orderCtx.teamB2b));
      } else if (categorySort === 'office') {
        list.sort((a, b) => compareOffices(a.category, b.category, orderCtx.office));
      }
      return list;
    };

    // Transform all sections
    const sections = [
      { id: 'auto-b2c-b2b', title: 'Auto by B2C vs B2B', data: transformData(auto, 'team') },
      { id: 'b2c-teams', title: 'B2C by teams', data: transformData(b2cTeams, 'team') },
      { id: 'mobil1-branch', title: 'Mobil 1 by 사업소', data: transformData(mobil1Branch, 'office') },
      { id: 'mobil1-teams', title: 'Mobil 1 by B2C teams', data: transformData(mobil1Teams, 'team') },
      { id: 'aiop-teams', title: 'AIOP by teams', data: transformData(aiop, 'team') },
      { id: 'tp-teams', title: 'TP by teams', data: transformData(tp, 'team') },
      { id: 'special-plus', title: 'Special Plus by teams', data: transformData(specialPlus, 'team') },
      { id: 'cvl-teams', title: 'CVL by teams', data: transformData(cvl, 'team') },
      { id: 'legend-teams', title: 'LEGEND by teams', data: transformData(legend, 'team') }
    ];

    return NextResponse.json({
      success: true,
      data: {
        sections,
        currentYear,
        lastYear,
        availableMonths,
        currentMonth: currentMonthStr,
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
