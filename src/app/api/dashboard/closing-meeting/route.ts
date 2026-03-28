import { NextResponse } from 'next/server';
import { executeSQL, insertRows, updateRows } from '@/egdesk-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'monthly-summary';
    const selectedMonthParam = searchParams.get('month');

    // Base subquery to combine sales tables (excluding south division)
    // Joins with items to get 품목그룹1코드 and harmonizes '창고코드' to '출하창고코드'
    const baseSalesSubquery = `
      (
        SELECT s.일자, s.거래처코드, s.실납업체, s.담당자코드, s.품목코드, s.수량, s.중량, s.단가, s.합계, s.출하창고코드, i.품목그룹1코드
        FROM sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        UNION ALL
        SELECT s.일자, s.거래처코드, s.실납업체, s.담당자코드, s.품목코드, s.수량, s.중량, s.단가, s.합계, s.창고코드 as 출하창고코드, i.품목그룹1코드
        FROM east_division_sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        UNION ALL
        SELECT s.일자, s.거래처코드, s.실납업체, s.담당자코드, s.품목코드, s.수량, s.중량, s.단가, s.합계, s.창고코드 as 출하창고코드, i.품목그룹1코드
        FROM west_division_sales s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
      )
    `;

    // Base subquery to combine purchase tables
    const basePurchasesSubquery = `
      (
        SELECT p.일자, p.거래처코드, p.품목코드, p.중량, p.합_계 as 합계, p.창고코드, i.품목그룹1코드
        FROM purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        UNION ALL
        SELECT p.일자, p.거래처코드, p.품목코드, p.중량, p.합_계 as 합계, p.창고명 as 창고코드, i.품목그룹1코드
        FROM east_division_purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        UNION ALL
        SELECT p.일자, p.거래처코드, p.품목코드, p.중량, p.합_계 as 합계, p.창고명 as 창고코드, i.품목그룹1코드
        FROM west_division_purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
      )
    `;

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

    if (availableMonths.length === 0) {
      return NextResponse.json({
        success: true,
        data: { message: 'No data available in the database' }
      });
    }

    // Use the latest available month as the reference point if no month is selected
    const latestMonthStr = availableMonths[availableMonths.length - 1];
    const currentMonthStr = selectedMonthParam && availableMonths.includes(selectedMonthParam) 
      ? selectedMonthParam 
      : latestMonthStr;
    
    const [latestYear, latestMonth] = currentMonthStr.split('-').map(Number);
    const currentYear = latestYear;
    const lastYear = currentYear - 1;

    if (tab === 'monthly-summary') {
      // Query sales by month and category
      const salesQuery = `
        SELECT
          substr(s.일자, 1, 7) as month,
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
          END as category,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 IS NOT NULL
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
          AND ec.전체사업소 IS NOT NULL
        GROUP BY month, category
      `;

      // Query purchases by month and category
      const purchasesQuery = `
        SELECT
          substr(p.일자, 1, 7) as month,
          CASE
            WHEN p.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN p.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
          END as category,
          SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(p.합계, ',', '') AS NUMERIC)) as amount
        FROM (${basePurchasesSubquery}) p
        WHERE p.일자 IS NOT NULL
          AND p.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
        GROUP BY month, category
      `;

      // Query last year sales for YoY comparison
      const lastYearSalesQuery = `
        SELECT
          substr(s.일자, 1, 7) as month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 LIKE '${lastYear}-%'
          AND e.사원_담당_명 != '김도량'
          AND ec.전체사업소 IS NOT NULL
        GROUP BY month
      `;

      const [salesResult, purchasesResult, lastYearSalesResult, goalsResult] = await Promise.all([
        executeSQL(salesQuery),
        executeSQL(purchasesQuery),
        executeSQL(lastYearSalesQuery),
        executeSQL(`SELECT * FROM sales_goals WHERE year = '${currentYear}' AND goal_type = 'category'`)
      ]);

      const salesData = salesResult?.rows || [];
      const purchasesData = purchasesResult?.rows || [];
      const lastYearSalesData = lastYearSalesResult?.rows || [];
      const goalsData = goalsResult?.rows || [];

      // Create maps for lookup
      const salesMap = new Map();
      salesData.forEach((row: any) => {
        const key = `${row.month}_${row.category}`;
        salesMap.set(key, { weight: Number(row.weight) || 0, amount: Number(row.amount) || 0 });
      });

      const purchasesMap = new Map();
      purchasesData.forEach((row: any) => {
        const key = `${row.month}_${row.category}`;
        purchasesMap.set(key, { weight: Number(row.weight) || 0, amount: Number(row.amount) || 0 });
      });

      const lastYearSalesMap = new Map();
      lastYearSalesData.forEach((row: any) => {
        const monthNum = row.month.split('-')[1];
        lastYearSalesMap.set(monthNum, Number(row.weight) || 0);
      });

      const goalsMap = new Map();
      goalsData.forEach((row: any) => {
        const key = `${row.month}_${row.target_name}`;
        goalsMap.set(key, { weight: Number(row.target_weight) || 0, amount: Number(row.target_amount) || 0 });
      });

      const categories = ['MB', 'AVI + MAR', 'AUTO', 'IL'];
      const monthlyData = [];
      let ytdPurchase = 0, ytdPurchaseAmount = 0, ytdSales = 0, ytdSalesAmount = 0, ytdInventory = 0, ytdTargetWeight = 0;

      for (const monthStr of availableMonths) {
        let purchaseWeight = 0, purchaseAmount = 0, salesWeight = 0, salesAmount = 0, monthTargetWeight = 0;
        const monthNum = monthStr.split('-')[1];

        const breakdown = categories.map(cat => {
          const key = `${monthStr}_${cat}`;
          const s = salesMap.get(key) || { weight: 0, amount: 0 };
          const p = purchasesMap.get(key) || { weight: 0, amount: 0 };
          
          // Fix for goal lookup - we store goal by month '01' but monthStr is '2026-01'
          const goalKey = `${monthNum}_${cat}`;
          const g = goalsMap.get(goalKey) || { weight: 0, amount: 0 };

          purchaseWeight += p.weight;
          purchaseAmount += p.amount;
          salesWeight += s.weight;
          salesAmount += s.amount;
          monthTargetWeight += g.weight;

          return {
            category: cat,
            purchase_weight: Math.round(p.weight),
            sales_weight: Math.round(s.weight),
            inventory_weight: Math.round(p.weight - s.weight),
            target_weight: Math.round(g.weight),
            achievement_rate: g.weight > 0 ? (s.weight / g.weight) * 100 : 0
          };
        });

        // If a month has absolutely no activity, skip it
        if (purchaseWeight === 0 && salesWeight === 0 && monthTargetWeight === 0) continue;

        const lastYearSales = lastYearSalesMap.get(monthNum) || 0;
        const yoyGrowthRate = lastYearSales > 0 ? ((salesWeight - lastYearSales) / lastYearSales) * 100 : 0;

        const inventoryWeight = purchaseWeight - salesWeight;
        const achievementRate = monthTargetWeight > 0 ? (salesWeight / monthTargetWeight) * 100 : 0;

        monthlyData.push({
          month: monthStr,
          purchase_weight: Math.round(purchaseWeight),
          purchase_amount: Math.round(purchaseAmount),
          sales_weight: Math.round(salesWeight),
          sales_amount: Math.round(salesAmount),
          inventory_weight: Math.round(inventoryWeight),
          inventory_amount: Math.round(purchaseAmount - salesAmount),
          target_weight: Math.round(monthTargetWeight),
          achievement_rate: achievementRate,
          yoy_growth_rate: yoyGrowthRate,
          breakdown: breakdown,
        });

        ytdPurchase += purchaseWeight;
        ytdPurchaseAmount += purchaseAmount;
        ytdSales += salesWeight;
        ytdSalesAmount += salesAmount;
        ytdInventory += inventoryWeight;
        ytdTargetWeight += monthTargetWeight;
      }

      const currentMonthData = monthlyData[monthlyData.length - 1];

      return NextResponse.json({
        success: true,
        data: {
          currentYear: currentYear.toString(),
          availableMonths,
          monthlyData: monthlyData,
          currentMonthData: currentMonthData,
          yearToDate: {
            purchase_weight: Math.round(ytdPurchase),
            purchase_amount: Math.round(ytdPurchaseAmount),
            sales_weight: Math.round(ytdSales),
            sales_amount: Math.round(ytdSalesAmount),
            inventory_weight: Math.round(ytdInventory),
            inventory_amount: Math.round(ytdPurchaseAmount - ytdSalesAmount),
            target_weight: Math.round(ytdTargetWeight),
            achievement_rate: ytdTargetWeight > 0 ? (ytdSales / ytdTargetWeight) * 100 : 0,
          },
        },
      });
    }

    if (tab === 'target-achievement') {
      const branchMapping = `
        CASE
          WHEN c.거래처그룹1명 = '벤츠' THEN 'MB'
          WHEN c.거래처그룹1명 = '경남사업소' THEN '창원'
          WHEN c.거래처그룹1명 LIKE '%동부%' THEN '동부'
          WHEN c.거래처그룹1명 LIKE '%서부%' THEN '서부'
          WHEN c.거래처그룹1명 LIKE '%중부%' THEN '중부'
          WHEN c.거래처그룹1명 LIKE '%남부%' THEN '남부'
          WHEN c.거래처그룹1명 LIKE '%제주%' THEN '제주'
          WHEN c.거래처그룹1명 LIKE '%본부%' THEN '본부'
          ELSE REPLACE(REPLACE(COALESCE(c.거래처그룹1명, ''), '사업소', ''), '지사', '')
        END
      `;
      // Query actual sales for latest available month by branch
      const actualSalesQuery = `
        SELECT
          ${branchMapping} as branch,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${currentMonthStr}'
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL
          AND c.거래처그룹1명 != ''
        GROUP BY branch
      `;

      const monthNum = currentMonthStr.split('-')[1];
      const [actualSalesResult, goalsResult] = await Promise.all([
        executeSQL(actualSalesQuery),
        executeSQL(`SELECT * FROM sales_goals WHERE year = '${currentYear}' AND month = '${monthNum}' AND goal_type = 'category'`)
      ]);

      const actualSalesData = actualSalesResult?.rows || [];
      const goalsData = goalsResult?.rows || [];
      const goalsMap = new Map<string, number>(goalsData.map((g: any) => [g.target_name, Number(g.target_weight) || 0]));

      const branchData = actualSalesData.map((row: any) => {
        const actualWeight = Number(row.weight) || 0;
        const targetWeight = goalsMap.get(row.branch) || 0;
        return {
          branch: row.branch,
          target_weight: Math.round(targetWeight),
          actual_weight: Math.round(actualWeight),
          achievement_rate: targetWeight > 0 ? (actualWeight / targetWeight) * 100 : 0,
          gap: Math.round(actualWeight - targetWeight),
        };
      });

      branchData.sort((a: any, b: any) => (a.branch as string).localeCompare(b.branch as string));

      const totalActual = branchData.reduce((sum: number, b: any) => sum + (b.actual_weight as number), 0);
      const totalTarget = branchData.reduce((sum: number, b: any) => sum + (b.target_weight as number), 0);

      return NextResponse.json({
        success: true,
        data: {
          currentMonth: currentMonthStr,
          availableMonths,
          branches: branchData,
          total: {
            target_weight: totalTarget,
            actual_weight: totalActual,
            achievement_rate: totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0,
            gap: totalActual - totalTarget,
          },
        },
      });
    }

    if (tab === 'yoy-comparison') {
      const branchMapping = `
        CASE
          WHEN c.거래처그룹1명 = '벤츠' THEN 'MB'
          WHEN c.거래처그룹1명 = '경남사업소' THEN '창원'
          WHEN c.거래처그룹1명 LIKE '%동부%' THEN '동부'
          WHEN c.거래처그룹1명 LIKE '%서부%' THEN '서부'
          WHEN c.거래처그룹1명 LIKE '%중부%' THEN '중부'
          WHEN c.거래처그룹1명 LIKE '%남부%' THEN '남부'
          WHEN c.거래처그룹1명 LIKE '%제주%' THEN '제주'
          WHEN c.거래처그룹1명 LIKE '%본부%' THEN '본부'
          ELSE REPLACE(REPLACE(COALESCE(c.거래처그룹1명, ''), '사업소', ''), '지사', '')
        END
      `;
      const currentYearQuery = `
        SELECT
          ${branchMapping} as branch,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${currentMonthStr}'
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL
          AND c.거래처그룹1명 != ''
        GROUP BY branch
      `;

      const lastYearMonthStr = `${lastYear}-${currentMonthStr.split('-')[1]}`;
      const lastYearQuery = `
        SELECT
          ${branchMapping} as branch,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${lastYearMonthStr}'
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL
          AND c.거래처그룹1명 != ''
        GROUP BY branch
      `;

      const [currentYearResult, lastYearResult] = await Promise.all([
        executeSQL(currentYearQuery),
        executeSQL(lastYearQuery)
      ]);

      const currentYearData = currentYearResult?.rows || [];
      const lastYearData = lastYearResult?.rows || [];

      const currentYearMap = new Map();
      currentYearData.forEach((row: any) => currentYearMap.set(row.branch, Number(row.weight) || 0));

      const lastYearMap = new Map();
      lastYearData.forEach((row: any) => lastYearMap.set(row.branch, Number(row.weight) || 0));

      const allBranches = new Set([...currentYearData.map((r: any) => r.branch), ...lastYearData.map((r: any) => r.branch)]);

      const branchData = Array.from(allBranches).map(branch => {
        const currentWeight = currentYearMap.get(branch) || 0;
        const lastWeight = lastYearMap.get(branch) || 0;
        return {
          branch,
          current_year_weight: Math.round(currentWeight),
          last_year_weight: Math.round(lastWeight),
          growth_rate: lastWeight > 0 ? ((currentWeight - lastWeight) / lastWeight) * 100 : 0,
          growth_amount: Math.round(currentWeight - lastWeight),
        };
      });

      branchData.sort((a, b) => a.branch.localeCompare(b.branch));

      const totalCurrent = branchData.reduce((sum, b) => sum + b.current_year_weight, 0);
      const totalLast = branchData.reduce((sum, b) => sum + b.last_year_weight, 0);

      return NextResponse.json({
        success: true,
        data: {
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          currentMonth: currentMonthStr,
          availableMonths,
          branches: branchData,
          total: {
            current_year_weight: totalCurrent,
            last_year_weight: totalLast,
            growth_rate: totalLast > 0 ? ((totalCurrent - totalLast) / totalLast) * 100 : 0,
            growth_amount: totalCurrent - totalLast,
          },
        },
      });
    }

    if (tab === 'branch-performance') {
      const lastMonthIdx = availableMonths.indexOf(currentMonthStr) - 1;
      const lastMonthStr = lastMonthIdx >= 0 ? availableMonths[lastMonthIdx] : `${currentYear}-01`;

      const branchMapping = `
        CASE
          WHEN c.거래처그룹1명 = '벤츠' THEN 'MB'
          WHEN c.거래처그룹1명 = '경남사업소' THEN '창원'
          WHEN c.거래처그룹1명 LIKE '%동부%' THEN '동부'
          WHEN c.거래처그룹1명 LIKE '%서부%' THEN '서부'
          WHEN c.거래처그룹1명 LIKE '%중부%' THEN '중부'
          WHEN c.거래처그룹1명 LIKE '%남부%' THEN '남부'
          WHEN c.거래처그룹1명 LIKE '%제주%' THEN '제주'
          WHEN c.거래처그룹1명 LIKE '%본부%' THEN '본부'
          ELSE REPLACE(REPLACE(COALESCE(c.거래처그룹1명, ''), '사업소', ''), '지사', '')
        END
      `;

      const currentMonthQuery = `
        SELECT
          ${branchMapping} as branch,
          CASE 
            WHEN ec.b2c_팀 = 'B2B' THEN COALESCE(ec.b2b팀, 'B2B')
            ELSE COALESCE(ec.b2c_팀, '기타')
          END as team,
          e.사원_담당_명 as employee,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${currentMonthStr}'
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL
          AND c.거래처그룹1명 != ''
        GROUP BY branch, team, employee
      `;

      const lastMonthQuery = `
        SELECT
          ${branchMapping} as branch,
          CASE 
            WHEN ec.b2c_팀 = 'B2B' THEN COALESCE(ec.b2b팀, 'B2B')
            ELSE COALESCE(ec.b2c_팀, '기타')
          END as team,
          e.사원_담당_명 as employee,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${lastMonthStr}'
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL
          AND c.거래처그룹1명 != ''
        GROUP BY branch, team, employee
      `;

      const [currentMonthResult, lastMonthResult] = await Promise.all([
        executeSQL(currentMonthQuery),
        executeSQL(lastMonthQuery)
      ]);

      const currentMonthData = currentMonthResult?.rows || [];
      const lastMonthData = lastMonthResult?.rows || [];

      // Create a nested map structure: branch -> team -> employee -> { current, last }
      const nestedDataMap = new Map();

      const getOrInit = (map: Map<any, any>, key: any, defaultValue: any) => {
        if (!map.has(key)) map.set(key, defaultValue);
        return map.get(key);
      };

      currentMonthData.forEach((row: any) => {
        const branchMap = getOrInit(nestedDataMap, row.branch, new Map());
        const teamMap = getOrInit(branchMap, row.team, new Map());
        const empData = getOrInit(teamMap, row.employee, { current_weight: 0, current_amount: 0, last_weight: 0, last_amount: 0 });
        empData.current_weight = Number(row.weight) || 0;
        empData.current_amount = Number(row.amount) || 0;
      });

      lastMonthData.forEach((row: any) => {
        const branchMap = getOrInit(nestedDataMap, row.branch, new Map());
        const teamMap = getOrInit(branchMap, row.team, new Map());
        const empData = getOrInit(teamMap, row.employee, { current_weight: 0, current_amount: 0, last_weight: 0, last_amount: 0 });
        empData.last_weight = Number(row.weight) || 0;
        empData.last_amount = Number(row.amount) || 0;
      });

      const branchData = Array.from(nestedDataMap.entries()).map(([branch, teamsMap]: [string, Map<string, Map<string, any>>]) => {
        const teams = (Array.from(teamsMap.entries()) as [string, Map<string, any>][]).map(([team, empsMap]) => {
          const employees = (Array.from(empsMap.entries()) as [string, any][]).map(([employee, data]) => ({
            employee,
            current_month_weight: Math.round(data.current_weight),
            current_month_amount: Math.round(data.current_amount),
            last_month_weight: Math.round(data.last_weight),
            last_month_amount: Math.round(data.last_amount),
          }));

          employees.sort((a, b) => b.current_month_weight - a.current_month_weight);

          const teamWeight = employees.reduce((sum, e) => sum + e.current_month_weight, 0);
          const teamAmount = employees.reduce((sum, e) => sum + e.current_month_amount, 0);
          const teamLastWeight = employees.reduce((sum, e) => sum + e.last_month_weight, 0);
          const teamLastAmount = employees.reduce((sum, e) => sum + e.last_month_amount, 0);

          return {
            team_name: team,
            current_month_weight: teamWeight,
            current_month_amount: teamAmount,
            last_month_weight: teamLastWeight,
            last_month_amount: teamLastAmount,
            employees
          };
        });

        teams.sort((a: any, b: any) => b.current_month_weight - a.current_month_weight);

        const branchWeight = teams.reduce((sum: number, t: any) => sum + t.current_month_weight, 0);
        const branchAmount = teams.reduce((sum: number, t: any) => sum + t.current_month_amount, 0);
        const branchLastWeight = teams.reduce((sum: number, t: any) => sum + t.last_month_weight, 0);
        const branchLastAmount = teams.reduce((sum: number, t: any) => sum + t.last_month_amount, 0);

        return {
          branch,
          current_month_weight: branchWeight,
          current_month_amount: branchAmount,
          last_month_weight: branchLastWeight,
          last_month_amount: branchLastAmount,
          teams
        };
      });

      branchData.sort((a, b) => a.branch.localeCompare(b.branch));

      return NextResponse.json({
        success: true,
        data: {
          branches: branchData,
          currentMonth: currentMonthStr,
          lastMonth: lastMonthStr,
          availableMonths,
        },
      });
    }

    if (tab === 'b2c-auto') {
      const yoyMonthStr = `${lastYear}-${currentMonthStr.split('-')[1]}`;
      const lastMonthIdx = availableMonths.indexOf(currentMonthStr) - 1;
      const lastMonthStr = lastMonthIdx >= 0 ? availableMonths[lastMonthIdx] : `${currentYear}-01`;
      const monthNum = currentMonthStr.split('-')[1];

      const branchMapping = `
        CASE
          WHEN ec.전체사업소 LIKE '%동부%' THEN '동부지사'
          WHEN ec.전체사업소 LIKE '%서부%' THEN '서부지사'
          WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
          WHEN ec.전체사업소 LIKE '%남부%' THEN '남부지사'
          WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
          ELSE ec.전체사업소
        END
      `;

      // 1. Query B2C sales by product group
      const b2cCategoryQuery = `
        SELECT
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
          END as category,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as current_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) ELSE 0 END) as current_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) ELSE 0 END) as last_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${yoyMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as yoy_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) IN ('${currentMonthStr}', '${lastMonthStr}', '${yoyMonthStr}'))
          AND ec.b2c_팀 != 'B2B'
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY category
      `;

      // 2. Query B2C sales by branch, team, and category
      const b2cHierarchyQuery = `
        SELECT
          ${branchMapping} as branch,
          ec.b2c_팀 as team,
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
          END as category,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as current_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) ELSE 0 END) as current_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${yoyMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as yoy_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) IN ('${currentMonthStr}', '${lastMonthStr}', '${yoyMonthStr}'))
          AND ec.b2c_팀 != 'B2B'
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY branch, team, category
      `;

      // 3. Query B2B for comparison
      const b2bTotalQuery = `
        SELECT
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${currentMonthStr}'
          AND ec.b2c_팀 = 'B2B'
          AND e.사원_담당_명 != '김도량'
      `;

      const [catResult, hierarchyResult, b2bResult, goalsResult] = await Promise.all([
        executeSQL(b2cCategoryQuery),
        executeSQL(b2cHierarchyQuery),
        executeSQL(b2bTotalQuery),
        executeSQL(`SELECT * FROM sales_goals WHERE year = '${currentYear}' AND month = '${monthNum}'`)
      ]);

      const catData = catResult?.rows || [];
      const hierarchyData = hierarchyResult?.rows || [];
      const b2bTotalData = b2bResult?.rows?.[0] || { weight: 0, amount: 0 };
      const goalsData = goalsResult?.rows || [];
      
      const goalsMap = new Map<string, number>(goalsData.map((g: any) => [g.target_name, Number(g.target_weight) || 0]));

      // Process Categories (Product Group Summary)
      const categories = catData.map((row: any) => {
        const currentWeight = Number(row.current_month_weight) || 0;
        const targetWeight = goalsMap.get(row.category) || 0;
        return {
          category: row.category,
          current_month_weight: Math.round(currentWeight),
          current_month_amount: Math.round(Number(row.current_month_amount) || 0),
          last_month_weight: Math.round(Number(row.last_month_weight) || 0),
          last_month_amount: Math.round(Number(row.last_month_amount) || 0),
          yoy_weight: Math.round(Number(row.yoy_weight) || 0),
          yoy_growth_rate: row.yoy_weight > 0 ? ((currentWeight - row.yoy_weight) / row.yoy_weight) * 100 : 0,
          target_weight: Math.round(targetWeight),
          achievement_rate: targetWeight > 0 ? (currentWeight / targetWeight) * 100 : 0,
        };
      });
      const order = ['MB', 'AVI + MAR', 'AUTO', 'IL'];
      categories.sort((a: any, b: any) => order.indexOf(a.category) - order.indexOf(b.category));

      // Process Hierarchy (Branch > Team > Category)
      const branchMap = new Map<string, any>();
      hierarchyData.forEach((row: any) => {
        if (!branchMap.has(row.branch)) {
          branchMap.set(row.branch, { teams: new Map() });
        }
        const branchObj = branchMap.get(row.branch);
        if (!branchObj.teams.has(row.team)) {
          branchObj.teams.set(row.team, { categories: [] });
        }
        const teamObj = branchObj.teams.get(row.team);
        
        const actualWeight = Number(row.current_month_weight) || 0;
        const lastWeight = Number(row.last_month_weight) || 0;
        const yoyWeight = Number(row.yoy_weight) || 0;
        
        teamObj.categories.push({
          category: row.category,
          current_month_weight: Math.round(actualWeight),
          current_month_amount: Math.round(Number(row.current_month_amount) || 0),
          last_month_weight: Math.round(lastWeight),
          yoy_weight: Math.round(yoyWeight),
          yoy_growth_rate: yoyWeight > 0 ? ((actualWeight - yoyWeight) / yoyWeight) * 100 : 0,
          target_weight: 0, // Goals are set per Team, not per Team-Category
          achievement_rate: 0,
        });
      });

      const branches = Array.from(branchMap.entries()).map(([branchName, branchObj]) => {
        const teams = Array.from(branchObj.teams.entries()).map((entry: any) => {
          const [teamName, teamObj] = entry;
          const teamActual = teamObj.categories.reduce((sum: number, c: any) => sum + c.current_month_weight, 0);
          const teamAmount = teamObj.categories.reduce((sum: number, c: any) => sum + c.current_month_amount, 0);
          const teamLast = teamObj.categories.reduce((sum: number, c: any) => sum + c.last_month_weight, 0);
          const teamYoy = teamObj.categories.reduce((sum: number, c: any) => sum + c.yoy_weight, 0);
          const teamTarget = goalsMap.get(teamName) || 0;

          // Sort categories within team
          teamObj.categories.sort((a: any, b: any) => order.indexOf(a.category) - order.indexOf(b.category));

          return {
            team_name: teamName,
            current_month_weight: teamActual,
            current_month_amount: teamAmount,
            last_month_weight: teamLast,
            yoy_weight: teamYoy,
            yoy_growth_rate: teamYoy > 0 ? ((teamActual - teamYoy) / teamYoy) * 100 : 0,
            target_weight: Math.round(teamTarget),
            achievement_rate: teamTarget > 0 ? (teamActual / teamTarget) * 100 : 0,
            categories: teamObj.categories
          };
        });

        const branchActual = teams.reduce((sum: number, t: any) => sum + t.current_month_weight, 0);
        const branchAmount = teams.reduce((sum: number, t: any) => sum + t.current_month_amount, 0);
        const branchLast = teams.reduce((sum: number, t: any) => sum + t.last_month_weight, 0);
        const branchYoy = teams.reduce((sum: number, t: any) => sum + t.yoy_weight, 0);
        const branchTarget = teams.reduce((sum: number, t: any) => sum + t.target_weight, 0);

        return {
          branch: branchName,
          current_month_weight: branchActual,
          current_month_amount: branchAmount,
          last_month_weight: branchLast,
          yoy_weight: branchYoy,
          yoy_growth_rate: branchYoy > 0 ? ((branchActual - branchYoy) / branchYoy) * 100 : 0,
          target_weight: branchTarget,
          achievement_rate: branchTarget > 0 ? (branchActual / branchTarget) * 100 : 0,
          teams,
        };
      });
      branches.sort((a, b) => a.branch.localeCompare(b.branch));

      const totalActualWeight = categories.reduce((sum: number, c: any) => sum + c.current_month_weight, 0);
      const totalLastMonthWeight = categories.reduce((sum: number, c: any) => sum + c.last_month_weight, 0);
      const totalYoyWeight = categories.reduce((sum: number, c: any) => sum + c.yoy_weight, 0);
      const totalTargetWeight = branches.reduce((sum: number, b: any) => sum + b.target_weight, 0);

      return NextResponse.json({
        success: true,
        data: {
          currentMonth: currentMonthStr,
          availableMonths,
          currentYear: currentYear.toString(),
          categories,
          branches,
          b2bTotal: {
            weight: Math.round(Number(b2bTotalData.weight) || 0),
            amount: Math.round(Number(b2bTotalData.amount) || 0),
          },
          total: {
            current_month_weight: totalActualWeight,
            current_month_amount: categories.reduce((sum: number, c: any) => sum + c.current_month_amount, 0),
            last_month_weight: totalLastMonthWeight,
            last_month_amount: categories.reduce((sum: number, c: any) => sum + c.last_month_amount, 0),
            yoy_weight: totalYoyWeight,
            yoy_growth_rate: totalYoyWeight > 0 ? ((totalActualWeight - totalYoyWeight) / totalYoyWeight) * 100 : 0,
            target_weight: totalTargetWeight,
            achievement_rate: totalTargetWeight > 0 ? (totalActualWeight / totalTargetWeight) * 100 : 0,
          },
        },
      });
    }

    if (tab === 'b2b-il') {
      const yoyMonthStr = `${lastYear}-${currentMonthStr.split('-')[1]}`;
      const lastMonthIdx = availableMonths.indexOf(currentMonthStr) - 1;
      const lastMonthStr = lastMonthIdx >= 0 ? availableMonths[lastMonthIdx] : `${currentYear}-01`;
      const monthNum = currentMonthStr.split('-')[1];

      const branchMapping = `
        CASE
          WHEN c.거래처그룹1명 = '벤츠' THEN 'MB'
          WHEN c.거래처그룹1명 = '경남사업소' THEN '창원'
          WHEN c.거래처그룹1명 LIKE '%화성%' THEN '화성'
          WHEN c.거래처그룹1명 LIKE '%남부%' THEN '남부'
          WHEN c.거래처그룹1명 LIKE '%중부%' THEN '중부'
          WHEN c.거래처그룹1명 LIKE '%서부%' THEN '서부'
          WHEN c.거래처그룹1명 LIKE '%동부%' THEN '동부'
          WHEN c.거래처그룹1명 LIKE '%제주%' THEN '제주'
          WHEN c.거래처그룹1명 LIKE '%부산%' THEN '부산'
          ELSE REPLACE(REPLACE(COALESCE(c.거래처그룹1명, ''), '사업소', ''), '지사', '')
        END
      `;

      // 1. Query B2B sales by product group
      const b2bCategoryQuery = `
        SELECT
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
          END as category,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as current_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) ELSE 0 END) as current_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) ELSE 0 END) as last_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${yoyMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as yoy_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) IN ('${currentMonthStr}', '${lastMonthStr}', '${yoyMonthStr}'))
          AND ec.b2c_팀 = 'B2B'
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY category
      `;

      // 2. Query B2B sales by branch, team, and category
      const b2bHierarchyQuery = `
        SELECT
          ${branchMapping} as branch,
          ec.b2b팀 as team,
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
          END as category,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as current_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) ELSE 0 END) as current_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${yoyMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as yoy_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) IN ('${currentMonthStr}', '${lastMonthStr}', '${yoyMonthStr}'))
          AND ec.b2c_팀 = 'B2B'
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY branch, team, category
      `;

      // 3. Query B2C for comparison
      const b2cTotalQuery = `
        SELECT
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${currentMonthStr}'
          AND ec.b2c_팀 != 'B2B'
          AND e.사원_담당_명 != '김도량'
      `;

      const [catResult, hierarchyResult, b2cResult, goalsResult] = await Promise.all([
        executeSQL(b2bCategoryQuery),
        executeSQL(b2bHierarchyQuery),
        executeSQL(b2cTotalQuery),
        executeSQL(`SELECT * FROM sales_goals WHERE year = '${currentYear}' AND month = '${monthNum}'`)
      ]);

      const catData = catResult?.rows || [];
      const hierarchyData = hierarchyResult?.rows || [];
      const b2cTotalData = b2cResult?.rows?.[0] || { weight: 0, amount: 0 };
      const goalsData = goalsResult?.rows || [];
      
      const goalsMap = new Map<string, number>(goalsData.map((g: any) => [g.target_name, Number(g.target_weight) || 0]));

      // Process Categories (Product Group Summary)
      const categories = catData.map((row: any) => {
        const currentWeight = Number(row.current_month_weight) || 0;
        const targetWeight = goalsMap.get(row.category) || 0;
        return {
          category: row.category,
          current_month_weight: Math.round(currentWeight),
          current_month_amount: Math.round(Number(row.current_month_amount) || 0),
          last_month_weight: Math.round(Number(row.last_month_weight) || 0),
          last_month_amount: Math.round(Number(row.last_month_amount) || 0),
          yoy_weight: Math.round(Number(row.yoy_weight) || 0),
          yoy_growth_rate: row.yoy_weight > 0 ? ((currentWeight - row.yoy_weight) / row.yoy_weight) * 100 : 0,
          target_weight: Math.round(targetWeight),
          achievement_rate: targetWeight > 0 ? (currentWeight / targetWeight) * 100 : 0,
        };
      });
      const order = ['MB', 'AVI + MAR', 'AUTO', 'IL'];
      categories.sort((a: any, b: any) => order.indexOf(a.category) - order.indexOf(b.category));

      // Process Hierarchy (Branch > Team > Category)
      const branchMap = new Map<string, any>();
      hierarchyData.forEach((row: any) => {
        const branchName = row.branch || '기타';
        const teamName = row.team || '기타';
        if (!branchMap.has(branchName)) {
          branchMap.set(branchName, { teams: new Map() });
        }
        const branchObj = branchMap.get(branchName);
        if (!branchObj.teams.has(teamName)) {
          branchObj.teams.set(teamName, { categories: [] });
        }
        const teamObj = branchObj.teams.get(teamName);
        
        const actualWeight = Number(row.current_month_weight) || 0;
        const lastWeight = Number(row.last_month_weight) || 0;
        const yoyWeight = Number(row.yoy_weight) || 0;
        
        teamObj.categories.push({
          category: row.category,
          current_month_weight: Math.round(actualWeight),
          current_month_amount: Math.round(Number(row.current_month_amount) || 0),
          last_month_weight: Math.round(lastWeight),
          yoy_weight: Math.round(yoyWeight),
          yoy_growth_rate: yoyWeight > 0 ? ((actualWeight - yoyWeight) / yoyWeight) * 100 : 0,
          target_weight: 0,
          achievement_rate: 0,
        });
      });

      const branches = Array.from(branchMap.entries()).map(([branchName, branchObj]) => {
        const teams = Array.from(branchObj.teams.entries()).map((entry: any) => {
          const [teamName, teamObj] = entry;
          const teamActual = teamObj.categories.reduce((sum: number, c: any) => sum + c.current_month_weight, 0);
          const teamAmount = teamObj.categories.reduce((sum: number, c: any) => sum + c.current_month_amount, 0);
          const teamLast = teamObj.categories.reduce((sum: number, c: any) => sum + c.last_month_weight, 0);
          const teamYoy = teamObj.categories.reduce((sum: number, c: any) => sum + c.yoy_weight, 0);
          const teamTarget = goalsMap.get(teamName) || 0;

          teamObj.categories.sort((a: any, b: any) => order.indexOf(a.category) - order.indexOf(b.category));

          return {
            team_name: teamName,
            current_month_weight: teamActual,
            current_month_amount: teamAmount,
            last_month_weight: teamLast,
            yoy_weight: teamYoy,
            yoy_growth_rate: teamYoy > 0 ? ((teamActual - teamYoy) / teamYoy) * 100 : 0,
            target_weight: Math.round(teamTarget),
            achievement_rate: teamTarget > 0 ? (teamActual / teamTarget) * 100 : 0,
            categories: teamObj.categories
          };
        });

        const branchActual = teams.reduce((sum: number, t: any) => sum + t.current_month_weight, 0);
        const branchAmount = teams.reduce((sum: number, t: any) => sum + t.current_month_amount, 0);
        const branchLast = teams.reduce((sum: number, t: any) => sum + t.last_month_weight, 0);
        const branchYoy = teams.reduce((sum: number, t: any) => sum + t.yoy_weight, 0);
        const branchTarget = teams.reduce((sum: number, t: any) => sum + t.target_weight, 0);

        return {
          branch: branchName,
          current_month_weight: branchActual,
          current_month_amount: branchAmount,
          last_month_weight: branchLast,
          yoy_weight: branchYoy,
          yoy_growth_rate: branchYoy > 0 ? ((branchActual - branchYoy) / branchYoy) * 100 : 0,
          target_weight: branchTarget,
          achievement_rate: branchTarget > 0 ? (branchActual / branchTarget) * 100 : 0,
          teams,
        };
      });
      branches.sort((a, b) => a.branch.localeCompare(b.branch));

      const totalActualWeight = categories.reduce((sum: number, c: any) => sum + c.current_month_weight, 0);
      const totalLastMonthWeight = categories.reduce((sum: number, c: any) => sum + c.last_month_weight, 0);
      const totalYoyWeight = categories.reduce((sum: number, c: any) => sum + c.yoy_weight, 0);
      const totalTargetWeight = branches.reduce((sum: number, b: any) => sum + b.target_weight, 0);

      return NextResponse.json({
        success: true,
        data: {
          currentMonth: currentMonthStr,
          availableMonths,
          currentYear: currentYear.toString(),
          categories,
          branches,
          b2cTotal: {
            weight: Math.round(Number(b2cTotalData.weight) || 0),
            amount: Math.round(Number(b2cTotalData.amount) || 0),
          },
          total: {
            current_month_weight: totalActualWeight,
            current_month_amount: categories.reduce((sum: number, c: any) => sum + c.current_month_amount, 0),
            last_month_weight: totalLastMonthWeight,
            last_month_amount: categories.reduce((sum: number, c: any) => sum + c.last_month_amount, 0),
            yoy_weight: totalYoyWeight,
            yoy_growth_rate: totalYoyWeight > 0 ? ((totalActualWeight - totalYoyWeight) / totalYoyWeight) * 100 : 0,
            target_weight: totalTargetWeight,
            achievement_rate: totalTargetWeight > 0 ? (totalActualWeight / totalTargetWeight) * 100 : 0,
          },
        },
      });
    }

    if (tab === 'goal-setting') {
      const selectedYear = searchParams.get('year') || currentYear.toString();
      const prevYear = (Number(selectedYear) - 1).toString();

      const branchMappingForGoal = `
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
          ELSE REPLACE(REPLACE(COALESCE(ec.전체사업소, ''), '사업소', ''), '지사', '')
        END
      `;

      const branchMappingForClients = `
        CASE
          WHEN c.거래처그룹1명 = '벤츠' THEN 'MB'
          WHEN c.거래처그룹1명 = '경남사업소' THEN '창원'
          WHEN c.거래처그룹1명 LIKE '%동부%' THEN '동부'
          WHEN c.거래처그룹1명 LIKE '%서부%' THEN '서부'
          WHEN c.거래처그룹1명 LIKE '%중부%' THEN '중부'
          WHEN c.거래처그룹1명 LIKE '%남부%' THEN '남부'
          WHEN c.거래처그룹1명 LIKE '%제주%' THEN '제주'
          WHEN c.거래처그룹1명 LIKE '%본부%' THEN '본부'
          ELSE REPLACE(REPLACE(COALESCE(c.거래처그룹1명, ''), '사업소', ''), '지사', '')
        END
      `;

      // Fetch existing goals for selected year and previous year
      const goalsQuery = `
        SELECT * FROM sales_goals 
        WHERE year IN ('${selectedYear}', '${prevYear}')
      `;
      const goalsResult = await executeSQL(goalsQuery);
      const goals = goalsResult?.rows || [];

      // 1. Category Actuals (Product Groups)
      const categoryActualQuery = `
        SELECT 
          substr(s.일자, 1, 7) as month,
          'category' as goal_type_group,
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
          END as target_name,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        WHERE s.일자 LIKE '${prevYear}-%'
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY month, target_name
      `;

      // 2. Branch Actuals
      const branchActualQuery = `
        SELECT 
          substr(s.일자, 1, 7) as month,
          'category' as goal_type_group,
          ${branchMappingForClients} as target_name,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        WHERE s.일자 LIKE '${prevYear}-%'
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL AND c.거래처그룹1명 != ''
        GROUP BY month, target_name
      `;

      // 3. Team Actuals
      const teamActualQuery = `
        SELECT 
          substr(s.일자, 1, 7) as month,
          CASE 
            WHEN ec.b2c_팀 = 'B2B' AND s.품목그룹1코드 = 'IL' THEN 'b2b-il'
            WHEN ec.b2c_팀 != 'B2B' AND s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'b2c-auto'
            ELSE 'others'
          END as goal_type_group,
          CASE
            WHEN ec.b2c_팀 = 'B2B' AND s.품목그룹1코드 = 'IL' THEN ec.b2b팀
            WHEN ec.b2c_팀 != 'B2B' AND s.품목그룹1코드 IN ('PVL', 'CVL') THEN ec.b2c_팀
            ELSE ''
          END as target_name,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 LIKE '${prevYear}-%'
          AND e.사원_담당_명 != '김도량'
        GROUP BY month, goal_type_group, target_name
      `;

      const [catActualRes, brActualRes, teamActualRes] = await Promise.all([
        executeSQL(categoryActualQuery),
        executeSQL(branchActualQuery),
        executeSQL(teamActualQuery)
      ]);

      const prevYearActual = [
        ...(catActualRes?.rows || []),
        ...(brActualRes?.rows || []),
        ...(teamActualRes?.rows || []).filter((r: any) => r.goal_type_group !== 'others')
      ];

      // Fetch all possible team names and branch names
      const allTeamsQuery = `
        SELECT DISTINCT b2c_팀 as name, 'b2c-auto' as type
        FROM employee_category
        WHERE b2c_팀 IS NOT NULL AND b2c_팀 != '' AND b2c_팀 != 'B2B'
        UNION ALL
        SELECT DISTINCT b2b팀 as name, 'b2b-il' as type
        FROM employee_category
        WHERE b2b팀 IS NOT NULL AND b2b팀 != ''
        UNION ALL
        SELECT DISTINCT ${branchMappingForGoal} as name, 'branch' as type
        FROM employee_category ec
        WHERE ec.전체사업소 IS NOT NULL AND ec.전체사업소 != ''
      `;
      const allTeamsResult = await executeSQL(allTeamsQuery);
      const allTeams = allTeamsResult?.rows || [];

      return NextResponse.json({
        success: true,
        data: {
          goals,
          prevYearActual,
          allTeams,
          year: selectedYear,
          prevYear
        }
      });
    }

    return NextResponse.json({ success: true, data: { message: 'Tab not implemented' } });
  } catch (error: any) {
    console.error('Closing Meeting API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Check if it's a bulk update
    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ success: true, count: 0 });

      const rows = body.map(goal => ({
        year: goal.year,
        month: goal.month,
        goal_type: goal.goal_type,
        target_name: goal.target_name,
        target_weight: goal.target_weight || 0,
        target_amount: goal.target_amount || 0
      }));

      await insertRows('sales_goals', rows);
      return NextResponse.json({ success: true, count: body.length });
    }

    const { year, month, goal_type, target_name, target_weight, target_amount } = body;

    if (!year || !month || !goal_type || !target_name) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Try to update first
    await updateRows('sales_goals', {
      target_weight: target_weight || 0,
      target_amount: target_amount || 0
    }, { 
      filters: { 
        year: year.toString(), 
        month: month.toString(), 
        goal_type: goal_type, 
        target_name: target_name 
      } 
    });

    // Ensure it exists (insertRows handles upsert logic internally)
    await insertRows('sales_goals', [{
      year,
      month,
      goal_type,
      target_name,
      target_weight: target_weight || 0,
      target_amount: target_amount || 0
    }]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Closing Meeting POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
