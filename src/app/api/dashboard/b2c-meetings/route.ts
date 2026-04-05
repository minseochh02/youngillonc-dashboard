import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'business';
    const selectedMonthParam = searchParams.get('month');
    const includeVat = searchParams.get('includeVat') === 'true';
    const divisor = includeVat ? '1.0' : '1.1';

    // Discover the actual months available in the database
    const dateRangeQuery = `
      SELECT DISTINCT substr(일자, 1, 7) as month FROM (
        SELECT 일자 FROM sales
        UNION ALL SELECT 일자 FROM east_division_sales
        UNION ALL SELECT 일자 FROM west_division_sales
        UNION ALL SELECT 일자 FROM purchases
        UNION ALL SELECT 일자 FROM east_division_purchases
        UNION ALL SELECT 일자 FROM west_division_purchases
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

    const [latestYear, latestMonth] = currentMonthStr.split('-').map(Number);
    const currentYear = latestYear;
    const lastYear = currentYear - 1;
    const businessYearWindow = 10;
    const businessMinYear = currentYear - (businessYearWindow - 1);

    // Base table for sales
    const baseSalesTable = `(
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 수량, 단가 FROM sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 수량, 단가 FROM east_division_sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량, 합계, 수량, 단가 FROM west_division_sales
    )`;

    if (tab === 'business') {
      // Query actual business data across all sales tables
      const query = `
        SELECT
          CASE
            WHEN ec.b2c사업소 LIKE '%동부%' THEN '동부'
            WHEN ec.b2c사업소 LIKE '%서부%' THEN '서부'
            WHEN ec.b2c사업소 LIKE '%중부%' THEN '중부'
            WHEN ec.b2c사업소 LIKE '%남부%' THEN '남부'
            WHEN ec.b2c사업소 LIKE '%제주%' THEN '제주'
            ELSE '본부'
          END as branch,
          CASE
            WHEN ec.b2c_팀 = 'B2B' THEN 'B2B'
            ELSE 'B2C'
          END as business_type,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        WHERE s.일자 >= '${businessMinYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND e.사원_담당_명 != '김도량'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ec.b2c사업소 IS NOT NULL
        GROUP BY branch, business_type, year, year_month
        ORDER BY year_month, branch
      `;

      const businessDataRaw = await executeSQL(query);
      const businessData = Array.isArray(businessDataRaw) ? businessDataRaw : (businessDataRaw?.rows || []);

      // Calculate cumulative totals by year (up to selected month in each calendar year)
      const [, currentMonthNum] = currentMonthStr.split('-');
      const years = Array.from({ length: businessYearWindow }, (_, i) =>
        String(businessMinYear + i)
      );

      const totalsByYear = businessData.reduce(
        (acc: any, row: any) => {
          const year = row.year;
          const yearMonth = row.year_month;
          const y = Number(year);
          if (y < businessMinYear || y > currentYear) return acc;
          const capMonth = `${year}-${currentMonthNum}`;
          if (yearMonth > capMonth) return acc;

          if (!acc[year]) {
            acc[year] = { total_weight: 0, total_amount: 0, total_quantity: 0 };
          }
          acc[year].total_weight = Math.round(acc[year].total_weight + Number(row.total_weight || 0));
          acc[year].total_amount = Math.round(acc[year].total_amount + Number(row.total_amount || 0));
          acc[year].total_quantity = Math.round(acc[year].total_quantity + Number(row.total_quantity || 0));
          return acc;
        },
        {}
      );

      return NextResponse.json({
        success: true,
        data: {
          businessData,
          totalsByYear,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          years,
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    if (tab === 'manager-sales') {
      const [, managerMonthNum] = currentMonthStr.split('-');
      const managerLastYearMonthStr = `${lastYear}-${managerMonthNum}`;

      // Query employee sales data grouped by team, employee, channel, and month across all three tables
      const query = `
        SELECT
          ec.b2c_팀 as team,
          ec.전체사업소 as branch_raw,
          e.사원_담당_명 as employee_name,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          CASE
            WHEN ca.업종분류코드 IN ('28600', '28610', '28710') THEN 'Fleet'
            WHEN ca.업종분류코드 IS NOT NULL THEN 'LCC'
            ELSE NULL
          END as channel,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ca.업종분류코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
        GROUP BY 1, 2, 3, 4, 5, 6
        ORDER BY 1, 3, 4, 5, 6
      `;

      const managerChannelCase = `
          CASE
            WHEN ca.업종분류코드 IN ('28600', '28610', '28710') THEN 'Fleet'
            WHEN ca.업종분류코드 IS NOT NULL THEN 'LCC'
            ELSE NULL
          END
      `;

      const managerBaseFrom = `
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
      `;

      const managerDateCumulative = `
        (
          (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
          OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${managerLastYearMonthStr}')
        )
      `;

      const totalClientsByYearQuery = `
        SELECT strftime('%Y', s.일자) as year,
          COUNT(DISTINCT s.거래처코드) as client_count
        ${managerBaseFrom}
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND (
            (strftime('%Y-%m', s.일자) = '${currentMonthStr}' AND strftime('%Y', s.일자) = '${currentYear}')
            OR (strftime('%Y-%m', s.일자) = '${managerLastYearMonthStr}' AND strftime('%Y', s.일자) = '${lastYear}')
          )
          AND ec.b2c_팀 IS NOT NULL
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ca.업종분류코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
        GROUP BY 1
      `;

      // B2C → 현장 / 사무실 / 남부지사 구분 (사무실·남부지사는 b2c_팀·전체사업소 문자열 기준, 먼저 매칭되는 쪽)
      // B2B → MB → 현장(전체사업소 있음) → 기타(전체사업소 공란 등). B2C 구간(사무실·남부) 없음.
      const managerSegmentCase = `
        CASE
          WHEN ec.b2c_팀 = 'B2B' AND IFNULL(ec.전체사업소, '') = '벤츠' THEN 'B2B_MB'
          WHEN ec.b2c_팀 = 'B2B' AND IFNULL(TRIM(ec.전체사업소), '') != '' THEN 'B2B_FIELD'
          WHEN ec.b2c_팀 = 'B2B' THEN 'B2B_ETC'
          WHEN ec.b2c_팀 LIKE '%사무실%' OR IFNULL(ec.전체사업소, '') LIKE '%사무실%' THEN 'B2C_OFFICE'
          WHEN ec.b2c_팀 LIKE '%남부지사%' OR IFNULL(ec.전체사업소, '') LIKE '%남부지사%' THEN 'B2C_NAMBU'
          WHEN ec.b2c_팀 IS NOT NULL AND ec.b2c_팀 != 'B2B' THEN 'B2C_FIELD'
          ELSE NULL
        END
      `;

      const teamChannelMonthSummaryQuery = `
        SELECT
          ${managerSegmentCase} as segment,
          ${managerChannelCase} as channel,
          strftime('%Y', s.일자) as year,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          COUNT(DISTINCT s.거래처코드) as client_count
        ${managerBaseFrom}
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND (
            (strftime('%Y-%m', s.일자) = '${currentMonthStr}' AND strftime('%Y', s.일자) = '${currentYear}')
            OR (strftime('%Y-%m', s.일자) = '${managerLastYearMonthStr}' AND strftime('%Y', s.일자) = '${lastYear}')
          )
          AND ec.b2c_팀 IS NOT NULL
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ca.업종분류코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
          AND (${managerChannelCase.trim()}) IS NOT NULL
          AND (${managerSegmentCase.trim()}) IS NOT NULL
        GROUP BY 1, 2, 3
      `;

      const employeeClientTotalCumulativeQuery = `
        SELECT e.사원_담당_명 as employee_name,
          strftime('%Y', s.일자) as year,
          COUNT(DISTINCT s.거래처코드) as client_count
        ${managerBaseFrom}
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ${managerDateCumulative}
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ca.업종분류코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
        GROUP BY e.사원_담당_명, year
      `;

      const employeeClientChannelCumulativeQuery = `
        SELECT e.사원_담당_명 as employee_name,
          strftime('%Y', s.일자) as year,
          ${managerChannelCase} as channel,
          COUNT(DISTINCT s.거래처코드) as client_count
        ${managerBaseFrom}
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ${managerDateCumulative}
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ca.업종분류코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
          AND (${managerChannelCase.trim()}) IS NOT NULL
        GROUP BY e.사원_담당_명, year, channel
      `;

      const employeeClientTotalMonthlyQuery = `
        SELECT e.사원_담당_명 as employee_name,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          COUNT(DISTINCT s.거래처코드) as client_count
        ${managerBaseFrom}
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ${managerDateCumulative}
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ca.업종분류코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
        GROUP BY e.사원_담당_명, year, year_month
      `;

      const employeeClientChannelMonthlyQuery = `
        SELECT e.사원_담당_명 as employee_name,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          ${managerChannelCase} as channel,
          COUNT(DISTINCT s.거래처코드) as client_count
        ${managerBaseFrom}
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ${managerDateCumulative}
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ca.업종분류코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
          AND (${managerChannelCase.trim()}) IS NOT NULL
        GROUP BY e.사원_담당_명, year, year_month, channel
      `;

      const employeeClientsSingleMonthQuery = `
        SELECT e.사원_담당_명 as employee_name,
          strftime('%Y', s.일자) as year,
          ${managerChannelCase} as channel,
          COUNT(DISTINCT s.거래처코드) as client_count
        ${managerBaseFrom}
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND (
            (strftime('%Y-%m', s.일자) = '${currentMonthStr}' AND strftime('%Y', s.일자) = '${currentYear}')
            OR (strftime('%Y-%m', s.일자) = '${managerLastYearMonthStr}' AND strftime('%Y', s.일자) = '${lastYear}')
          )
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ca.업종분류코드 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
          AND (${managerChannelCase.trim()}) IS NOT NULL
        GROUP BY e.사원_담당_명, year, channel
      `;

      let employeeSalesRaw;
      let totalClientsRaw: any;
      let teamChannelMonthSummaryRaw: any;
      let empClientTotalCumRaw: any;
      let empClientChCumRaw: any;
      let empClientTotalMoRaw: any;
      let empClientChMoRaw: any;
      let empClientSingleMoRaw: any;

      try {
        [
          employeeSalesRaw,
          totalClientsRaw,
          teamChannelMonthSummaryRaw,
          empClientTotalCumRaw,
          empClientChCumRaw,
          empClientTotalMoRaw,
          empClientChMoRaw,
          empClientSingleMoRaw,
        ] = await Promise.all([
          executeSQL(query),
          executeSQL(totalClientsByYearQuery),
          executeSQL(teamChannelMonthSummaryQuery),
          executeSQL(employeeClientTotalCumulativeQuery),
          executeSQL(employeeClientChannelCumulativeQuery),
          executeSQL(employeeClientTotalMonthlyQuery),
          executeSQL(employeeClientChannelMonthlyQuery),
          executeSQL(employeeClientsSingleMonthQuery),
        ]);
      } catch (error: any) {
        console.error('SQL Query Error:', error);
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Handle MCP response format - it might have a 'rows' property
      let employeeSalesData = Array.isArray(employeeSalesRaw) ? employeeSalesRaw : (employeeSalesRaw?.rows || []);
      console.log('Employee sales data fetched, count:', employeeSalesData.length);
      if (employeeSalesData.length > 0) {
        console.log('Sample row:', employeeSalesData[0]);
      }

      // Transform employee data to include branch mapping
      const employeeData = employeeSalesData.map((row: any) => {
        let branch = row.branch_raw;
        if (row.branch_raw === '벤츠') branch = 'MB';
        else if (row.branch_raw === '경남사업소') branch = '창원';
        else if (row.branch_raw?.includes('화성')) branch = '화성';
        else if (row.branch_raw?.includes('남부')) branch = '남부';
        else if (row.branch_raw?.includes('중부')) branch = '중부';
        else if (row.branch_raw?.includes('서부')) branch = '서부';
        else if (row.branch_raw?.includes('동부')) branch = '동부';
        else if (row.branch_raw?.includes('제주')) branch = '제주';
        else if (row.branch_raw?.includes('부산')) branch = '부산';
        else branch = row.branch_raw?.replace('사업소', '').replace('지사', '') || '';

        return {
          team: row.team,
          branch: branch,
          employee_name: row.employee_name,
          year: row.year,
          year_month: row.year_month,
          channel: row.channel,
          total_weight: Number(row.total_weight || 0),
          total_amount: Number(row.total_amount || 0),
          total_quantity: Number(row.total_quantity || 0),
        };
      });

      // Calculate summary totals by channel and year
      const summaryData: any[] = [];

      // Group by year and channel
      const summaryMap: Record<string, { total_weight: number; total_amount: number; total_quantity: number }> = {};

      employeeData.forEach((row: any) => {
        const key = `${row.year}-${row.channel}`;
        if (!summaryMap[key]) {
          summaryMap[key] = { total_weight: 0, total_amount: 0, total_quantity: 0 };
        }
        summaryMap[key].total_weight += row.total_weight;
        summaryMap[key].total_amount += row.total_amount;
        summaryMap[key].total_quantity += row.total_quantity;
      });

      Object.entries(summaryMap).forEach(([key, totals]) => {
        const [year, channel] = key.split('-');
        summaryData.push({
          business_type: 'B2C',
          category: channel,
          year: year,
          ...totals,
        });
      });

      const asRows = (raw: any) => (Array.isArray(raw) ? raw : raw?.rows || []);

      const totalClientCountByYear: Record<string, number> = {};
      asRows(totalClientsRaw).forEach((row: any) => {
        totalClientCountByYear[String(row.year)] = Number(row.client_count || 0);
      });

      const teamChannelMonthSummary = asRows(teamChannelMonthSummaryRaw).map((row: any) => ({
        segment: String(row.segment),
        channel: row.channel,
        year: String(row.year),
        total_weight: Math.round(Number(row.total_weight || 0)),
        client_count: Number(row.client_count || 0),
      }));

      const employeeClientTotalCumulative = asRows(empClientTotalCumRaw).map((row: any) => ({
        employee_name: row.employee_name,
        year: String(row.year),
        client_count: Number(row.client_count || 0),
      }));

      const employeeClientChannelCumulative = asRows(empClientChCumRaw).map((row: any) => ({
        employee_name: row.employee_name,
        year: String(row.year),
        channel: row.channel,
        client_count: Number(row.client_count || 0),
      }));

      const employeeClientTotalMonthly = asRows(empClientTotalMoRaw).map((row: any) => ({
        employee_name: row.employee_name,
        year: String(row.year),
        year_month: row.year_month,
        client_count: Number(row.client_count || 0),
      }));

      const employeeClientChannelMonthly = asRows(empClientChMoRaw).map((row: any) => ({
        employee_name: row.employee_name,
        year: String(row.year),
        year_month: row.year_month,
        channel: row.channel,
        client_count: Number(row.client_count || 0),
      }));

      const employeeClientChannelSingleMonth = asRows(empClientSingleMoRaw).map((row: any) => ({
        employee_name: row.employee_name,
        year: String(row.year),
        channel: row.channel,
        client_count: Number(row.client_count || 0),
      }));

      return NextResponse.json({
        success: true,
        data: {
          summaryData,
          employeeData,
          totalClientCountByYear,
          teamChannelMonthSummary,
          employeeClientTotalCumulative,
          employeeClientChannelCumulative,
          employeeClientTotalMonthly,
          employeeClientChannelMonthly,
          employeeClientChannelSingleMonth,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    if (tab === 'sales-amount') {
      // Calculate cumulative month strings for filtering
      const [currentYearNum, currentMonthNum] = currentMonthStr.split('-');
      const lastYearMonthStr = `${lastYear}-${currentMonthNum}`;

      // Query sales by employee and month for AUTO channels
      const employeeMonthQuery = `
        SELECT
          ec.b2c_팀 as team,
          e.사원_담당_명 as employee_name,
          ec.전체사업소 as branch_raw,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NOT NULL
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND e.사원_담당_명 != '김도량'
          AND (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
        GROUP BY 1, 2, 3, 4, 5
        ORDER BY 1, 2, 4, 5
      `;

      // Query B2C vs B2B comparison across all three tables (cumulative up to selected month)
      // Split by both channel type (AUTO/non-AUTO) and employee team (B2C/B2B)
      const comparisonQuery = `
        SELECT
          'B2C' as business_type,
          CASE WHEN ec.b2c_팀 = 'B2B' THEN 'B2B' ELSE 'B2C' END as employee_team,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          COUNT(DISTINCT s.거래처코드) as client_count,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NOT NULL
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND e.사원_담당_명 != '김도량'
          AND (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
        GROUP BY 1, 2, 3, 4

        UNION ALL

        SELECT
          'B2B' as business_type,
          CASE WHEN ec.b2c_팀 = 'B2B' THEN 'B2B' ELSE 'B2C' END as employee_team,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          COUNT(DISTINCT s.거래처코드) as client_count,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND i.품목그룹1코드 IN ('IL', 'AVI', 'MAR', 'MB')
          AND e.사원_담당_명 != '김도량'
          AND (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
        GROUP BY 1, 2, 3, 4
        ORDER BY 1, 2, 3, 4
      `;

      // Query B2C sales by team and employee across all three tables (cumulative up to selected month)
      const teamEmployeeQuery = `
        SELECT
          ec.b2c_팀 as team,
          e.사원_담당_명 as employee_name,
          ec.전체사업소 as branch_raw,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NOT NULL
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND e.사원_담당_명 != '김도량'
          AND (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
        GROUP BY 1, 2, 3, 4, 5
        ORDER BY 1, 2, 4, 5
      `;

      // Query B2B sales (for B2B subtotal) - IL, AVI, MAR, MB products only
      const b2bQuery = `
        SELECT
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND i.품목그룹1코드 IN ('IL', 'AVI', 'MAR', 'MB')
          AND e.사원_담당_명 != '김도량'
          AND (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
        GROUP BY 1, 2
        ORDER BY 1, 2
      `;

      const [employeeMonthDataRaw, comparisonDataRaw, teamEmployeeDataRaw, b2bDataRaw] = await Promise.all([
        executeSQL(employeeMonthQuery),
        executeSQL(comparisonQuery),
        executeSQL(teamEmployeeQuery),
        executeSQL(b2bQuery)
      ]);

      const employeeMonthDataArray = Array.isArray(employeeMonthDataRaw) ? employeeMonthDataRaw : (employeeMonthDataRaw?.rows || []);
      const comparisonDataArray = Array.isArray(comparisonDataRaw) ? comparisonDataRaw : (comparisonDataRaw?.rows || []);
      const teamEmployeeDataArray = Array.isArray(teamEmployeeDataRaw) ? teamEmployeeDataRaw : (teamEmployeeDataRaw?.rows || []);
      const b2bDataArray = Array.isArray(b2bDataRaw) ? b2bDataRaw : (b2bDataRaw?.rows || []);

      // Process employee monthly data with branch transformation
      const employeeMonthData = employeeMonthDataArray.map((row: any) => {
        let branch = row.branch_raw;
        if (row.branch_raw === '벤츠') branch = 'MB';
        else if (row.branch_raw === '경남사업소') branch = '창원';
        else if (row.branch_raw?.includes('화성')) branch = '화성';
        else if (row.branch_raw?.includes('남부')) branch = '남부';
        else if (row.branch_raw?.includes('중부')) branch = '중부';
        else if (row.branch_raw?.includes('서부')) branch = '서부';
        else if (row.branch_raw?.includes('동부')) branch = '동부';
        else if (row.branch_raw?.includes('제주')) branch = '제주';
        else if (row.branch_raw?.includes('부산')) branch = '부산';
        else branch = row.branch_raw?.replace('사업소', '').replace('지사', '') || '';

        return {
          team: row.team,
          employee_name: row.employee_name,
          branch,
          year: row.year,
          year_month: row.year_month,
          total_weight: Math.round(Number(row.total_weight || 0)),
          total_amount: Math.round(Number(row.total_amount || 0)),
          total_quantity: Math.round(Number(row.total_quantity || 0)),
        };
      });

      // Aggregate monthly data by year for B2C vs B2B with employee team dimension
      const comparisonAggregated: Record<string, { total_weight: number; total_amount: number; total_quantity: number; client_count: number }> = {};
      comparisonDataArray.forEach((row: any) => {
        const key = `${row.business_type}-${row.employee_team}-${row.year}`;
        if (!comparisonAggregated[key]) {
          comparisonAggregated[key] = { total_weight: 0, total_amount: 0, total_quantity: 0, client_count: 0 };
        }
        comparisonAggregated[key].total_weight += Math.round(Number(row.total_weight || 0));
        comparisonAggregated[key].total_amount += Math.round(Number(row.total_amount || 0));
        comparisonAggregated[key].total_quantity += Math.round(Number(row.total_quantity || 0));
        comparisonAggregated[key].client_count += Number(row.client_count || 0);
      });
      const comparisonData = Object.entries(comparisonAggregated).map(([key, totals]) => {
        const [business_type, employee_team, year] = key.split('-');
        return { business_type, employee_team, year, ...totals };
      });

      // Process team employee data - aggregate by team, employee, and year
      const teamEmployeeAggregated: Record<string, { total_weight: number; total_amount: number; total_quantity: number; branch: string }> = {};
      teamEmployeeDataArray.forEach((row: any) => {
        let branch = row.branch_raw;
        if (row.branch_raw === '벤츠') branch = 'MB';
        else if (row.branch_raw === '경남사업소') branch = '창원';
        else if (row.branch_raw?.includes('화성')) branch = '화성';
        else if (row.branch_raw?.includes('남부')) branch = '남부';
        else if (row.branch_raw?.includes('중부')) branch = '중부';
        else if (row.branch_raw?.includes('서부')) branch = '서부';
        else if (row.branch_raw?.includes('동부')) branch = '동부';
        else if (row.branch_raw?.includes('제주')) branch = '제주';
        else if (row.branch_raw?.includes('부산')) branch = '부산';
        else branch = row.branch_raw?.replace('사업소', '').replace('지사', '') || '';

        const key = `${row.team}|${row.employee_name}|${row.year}`;
        if (!teamEmployeeAggregated[key]) {
          teamEmployeeAggregated[key] = { total_weight: 0, total_amount: 0, total_quantity: 0, branch };
        }
        teamEmployeeAggregated[key].total_weight += Math.round(Number(row.total_weight || 0));
        teamEmployeeAggregated[key].total_amount += Math.round(Number(row.total_amount || 0));
        teamEmployeeAggregated[key].total_quantity += Math.round(Number(row.total_quantity || 0));
      });
      const teamEmployeeData = Object.entries(teamEmployeeAggregated).map(([key, data]) => {
        const [team, employee_name, year] = key.split('|');
        return { team, employee_name, year, branch: data.branch, total_weight: data.total_weight, total_amount: data.total_amount, total_quantity: data.total_quantity };
      });

      // Aggregate B2B data by year
      const b2bAggregated: Record<string, { total_weight: number; total_amount: number; total_quantity: number }> = {};
      b2bDataArray.forEach((row: any) => {
        const key = row.year;
        if (!b2bAggregated[key]) {
          b2bAggregated[key] = { total_weight: 0, total_amount: 0, total_quantity: 0 };
        }
        b2bAggregated[key].total_weight += Math.round(Number(row.total_weight || 0));
        b2bAggregated[key].total_amount += Math.round(Number(row.total_amount || 0));
        b2bAggregated[key].total_quantity += Math.round(Number(row.total_quantity || 0));
      });
      const b2bData = Object.entries(b2bAggregated).map(([year, totals]) => {
        return { year, ...totals };
      });

      return NextResponse.json({
        success: true,
        data: {
          employeeMonthData,
          comparisonData,
          teamEmployeeData,
          b2bData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    if (tab === 'sales-analysis') {
      // Calculate cumulative month strings for filtering
      const [currentYearNum, currentMonthNum] = currentMonthStr.split('-');
      const lastYearMonthStr = `${lastYear}-${currentMonthNum}`;

      // Query sales by AUTO channels (거래처그룹2) and product group across all three tables
      const query = `
        SELECT
          COALESCE(ca.거래처그룹2, 'Other') as channel,
          i.품목그룹1코드 as product_group,
          strftime('%Y', s.일자) as year,
          ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) as total_weight,
          ROUND(SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor})) as total_amount,
          ROUND(SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC))) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
          AND ca.업종분류코드 IS NOT NULL
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND (s.거래처코드 NOT IN (SELECT 거래처코드 FROM clients WHERE 담당자코드 IN (SELECT 사원_담당_코드 FROM employees WHERE 사원_담당_명 = '김도량')) OR s.거래처코드 IS NULL)
        GROUP BY 1, 2, 3
        ORDER BY 1, 2, 3
      `;

      const channelDataRaw = await executeSQL(query);
      const channelDataArray = Array.isArray(channelDataRaw) ? channelDataRaw : (channelDataRaw?.rows || []);

      const channelData = channelDataArray.map((row: any) => ({
        channel: row.channel || 'Other',
        product_group: row.product_group,
        year: row.year,
        total_weight: Math.round(Number(row.total_weight || 0)),
        total_amount: Math.round(Number(row.total_amount || 0)),
        total_quantity: Math.round(Number(row.total_quantity || 0)),
      }));

      console.log('Sales analysis channel data:', channelData);

      return NextResponse.json({
        success: true,
        data: {
          channelData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    if (tab === 'customer-reason') {
      // Query customer sales comparison year-over-year across all three tables for the selected month
      const [year, month] = currentMonthStr.split('-');
      const lastYearMonth = `${lastYear}-${month}`;

      const query = `
        SELECT
          ca.거래처그룹2,
          e.사원_담당_명 as 담당자명,
          c.거래처코드,
          c.거래처명 as 판매처명,
          SUM(CASE WHEN strftime('%Y-%m', s.일자) = '${lastYearMonth}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_year_weight,
          SUM(CASE WHEN strftime('%Y-%m', s.일자) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as current_year_weight
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE (s.일자 LIKE '${lastYearMonth}%' OR s.일자 LIKE '${currentMonthStr}%')
          AND ca.업종분류코드 IS NOT NULL
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY ca.거래처그룹2, e.사원_담당_명, c.거래처코드, c.거래처명
        HAVING last_year_weight > 0 OR current_year_weight > 0
        ORDER BY c.거래처코드
      `;

      const customerDataRaw = await executeSQL(query);
      const customerDataArray = Array.isArray(customerDataRaw) ? customerDataRaw : (customerDataRaw?.rows || []);

      const customerData = customerDataArray.map((row: any) => {
        const currentWeight = Number(row.current_year_weight || 0);
        const lastWeight = Number(row.last_year_weight || 0);

        return {
          거래처그룹2: row.거래처그룹2 || '',
          담당자명: row.담당자명 || '',
          거래처코드: row.거래처코드,
          판매처명: row.판매처명,
          last_year_weight: lastWeight,
          current_year_weight: currentWeight,
          change_weight: currentWeight - lastWeight,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          customerData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    if (tab === 'new') {
      // Query new clients (clients with 신규일 data) and their sales data across all three tables - cumulative up to selected month
      const [year, month] = currentMonthStr.split('-');
      const [currentYearNum, currentMonthNum] = currentMonthStr.split('-');
      const lastYearMonthStr = `${lastYear}-${currentMonthNum}`;

      const query = `
        SELECT
          c.거래처코드,
          c.거래처명,
          c.신규일,
          e.사원_담당_명 as 담당자명,
          ec.b2c_팀 as team,
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
          END as branch,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) as total_weight,
          ROUND(SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor})) as total_amount,
          ROUND(SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC))) as total_quantity,
          COUNT(DISTINCT s.일자) as transaction_days
        FROM clients c
        LEFT JOIN ${baseSalesTable} s ON c.거래처코드 = s.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE c.신규일 IS NOT NULL
          AND c.신규일 != ''
          AND (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND e.사원_담당_명 != '김도량'
        GROUP BY c.거래처코드, c.거래처명, c.신규일, e.사원_담당_명, branch, year, year_month
        ORDER BY team, e.사원_담당_명, c.신규일 DESC
      `;

      const newClientsDataRaw = await executeSQL(query);
      const newClientsData = Array.isArray(newClientsDataRaw) ? newClientsDataRaw : (newClientsDataRaw?.rows || []);

      // Calculate summaries by manager and year
      const managerSummary: any = {};
      newClientsData.forEach((row: any) => {
        const key = `${row.담당자명}-${row.year}`;
        if (!managerSummary[key]) {
          managerSummary[key] = {
            담당자명: row.담당자명,
            team: row.team,
            branch: row.branch,
            year: row.year,
            total_weight: 0,
            total_amount: 0,
            total_quantity: 0,
            client_count: new Set()
          };
        }
        managerSummary[key].total_weight += Number(row.total_weight || 0);
        managerSummary[key].total_amount += Number(row.total_amount || 0);
        managerSummary[key].total_quantity += Number(row.total_quantity || 0);
        managerSummary[key].client_count.add(row.거래처코드);
      });

      const summaryArray = Object.values(managerSummary).map((s: any) => ({
        ...s,
        total_weight: Math.round(s.total_weight),
        total_amount: Math.round(s.total_amount),
        total_quantity: Math.round(s.total_quantity),
        client_count: s.client_count.size
      }));

      // Calculate totals by year
      const totalsByYear = newClientsData.reduce(
        (acc: any, row: any) => {
          const year = row.year;
          if (!acc[year]) {
            acc[year] = {
              total_weight: 0,
              total_amount: 0,
              total_quantity: 0,
              client_count: new Set()
            };
          }
          acc[year].total_weight += Number(row.total_weight || 0);
          acc[year].total_amount += Number(row.total_amount || 0);
          acc[year].total_quantity += Number(row.total_quantity || 0);
          acc[year].client_count.add(row.거래처코드);
          return acc;
        },
        {}
      );

      // Convert Set to count and round values
      Object.keys(totalsByYear).forEach(year => {
        totalsByYear[year].total_weight = Math.round(totalsByYear[year].total_weight);
        totalsByYear[year].total_amount = Math.round(totalsByYear[year].total_amount);
        totalsByYear[year].total_quantity = Math.round(totalsByYear[year].total_quantity);
        totalsByYear[year].client_count = totalsByYear[year].client_count.size;
      });

      return NextResponse.json({
        success: true,
        data: {
          clients: newClientsData,
          managerSummary: summaryArray,
          totalsByYear,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    if (tab === 'shopping-mall') {
      // Query shopping mall sales data from the new shopping_sales table
      // Grouping by teams and month breakdown
      const query = `
        SELECT
          ec.b2c_팀 as team,
          strftime('%Y', s.주문_날짜) as year,
          strftime('%m', s.주문_날짜) as month,
          COUNT(DISTINCT s.주문번호) as transaction_count,
          COUNT(DISTINCT s.사업자번호) as client_count,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity,
          SUM(CAST(REPLACE(s.용량, ',', '') AS NUMERIC) * CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.주문금액, ',', '') AS NUMERIC) / ${divisor}) as total_supply_amount,
          SUM(CAST(REPLACE(s.총_주문금액, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.사용한_포인트, ',', '') AS NUMERIC)) as total_points,
          SUM(CAST(REPLACE(s.결제한_금액, ',', '') AS NUMERIC) / ${divisor}) as net_amount
        FROM shopping_sales s
        LEFT JOIN employee_category ec ON s.담당자 = ec.담당자
        WHERE s.주문_날짜 >= '${currentYear}-01-01'
          AND s.주문_날짜 <= '${currentYear}-12-31'
          AND ec.b2c_팀 IS NOT NULL
        GROUP BY team, year, month
        ORDER BY team, month
      `;

      const salesDataRaw = await executeSQL(query);
      const salesDataArray = Array.isArray(salesDataRaw) ? salesDataRaw : (salesDataRaw?.rows || []);

      const salesData = salesDataArray.map((row: any) => ({
        region: row.team || 'Unknown Team',
        year: row.year,
        month: row.month,
        transaction_count: Number(row.transaction_count || 0),
        client_count: Number(row.client_count || 0),
        total_quantity: Number(row.total_quantity || 0),
        total_weight: Number(row.total_weight || 0),
        total_supply_amount: Number(row.total_supply_amount || 0),
        total_amount: Number(row.total_amount || 0),
        total_points: Number(row.total_points || 0),
        net_amount: Number(row.net_amount || 0),
      }));

      // Get unique teams for the UI
      const uniqueTeams = Array.from(new Set(salesData.map((d: any) => d.region))).sort();

      return NextResponse.json({
        success: true,
        data: {
          salesData,
          regions: uniqueTeams,
          currentYear: currentYear.toString(),
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    if (tab === 'team-strategy') {
      // Calculate cumulative month strings for filtering
      const [currentYearNum, currentMonthNum] = currentMonthStr.split('-');
      const lastYearMonthStr = `${lastYear}-${currentMonthNum}`;

      // Query 1: PVL/CVL sales by team across all three tables - cumulative
      const teamPVCVQuery = `
        SELECT
          COALESCE(ec.b2c_팀, 'B2B팀') as team,
          i.품목그룹1코드 as product_group,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) as total_weight,
          ROUND(SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor})) as total_amount,
          ROUND(SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC))) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY ec.b2c_팀, i.품목그룹1코드, year, year_month
        ORDER BY ec.b2c_팀, year, year_month
      `;

      // Query 2: 남부지사 purchases and sales across all three tables - cumulative
      const nambujisaQuery = `
        SELECT
          'sales' as type,
          strftime('%Y', s.일자) as year,
          ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) as total_weight,
          ROUND(SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor})) as total_amount
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
          AND (ec.전체사업소 LIKE '%남부%' OR c.거래처그룹1명 LIKE '%남부%')
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY year

        UNION ALL

        SELECT
          'purchase' as type,
          strftime('%Y', p.일자) as year,
          ROUND(SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC))) as total_weight,
          ROUND(SUM(CAST(REPLACE(p.합_계, ',', '') AS NUMERIC) / ${divisor})) as total_amount
        FROM (
          SELECT 일자, 거래처코드, 품목코드, 중량, 합_계 FROM purchases
          UNION ALL
          SELECT 일자, 거래처코드, 품목코드, 중량, 합계 FROM east_division_purchases
          UNION ALL
          SELECT 일자, 거래처코드, 품목코드, 중량, 합계 FROM west_division_purchases
        ) p
        LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE (
            (strftime('%Y', p.일자) = '${currentYear}' AND strftime('%Y-%m', p.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', p.일자) = '${lastYear}' AND strftime('%Y-%m', p.일자) <= '${lastYearMonthStr}')
          )
          AND c.거래처그룹1명 LIKE '%남부%'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
        GROUP BY year
      `;

      // Query 3: Strategic dealers sales across all three tables - cumulative
      const strategicDealersQuery = `
        SELECT
          c.거래처명 as dealer_name,
          strftime('%Y', s.일자) as year,
          ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) as total_weight,
          ROUND(SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor})) as total_amount,
          ROUND(SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC))) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND (
            c.거래처명 LIKE '%모빌유화%'
            OR c.거래처명 LIKE '%오일프랜드%'
            OR c.거래처명 LIKE '%원창윤활유%'
            OR c.거래처명 LIKE '%이현상사%'
            OR c.거래처명 LIKE '%흥국상사%'
            OR c.거래처명 LIKE '%진병택%'
            OR c.거래처명 LIKE '%영동모빌%'
          )
          AND (s.거래처코드 NOT IN (SELECT 거래처코드 FROM clients WHERE 담당자코드 IN (SELECT 사원_담당_코드 FROM employees WHERE 사원_담당_명 = '김도량')) OR s.거래처코드 IS NULL)
        GROUP BY c.거래처명, year
        ORDER BY c.거래처명, year
      `;

      const nambujisaMonthlyQuery = `
        SELECT
          'sales' as type,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) as total_weight,
          ROUND(SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor})) as total_amount
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
          AND (ec.전체사업소 LIKE '%남부%' OR c.거래처그룹1명 LIKE '%남부%')
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY strftime('%Y', s.일자), strftime('%Y-%m', s.일자)

        UNION ALL

        SELECT
          'purchase' as type,
          strftime('%Y', p.일자) as year,
          strftime('%Y-%m', p.일자) as year_month,
          ROUND(SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC))) as total_weight,
          ROUND(SUM(CAST(REPLACE(p.합_계, ',', '') AS NUMERIC) / ${divisor})) as total_amount
        FROM (
          SELECT 일자, 거래처코드, 품목코드, 중량, 합_계 FROM purchases
          UNION ALL
          SELECT 일자, 거래처코드, 품목코드, 중량, 합계 FROM east_division_purchases
          UNION ALL
          SELECT 일자, 거래처코드, 품목코드, 중량, 합계 FROM west_division_purchases
        ) p
        LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE (
            (strftime('%Y', p.일자) = '${currentYear}' AND strftime('%Y-%m', p.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', p.일자) = '${lastYear}' AND strftime('%Y-%m', p.일자) <= '${lastYearMonthStr}')
          )
          AND c.거래처그룹1명 LIKE '%남부%'
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
        GROUP BY strftime('%Y', p.일자), strftime('%Y-%m', p.일자)
      `;

      const strategicDealersMonthlyQuery = `
        SELECT
          c.거래처명 as dealer_name,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) as total_weight,
          ROUND(SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor})) as total_amount,
          ROUND(SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC))) as total_quantity
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND (
            c.거래처명 LIKE '%모빌유화%'
            OR c.거래처명 LIKE '%오일프랜드%'
            OR c.거래처명 LIKE '%원창윤활유%'
            OR c.거래처명 LIKE '%이현상사%'
            OR c.거래처명 LIKE '%흥국상사%'
            OR c.거래처명 LIKE '%진병택%'
            OR c.거래처명 LIKE '%영동모빌%'
          )
          AND (s.거래처코드 NOT IN (SELECT 거래처코드 FROM clients WHERE 담당자코드 IN (SELECT 사원_담당_코드 FROM employees WHERE 사원_담당_명 = '김도량')) OR s.거래처코드 IS NULL)
        GROUP BY c.거래처명, strftime('%Y', s.일자), strftime('%Y-%m', s.일자)
        ORDER BY c.거래처명, year_month
      `;

      const [teamPVCVRaw, nambujisaRaw, strategicDealersRaw, nambujisaMonthlyRaw, strategicDealersMonthlyRaw] = await Promise.all([
        executeSQL(teamPVCVQuery),
        executeSQL(nambujisaQuery),
        executeSQL(strategicDealersQuery),
        executeSQL(nambujisaMonthlyQuery),
        executeSQL(strategicDealersMonthlyQuery),
      ]);

      const teamPVCVData = Array.isArray(teamPVCVRaw) ? teamPVCVRaw : (teamPVCVRaw?.rows || []);
      const nambujisaData = Array.isArray(nambujisaRaw) ? nambujisaRaw : (nambujisaRaw?.rows || []);
      const strategicDealersData = Array.isArray(strategicDealersRaw) ? strategicDealersRaw : (strategicDealersRaw?.rows || []);

      // Process team PVL/CVL data
      const teamData = teamPVCVData.map((row: any) => ({
        team: row.team || '사무실',
        product_group: row.product_group,
        year: row.year,
        year_month: row.year_month,
        total_weight: Math.round(Number(row.total_weight || 0)),
        total_amount: Math.round(Number(row.total_amount || 0)),
        total_quantity: Math.round(Number(row.total_quantity || 0)),
      }));

      // Process 남부지사 data
      const nambujisaProcessed = nambujisaData.map((row: any) => ({
        type: row.type,
        year: row.year,
        total_weight: Math.round(Number(row.total_weight || 0)),
        total_amount: Math.round(Number(row.total_amount || 0)),
      }));

      // Process strategic dealers data
      const strategicDealers = strategicDealersData.map((row: any) => ({
        dealer_name: row.dealer_name,
        year: row.year,
        total_weight: Math.round(Number(row.total_weight || 0)),
        total_amount: Math.round(Number(row.total_amount || 0)),
        total_quantity: Math.round(Number(row.total_quantity || 0)),
      }));

      const nambujisaMonthlyData = Array.isArray(nambujisaMonthlyRaw) ? nambujisaMonthlyRaw : (nambujisaMonthlyRaw?.rows || []);
      const strategicDealersMonthlyData = Array.isArray(strategicDealersMonthlyRaw) ? strategicDealersMonthlyRaw : (strategicDealersMonthlyRaw?.rows || []);

      const nambujisaMonthly = nambujisaMonthlyData.map((row: any) => ({
        type: row.type as 'sales' | 'purchase',
        year: row.year,
        year_month: row.year_month,
        total_weight: Math.round(Number(row.total_weight || 0)),
        total_amount: Math.round(Number(row.total_amount || 0)),
      }));

      const strategicDealersMonthly = strategicDealersMonthlyData.map((row: any) => ({
        dealer_name: row.dealer_name,
        year: row.year,
        year_month: row.year_month,
        total_weight: Math.round(Number(row.total_weight || 0)),
        total_amount: Math.round(Number(row.total_amount || 0)),
        total_quantity: Math.round(Number(row.total_quantity || 0)),
      }));

      return NextResponse.json({
        success: true,
        data: {
          teamData,
          nambujisaData: nambujisaProcessed,
          strategicDealers,
          nambujisaMonthly,
          strategicDealersMonthly,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    if (tab === 'team-volume') {
      // Calculate cumulative month strings for filtering
      const [currentYearNum, currentMonthNum] = currentMonthStr.split('-');
      const lastYearMonthStr = `${lastYear}-${currentMonthNum}`;

      // Query monthly sales volume by team, employee, and product group (PVL/CVL only) across all three tables - both years
      const query = `
        SELECT
          ec.b2c_팀 as team,
          e.사원_담당_명 as employee_name,
          i.품목그룹1코드 as product_group,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          ROUND(SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC))) as total_weight
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND ec.b2c_팀 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
        GROUP BY ec.b2c_팀, e.사원_담당_명, i.품목그룹1코드, year, year_month
        ORDER BY ec.b2c_팀, e.사원_담당_명, i.품목그룹1코드, year, year_month
      `;

      const volumeDataRaw = await executeSQL(query);
      const volumeDataArray = Array.isArray(volumeDataRaw) ? volumeDataRaw : (volumeDataRaw?.rows || []);

      const volumeData = volumeDataArray.map((row: any) => ({
        team: row.team || '사무실',
        employee_name: row.employee_name,
        product_group: row.product_group,
        year: row.year,
        year_month: row.year_month,
        total_weight: Math.round(Number(row.total_weight || 0)),
      }));

      return NextResponse.json({
        success: true,
        data: {
          volumeData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    if (tab === 'team-sales') {
      // Calculate cumulative month strings for filtering
      const [currentYearNum, currentMonthNum] = currentMonthStr.split('-');
      const lastYearMonthStr = `${lastYear}-${currentMonthNum}`;

      const teamSalesWhere = `
        (
            (strftime('%Y', s.일자) = '${currentYear}' AND strftime('%Y-%m', s.일자) <= '${currentMonthStr}')
            OR (strftime('%Y', s.일자) = '${lastYear}' AND strftime('%Y-%m', s.일자) <= '${lastYearMonthStr}')
          )
          AND ec.b2c_팀 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
      `;

      // Query monthly sales amount by team, employee, and product group (PVL/CVL/OTHERS) across all three tables - both years
      const query = `
        SELECT
          ec.b2c_팀 as team,
          e.사원_담당_명 as employee_name,
          CASE
            WHEN i.품목그룹1코드 = 'PVL' THEN 'PVL'
            WHEN i.품목그룹1코드 = 'CVL' THEN 'CVL'
            ELSE 'OTHERS'
          END as product_group,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          ROUND(SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor})) as total_amount
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE ${teamSalesWhere}
        GROUP BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month
        ORDER BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month
      `;

      // 전체 거래처수 (동일 기간·필터, 연도별 distinct)
      const totalClientsQuery = `
        SELECT
          strftime('%Y', s.일자) as year,
          COUNT(DISTINCT s.거래처코드) as client_count
        FROM ${baseSalesTable} s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE ${teamSalesWhere}
        GROUP BY 1
      `;

      // 팀·담당자·그룹별 누계 거래처수 (해당 연도 1월~선택월 distinct)
      const clientCumulativeQuery = `
        SELECT
          ec.b2c_팀 as team,
          e.사원_담당_명 as employee_name,
          CASE
            WHEN i.품목그룹1코드 = 'PVL' THEN 'PVL'
            WHEN i.품목그룹1코드 = 'CVL' THEN 'CVL'
            ELSE 'OTHERS'
          END as product_group,
          strftime('%Y', s.일자) as year,
          COUNT(DISTINCT s.거래처코드) as client_count
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE ${teamSalesWhere}
        GROUP BY ec.b2c_팀, e.사원_담당_명, product_group, year
        ORDER BY ec.b2c_팀, e.사원_담당_명, product_group, year
      `;

      // 월별 거래처수 (해당 월 거래 distinct)
      const clientMonthlyQuery = `
        SELECT
          ec.b2c_팀 as team,
          e.사원_담당_명 as employee_name,
          CASE
            WHEN i.품목그룹1코드 = 'PVL' THEN 'PVL'
            WHEN i.품목그룹1코드 = 'CVL' THEN 'CVL'
            ELSE 'OTHERS'
          END as product_group,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          COUNT(DISTINCT s.거래처코드) as client_count
        FROM ${baseSalesTable} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE ${teamSalesWhere}
        GROUP BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month
        ORDER BY ec.b2c_팀, e.사원_담당_명, product_group, year, year_month
      `;

      const [salesDataRaw, totalClientsRaw, clientCumulativeRaw, clientMonthlyRaw] = await Promise.all([
        executeSQL(query),
        executeSQL(totalClientsQuery),
        executeSQL(clientCumulativeQuery),
        executeSQL(clientMonthlyQuery),
      ]);

      const salesDataArray = Array.isArray(salesDataRaw) ? salesDataRaw : (salesDataRaw?.rows || []);
      const totalClientsArray = Array.isArray(totalClientsRaw) ? totalClientsRaw : (totalClientsRaw?.rows || []);
      const clientCumulativeArray = Array.isArray(clientCumulativeRaw) ? clientCumulativeRaw : (clientCumulativeRaw?.rows || []);
      const clientMonthlyArray = Array.isArray(clientMonthlyRaw) ? clientMonthlyRaw : (clientMonthlyRaw?.rows || []);

      const salesData = salesDataArray.map((row: any) => ({
        team: row.team || '사무실',
        employee_name: row.employee_name,
        product_group: row.product_group,
        year: row.year,
        year_month: row.year_month,
        total_amount: Math.round(Number(row.total_amount || 0)),
      }));

      const totalClientCountByYear: Record<string, number> = {};
      totalClientsArray.forEach((row: any) => {
        totalClientCountByYear[String(row.year)] = Number(row.client_count || 0);
      });

      const clientCountCumulative = clientCumulativeArray.map((row: any) => ({
        team: row.team || '사무실',
        employee_name: row.employee_name,
        product_group: row.product_group,
        year: String(row.year),
        client_count: Number(row.client_count || 0),
      }));

      const clientCountMonthly = clientMonthlyArray.map((row: any) => ({
        team: row.team || '사무실',
        employee_name: row.employee_name,
        product_group: row.product_group,
        year: String(row.year),
        year_month: row.year_month,
        client_count: Number(row.client_count || 0),
      }));

      return NextResponse.json({
        success: true,
        data: {
          salesData,
          totalClientCountByYear,
          clientCountCumulative,
          clientCountMonthly,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          availableMonths,
          currentMonth: currentMonthStr,
        },
      });
    }

    // Default response for other tabs (to be implemented)
    return NextResponse.json({
      success: true,
      data: {
        message: 'Tab not yet implemented',
      },
    });
  } catch (error: any) {
    console.error('B2C Meetings API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch B2C meetings data',
      },
      { status: 500 }
    );
  }
}
