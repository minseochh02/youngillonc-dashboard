import { NextResponse } from 'next/server';
import { executeSQL, insertRows, updateRows } from '@/egdesk-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'monthly-summary';
    const selectedMonthParam = searchParams.get('month');
    const includeVat = searchParams.get('includeVat') === 'true';
    const divisor = includeVat ? '1.0' : '1.1';

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
        SELECT p.일자, p.거래처코드, p.품목코드, p.중량, p.합계 as 합계, p.창고코드, i.품목그룹1코드
        FROM east_division_purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        UNION ALL
        SELECT p.일자, p.거래처코드, p.품목코드, p.중량, p.합계 as 합계, p.창고코드, i.품목그룹1코드
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
      ) WHERE 일자 IS NOT NULL
        AND 일자 != ''
        AND substr(일자, 1, 4) BETWEEN '2017' AND '2099'
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
    const monthNum = currentMonthStr.split('-')[1];

    // Common Grand Totals for all tabs
    const getGrandTotals = async () => {
      const b2cTotalQuery = `
        SELECT
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as ytd_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as ytd_amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}')
          AND ec.b2c_팀 != 'B2B'
          AND e.사원_담당_명 != '김도량'
      `;

      const b2bTotalQuery = `
        SELECT
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as ytd_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as ytd_amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}')
          AND ec.b2c_팀 = 'B2B'
          AND e.사원_담당_명 != '김도량'
      `;

      const [b2cRes, b2bRes] = await Promise.all([
        executeSQL(b2cTotalQuery),
        executeSQL(b2bTotalQuery)
      ]);

      const b2c = b2cRes?.rows?.[0] || { weight: 0, amount: 0, ytd_weight: 0, ytd_amount: 0 };
      const b2b = b2bRes?.rows?.[0] || { weight: 0, amount: 0, ytd_weight: 0, ytd_amount: 0 };

      return {
        b2c: {
          weight: Math.round(Number(b2c.weight) || 0),
          amount: Math.round(Number(b2c.amount) || 0),
          ytd_weight: Math.round(Number(b2c.ytd_weight) || 0),
          ytd_amount: Math.round(Number(b2c.ytd_amount) || 0),
        },
        b2b: {
          weight: Math.round(Number(b2b.weight) || 0),
          amount: Math.round(Number(b2b.amount) || 0),
          ytd_weight: Math.round(Number(b2b.ytd_weight) || 0),
          ytd_amount: Math.round(Number(b2b.ytd_amount) || 0),
        }
      };
    };

    if (tab === 'monthly-summary') {
      const monthlySummaryCategoryCase = `
        CASE
          WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
          WHEN s.품목그룹1코드 = 'AVI' THEN 'AVI'
          WHEN s.품목그룹1코드 = 'MAR' THEN 'MAR'
          WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
          WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
          ELSE '기타'
        END
      `;
      const monthlySummaryPurchaseCategoryCase = `
        CASE
          WHEN p.품목그룹1코드 = 'MB' THEN 'MB'
          WHEN p.품목그룹1코드 = 'AVI' THEN 'AVI'
          WHEN p.품목그룹1코드 = 'MAR' THEN 'MAR'
          WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
          WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
          ELSE '기타'
        END
      `;

      // Query sales by month and category (MB, AVI, MAR, AUTO, IL, 기타)
      const salesQuery = `
        SELECT
          substr(s.일자, 1, 7) as month,
          ${monthlySummaryCategoryCase} as category,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
          AND ec.전체사업소 IS NOT NULL
        GROUP BY 1, 2
      `;

      // Query purchases by month and category
      const purchasesQuery = `
        SELECT
          substr(p.일자, 1, 7) as month,
          ${monthlySummaryPurchaseCategoryCase} as category,
          SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(p.합계, ',', '') AS NUMERIC) / ${divisor}) as amount
        FROM (${basePurchasesSubquery}) p
        WHERE p.일자 IS NOT NULL
        GROUP BY 1, 2
      `;

      // Last-year monthly sales total (same scope as monthly-summary sales: incl. 기타)
      const lastYearSalesQuery = `
        SELECT
          substr(s.일자, 1, 7) as month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 LIKE '${lastYear}-%'
          AND s.일자 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
          AND ec.전체사업소 IS NOT NULL
        GROUP BY month
      `;

      // Query goals from new schema - aggregate employee goals by category
      const goalsQuery = `
        SELECT
          month,
          CASE
            WHEN category = 'AVI+MAR' THEN 'AVI + MAR'
            ELSE category
          END as category,
          SUM(target_weight) as target_weight,
          SUM(target_amount) as target_amount
        FROM sales_goals
        WHERE year = '${currentYear}'
          AND category_type = 'division'
          AND category IN ('MB', 'IL', 'AUTO', 'AVI+MAR')
        GROUP BY month, category
      `;

      const [salesResult, purchasesResult, lastYearSalesResult, goalsResult] = await Promise.all([
        executeSQL(salesQuery),
        executeSQL(purchasesQuery),
        executeSQL(lastYearSalesQuery),
        executeSQL(goalsQuery)
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

      const goalsMap = new Map<string, { weight: number; amount: number }>();
      goalsData.forEach((row: any) => {
        const key = `${row.month}_${row.category}`;
        goalsMap.set(key, { weight: Number(row.target_weight) || 0, amount: Number(row.target_amount) || 0 });
      });

      // Raw category maps for detailed AUTO(PVL/CVL) breakdown
      const salesRawCategoryQuery = `
        SELECT
          substr(s.일자, 1, 7) as month,
          s.품목그룹1코드 as raw_category,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 IS NOT NULL
          AND s.품목그룹1코드 IN ('PVL', 'CVL')
          AND e.사원_담당_명 != '김도량'
          AND ec.전체사업소 IS NOT NULL
        GROUP BY 1, 2
      `;
      const purchasesRawCategoryQuery = `
        SELECT
          substr(p.일자, 1, 7) as month,
          p.품목그룹1코드 as raw_category,
          SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
        FROM (${basePurchasesSubquery}) p
        WHERE p.일자 IS NOT NULL
          AND p.품목그룹1코드 IN ('PVL', 'CVL')
        GROUP BY 1, 2
      `;
      const [salesRawCategoryResult, purchasesRawCategoryResult] = await Promise.all([
        executeSQL(salesRawCategoryQuery),
        executeSQL(purchasesRawCategoryQuery),
      ]);
      const salesRawCategoryMap = new Map<string, number>();
      (salesRawCategoryResult?.rows || []).forEach((row: any) => {
        salesRawCategoryMap.set(`${row.month}_${row.raw_category}`, Number(row.weight) || 0);
      });
      const purchasesRawCategoryMap = new Map<string, number>();
      (purchasesRawCategoryResult?.rows || []).forEach((row: any) => {
        purchasesRawCategoryMap.set(`${row.month}_${row.raw_category}`, Number(row.weight) || 0);
      });

      /** Division goals: DB still stores combined AVI+MAR; split by that month's AVI vs MAR 실적. */
      const getDivisionGoal = (
        cat: string,
        monthNum: string,
        monthStr: string
      ): { weight: number; amount: number } => {
        if (cat === 'AVI' || cat === 'MAR') {
          const combined = goalsMap.get(`${monthNum}_AVI + MAR`) || { weight: 0, amount: 0 };
          const own = goalsMap.get(`${monthNum}_${cat}`) || { weight: 0, amount: 0 };
          if (own.weight > 0 || own.amount > 0) return own;
          if (combined.weight <= 0 && combined.amount <= 0) return { weight: 0, amount: 0 };
          const wAvi = salesMap.get(`${monthStr}_AVI`)?.weight || 0;
          const wMar = salesMap.get(`${monthStr}_MAR`)?.weight || 0;
          const tot = wAvi + wMar;
          const share = tot > 0 ? (cat === 'AVI' ? wAvi / tot : wMar / tot) : 0.5;
          return {
            weight: combined.weight * share,
            amount: combined.amount * share,
          };
        }
        if (cat === '기타') return { weight: 0, amount: 0 };
        return goalsMap.get(`${monthNum}_${cat}`) || { weight: 0, amount: 0 };
      };

      const categories = ['MB', 'AVI', 'MAR', 'AUTO', 'IL', '기타'];
      const monthlyData = [];
      let ytdPurchase = 0, ytdPurchaseAmount = 0, ytdSales = 0, ytdSalesAmount = 0, ytdInventory = 0, ytdTargetWeight = 0;
      let lastYearYtdPurchase = 0, lastYearYtdPurchaseAmount = 0, lastYearYtdSales = 0, lastYearYtdSalesAmount = 0, lastYearYtdInventory = 0;

      // Calculate last year's cumulative up to the same month
      const selectedMonthNum = currentMonthStr.split('-')[1];
      const lastYearCutoff = `${lastYear}-${selectedMonthNum}`;

      // Also track last year by category
      const lastYearByCategory = new Map<string, { purchase: number, sales: number, inventory: number }>();
      categories.forEach(cat => lastYearByCategory.set(cat, { purchase: 0, sales: 0, inventory: 0 }));

      for (const monthStr of availableMonths) {
        if (monthStr <= lastYearCutoff && monthStr.startsWith(String(lastYear))) {
          let purchaseWeight = 0, purchaseAmount = 0, salesWeight = 0, salesAmount = 0;

          categories.forEach(cat => {
            const key = `${monthStr}_${cat}`;
            const s = salesMap.get(key) || { weight: 0, amount: 0 };
            const p = purchasesMap.get(key) || { weight: 0, amount: 0 };
            purchaseWeight += p.weight;
            purchaseAmount += p.amount;
            salesWeight += s.weight;
            salesAmount += s.amount;

            // Track by category
            const catData = lastYearByCategory.get(cat)!;
            catData.purchase += p.weight;
            catData.sales += s.weight;
            catData.inventory += (p.weight - s.weight);
          });

          lastYearYtdPurchase += purchaseWeight;
          lastYearYtdPurchaseAmount += purchaseAmount;
          lastYearYtdSales += salesWeight;
          lastYearYtdSalesAmount += salesAmount;
          lastYearYtdInventory += (purchaseWeight - salesWeight);
        }
      }

      // Convert last year category data to array
      const lastYearCategoryBreakdown = categories.map(cat => {
        const data = lastYearByCategory.get(cat)!;
        return {
          category: cat,
          purchase_weight: Math.round(data.purchase),
          sales_weight: Math.round(data.sales),
          inventory_weight: Math.round(data.inventory),
        };
      });

      for (const monthStr of availableMonths) {
        let purchaseWeight = 0, purchaseAmount = 0, salesWeight = 0, salesAmount = 0, monthTargetWeight = 0;
        const monthNum = monthStr.split('-')[1];

        const breakdown = categories.map(cat => {
          const key = `${monthStr}_${cat}`;
          const s = salesMap.get(key) || { weight: 0, amount: 0 };
          const p = purchasesMap.get(key) || { weight: 0, amount: 0 };
          const g = getDivisionGoal(cat, monthNum, monthStr);

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
      }

      // True YTD for the selected year only (matches UI "N년 · 1월~M월 누계")
      const ytdStart = `${currentYear}-01`;
      for (const monthStr of availableMonths) {
        if (monthStr < ytdStart || monthStr > currentMonthStr) continue;
        const monthNum = monthStr.split('-')[1];
        let monthTargetWeight = 0;
        categories.forEach((cat) => {
          const key = `${monthStr}_${cat}`;
          const s = salesMap.get(key) || { weight: 0, amount: 0 };
          const p = purchasesMap.get(key) || { weight: 0, amount: 0 };
          const g = getDivisionGoal(cat, monthNum, monthStr);
          ytdPurchase += p.weight;
          ytdPurchaseAmount += p.amount;
          ytdSales += s.weight;
          ytdSalesAmount += s.amount;
          ytdInventory += p.weight - s.weight;
          monthTargetWeight += g.weight;
        });
        ytdTargetWeight += monthTargetWeight;
      }

      const currentYearCategoryYtd = new Map<string, { purchase: number; sales: number; inventory: number; target: number }>();
      categories.forEach((cat) =>
        currentYearCategoryYtd.set(cat, { purchase: 0, sales: 0, inventory: 0, target: 0 })
      );
      for (const monthStr of availableMonths) {
        if (monthStr < ytdStart || monthStr > currentMonthStr) continue;
        const monthNum = monthStr.split('-')[1];
        categories.forEach((cat) => {
          const key = `${monthStr}_${cat}`;
          const s = salesMap.get(key) || { weight: 0, amount: 0 };
          const p = purchasesMap.get(key) || { weight: 0, amount: 0 };
          const g = getDivisionGoal(cat, monthNum, monthStr);
          const agg = currentYearCategoryYtd.get(cat)!;
          agg.purchase += p.weight;
          agg.sales += s.weight;
          agg.inventory += p.weight - s.weight;
          agg.target += g.weight;
        });
      }
      const yearToDateCategoryBreakdown = categories.map((cat) => {
        const data = currentYearCategoryYtd.get(cat)!;
        return {
          category: cat,
          purchase_weight: Math.round(data.purchase),
          sales_weight: Math.round(data.sales),
          inventory_weight: Math.round(data.inventory),
          target_weight: Math.round(data.target),
          achievement_rate: data.target > 0 ? (data.sales / data.target) * 100 : 0,
        };
      });

      const selectedMonthNumOnly = currentMonthStr.split('-')[1];
      const sumRawByRange = (
        rawCategory: 'PVL' | 'CVL',
        isCurrentYearRange: boolean,
        isSales: boolean
      ) => {
        let total = 0;
        for (const monthStr of availableMonths) {
          if (isCurrentYearRange) {
            if (monthStr < ytdStart || monthStr > currentMonthStr) continue;
          } else {
            if (!(monthStr <= lastYearCutoff && monthStr.startsWith(String(lastYear)))) continue;
          }
          const map = isSales ? salesRawCategoryMap : purchasesRawCategoryMap;
          total += map.get(`${monthStr}_${rawCategory}`) || 0;
        }
        return Math.round(total);
      };
      const currentMonthData =
        monthlyData.find((m: { month: string }) => m.month === currentMonthStr) ?? {
          month: currentMonthStr,
          purchase_weight: 0,
          purchase_amount: 0,
          sales_weight: 0,
          sales_amount: 0,
          inventory_weight: 0,
          inventory_amount: 0,
          target_weight: 0,
          achievement_rate: 0,
          yoy_growth_rate: 0,
          breakdown: categories.map((cat) => {
            const g = getDivisionGoal(cat, selectedMonthNumOnly, currentMonthStr);
            return {
              category: cat,
              purchase_weight: 0,
              sales_weight: 0,
              inventory_weight: 0,
              target_weight: Math.round(g.weight),
              achievement_rate: 0,
            };
          }),
        };

      return NextResponse.json({
        success: true,
        data: {
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
          currentMonth: currentMonthStr,
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
            categoryBreakdown: yearToDateCategoryBreakdown,
            autoBreakdown: {
              PVL: {
                sales_weight: sumRawByRange('PVL', true, true),
                purchase_weight: sumRawByRange('PVL', true, false),
              },
              CVL: {
                sales_weight: sumRawByRange('CVL', true, true),
                purchase_weight: sumRawByRange('CVL', true, false),
              },
            },
          },
          lastYearToDate: {
            purchase_weight: Math.round(lastYearYtdPurchase),
            purchase_amount: Math.round(lastYearYtdPurchaseAmount),
            sales_weight: Math.round(lastYearYtdSales),
            sales_amount: Math.round(lastYearYtdSalesAmount),
            inventory_weight: Math.round(lastYearYtdInventory),
            inventory_amount: Math.round(lastYearYtdPurchaseAmount - lastYearYtdSalesAmount),
            categoryBreakdown: lastYearCategoryBreakdown,
            autoBreakdown: {
              PVL: {
                sales_weight: sumRawByRange('PVL', false, true),
                purchase_weight: sumRawByRange('PVL', false, false),
              },
              CVL: {
                sales_weight: sumRawByRange('CVL', false, true),
                purchase_weight: sumRawByRange('CVL', false, false),
              },
            },
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
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${currentMonthStr}'
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL
          AND c.거래처그룹1명 != ''
        GROUP BY branch
      `;

      const monthNum = currentMonthStr.split('-')[1];

      // Branch mapping for employee_category (전체사업소 field)
      const employeeBranchMapping = `
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
          WHEN ec.전체사업소 LIKE '%본부%' THEN '본부'
          ELSE REPLACE(REPLACE(COALESCE(ec.전체사업소, ''), '사업소', ''), '지사', '')
        END
      `;

      // Aggregate goals by branch using employee_category join
      const goalsQuery = `
        SELECT
          ${employeeBranchMapping} as branch,
          SUM(sg.target_weight) as target_weight
        FROM sales_goals sg
        LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
        WHERE sg.year = '${currentYear}'
          AND sg.month = '${monthNum}'
          AND sg.category_type = 'division'
          AND ec.전체사업소 IS NOT NULL
        GROUP BY branch
      `;

      const [actualSalesResult, goalsResult, grandTotals] = await Promise.all([
        executeSQL(actualSalesQuery),
        executeSQL(goalsQuery),
        getGrandTotals()
      ]);

      const actualSalesData = actualSalesResult?.rows || [];
      const goalsData = goalsResult?.rows || [];
      const goalsMap = new Map<string, number>(goalsData.map((g: any) => [g.branch, Number(g.target_weight) || 0]));

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
          grandTotals
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
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
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
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${lastYearMonthStr}'
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL
          AND c.거래처그룹1명 != ''
        GROUP BY branch
      `;

      const [currentYearResult, lastYearResult, grandTotals] = await Promise.all([
        executeSQL(currentYearQuery),
        executeSQL(lastYearQuery),
        getGrandTotals()
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
          grandTotals
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
            WHEN ec.b2c_팀 = 'B2B' THEN COALESCE(ec.b2b팀, '미분류')
            ELSE COALESCE(ec.b2c_팀, '미분류')
          END as team,
          e.사원_담당_명 as employee,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
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
            WHEN ec.b2c_팀 = 'B2B' THEN COALESCE(ec.b2b팀, '미분류')
            ELSE COALESCE(ec.b2c_팀, '미분류')
          END as team,
          e.사원_담당_명 as employee,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE substr(s.일자, 1, 7) = '${lastMonthStr}'
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL
          AND c.거래처그룹1명 != ''
        GROUP BY branch, team, employee
      `;

      const [currentMonthResult, lastMonthResult, grandTotals] = await Promise.all([
        executeSQL(currentMonthQuery),
        executeSQL(lastMonthQuery),
        getGrandTotals()
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
          grandTotals
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
            WHEN s.품목그룹1코드 = 'AVI' THEN 'AVI'
            WHEN s.품목그룹1코드 = 'MAR' THEN 'MAR'
            WHEN s.품목그룹1코드 = 'PVL' THEN 'PVL'
            WHEN s.품목그룹1코드 = 'CVL' THEN 'CVL'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
            ELSE '기타'
          END as category,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as current_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as current_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as last_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${yoyMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as yoy_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) IN ('${currentMonthStr}', '${lastMonthStr}', '${yoyMonthStr}'))
          AND ec.b2c_팀 != 'B2B'
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
            WHEN s.품목그룹1코드 = 'AVI' THEN 'AVI'
            WHEN s.품목그룹1코드 = 'MAR' THEN 'MAR'
            WHEN s.품목그룹1코드 = 'PVL' THEN 'PVL'
            WHEN s.품목그룹1코드 = 'CVL' THEN 'CVL'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
            ELSE '기타'
          END as category,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as current_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as current_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${yoyMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as yoy_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) IN ('${currentMonthStr}', '${lastMonthStr}', '${yoyMonthStr}'))
          AND ec.b2c_팀 != 'B2B'
          AND e.사원_담당_명 != '김도량'
        GROUP BY branch, team, category
      `;

      // Query goals aggregated by category and team for B2C AUTO
      const b2cGoalsQuery = `
        SELECT
          category,
          ec.b2c_팀 as team,
          SUM(sg.target_weight) as target_weight
        FROM sales_goals sg
        LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
        WHERE sg.year = '${currentYear}'
          AND sg.month = '${monthNum}'
          AND sg.category_type = 'division'
          AND sg.category IN ('AUTO', 'PVL', 'CVL')
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
        GROUP BY category, team
      `;

      const [catResult, hierarchyResult, goalsResult, grandTotals] = await Promise.all([
        executeSQL(b2cCategoryQuery),
        executeSQL(b2cHierarchyQuery),
        executeSQL(b2cGoalsQuery),
        getGrandTotals()
      ]);

      const catData = catResult?.rows || [];
      const hierarchyData = hierarchyResult?.rows || [];
      const goalsData = goalsResult?.rows || [];

      // Build goalsMap for categories (aggregate all teams)
      const categoryGoalsMap = new Map<string, number>();
      const teamGoalsMap = new Map<string, number>();

      goalsData.forEach((g: any) => {
        // Category-level goals
        const catKey = g.category;
        categoryGoalsMap.set(catKey, (categoryGoalsMap.get(catKey) || 0) + (Number(g.target_weight) || 0));

        // Team-level goals
        const teamKey = g.team;
        teamGoalsMap.set(teamKey, (teamGoalsMap.get(teamKey) || 0) + (Number(g.target_weight) || 0));
      });

      const goalsMap = categoryGoalsMap; // For backward compatibility with category lookup

      const yearlyHierarchyQuery = `
        SELECT
          substr(s.일자, 1, 4) as year,
          ${branchMapping} as branch,
          ec.b2c_팀 as team,
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 = 'AVI' THEN 'AVI'
            WHEN s.품목그룹1코드 = 'MAR' THEN 'MAR'
            WHEN s.품목그룹1코드 = 'PVL' THEN 'PVL'
            WHEN s.품목그룹1코드 = 'CVL' THEN 'CVL'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
            ELSE '기타'
          END as category,
          s.품목그룹1코드 as raw_category,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND e.사원_담당_명 != '김도량'
          AND substr(s.일자, 6, 2) <= '${monthNum}'
        GROUP BY 1, 2, 3, 4, 5
      `;
      const yearlyGoalsQuery = `
        SELECT
          sg.year as year,
          ${branchMapping} as branch,
          ec.b2c_팀 as team,
          CASE
            WHEN sg.category IN ('PVL', 'CVL') THEN sg.category
            ELSE sg.category
          END as category,
          SUM(sg.target_weight) as target_weight
        FROM sales_goals sg
        LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
        WHERE sg.category_type = 'division'
          AND sg.category IN ('PVL', 'CVL')
          AND ec.b2c_팀 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND sg.month <= '${monthNum}'
        GROUP BY 1, 2, 3, 4
      `;
      const yearlyPurchaseQuery = `
        SELECT
          substr(p.일자, 1, 4) as year,
          CASE
            WHEN p.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN p.품목그룹1코드 = 'AVI' THEN 'AVI'
            WHEN p.품목그룹1코드 = 'MAR' THEN 'MAR'
            WHEN p.품목그룹1코드 = 'PVL' THEN 'PVL'
            WHEN p.품목그룹1코드 = 'CVL' THEN 'CVL'
            WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
            ELSE '기타'
          END as category,
          SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as purchase_weight
        FROM (${basePurchasesSubquery}) p
        LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE p.일자 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND substr(p.일자, 6, 2) <= '${monthNum}'
        GROUP BY 1, 2
      `;
      const yearlyB2BCategoryQuery = `
        SELECT
          substr(s.일자, 1, 4) as year,
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 = 'AVI' THEN 'AVI'
            WHEN s.품목그룹1코드 = 'MAR' THEN 'MAR'
            WHEN s.품목그룹1코드 = 'PVL' THEN 'PVL'
            WHEN s.품목그룹1코드 = 'CVL' THEN 'CVL'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
            ELSE '기타'
          END as category,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 IS NOT NULL
          AND ec.b2c_팀 = 'B2B'
          AND e.사원_담당_명 != '김도량'
          AND substr(s.일자, 6, 2) <= '${monthNum}'
        GROUP BY 1, 2
      `;
      const [yearlyHierarchyResult, yearlyGoalsResult, yearlyPurchaseResult, yearlyB2BCategoryResult] = await Promise.all([
        executeSQL(yearlyHierarchyQuery),
        executeSQL(yearlyGoalsQuery),
        executeSQL(yearlyPurchaseQuery),
        executeSQL(yearlyB2BCategoryQuery),
      ]);
      const yearlyRows = yearlyHierarchyResult?.rows || [];
      const yearlyGoalRows = yearlyGoalsResult?.rows || [];
      const yearlyPurchaseRows = yearlyPurchaseResult?.rows || [];
      const yearlyB2BCategoryRows = yearlyB2BCategoryResult?.rows || [];
      const categoryOrder = ['MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL', '기타'];
      const yearlyMap = new Map<string, any>();
      const yearlyAutoRawMap = new Map<string, { PVL: number; CVL: number }>();
      yearlyRows.forEach((r: any) => {
        const year = String(r.year);
        if (!yearlyMap.has(year)) {
          const categoriesMap = new Map<string, any>();
          categoryOrder.forEach((c) => categoriesMap.set(c, { category: c, sales_weight: 0, purchase_weight: 0, target_weight: 0, branchesMap: new Map() }));
          yearlyMap.set(year, categoriesMap);
        }
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const cat = categoriesMap.get(r.category);
        if (!cat) return;
        const weight = Number(r.sales_weight) || 0;
        cat.sales_weight += weight;
        if (!cat.branchesMap.has(r.branch)) {
          cat.branchesMap.set(r.branch, { branch: r.branch, sales_weight: 0, target_weight: 0, teamsMap: new Map() });
        }
        const branch = cat.branchesMap.get(r.branch);
        branch.sales_weight += weight;
        const teamObj = branch.teamsMap.get(r.team) || { sales_weight: 0, target_weight: 0 };
        teamObj.sales_weight += weight;
        branch.teamsMap.set(r.team, teamObj);

        if (r.raw_category === 'PVL' || r.raw_category === 'CVL') {
          const auto = yearlyAutoRawMap.get(year) || { PVL: 0, CVL: 0 };
          if (r.raw_category === 'PVL') auto.PVL += weight;
          if (r.raw_category === 'CVL') auto.CVL += weight;
          yearlyAutoRawMap.set(year, auto);
        }
      });
      yearlyGoalRows.forEach((r: any) => {
        const year = String(r.year);
        if (!yearlyMap.has(year)) {
          const categoriesMap = new Map<string, any>();
          categoryOrder.forEach((c) => categoriesMap.set(c, { category: c, sales_weight: 0, purchase_weight: 0, target_weight: 0, branchesMap: new Map() }));
          yearlyMap.set(year, categoriesMap);
        }
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const cat = categoriesMap.get(r.category);
        if (!cat) return;
        const targetWeight = Number(r.target_weight) || 0;
        cat.target_weight += targetWeight;
        if (!cat.branchesMap.has(r.branch)) {
          cat.branchesMap.set(r.branch, { branch: r.branch, sales_weight: 0, target_weight: 0, teamsMap: new Map() });
        }
        const branch = cat.branchesMap.get(r.branch);
        branch.target_weight += targetWeight;
        const teamObj = branch.teamsMap.get(r.team) || { sales_weight: 0, target_weight: 0 };
        teamObj.target_weight += targetWeight;
        branch.teamsMap.set(r.team, teamObj);
      });
      yearlyPurchaseRows.forEach((r: any) => {
        const year = String(r.year);
        if (!yearlyMap.has(year)) {
          const categoriesMap = new Map<string, any>();
          categoryOrder.forEach((c) => categoriesMap.set(c, { category: c, sales_weight: 0, purchase_weight: 0, target_weight: 0, branchesMap: new Map() }));
          yearlyMap.set(year, categoriesMap);
        }
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const cat = categoriesMap.get(r.category);
        if (cat) cat.purchase_weight += Number(r.purchase_weight) || 0;
      });
      const yearlyB2BCategoryMap = new Map<string, Map<string, number>>();
      yearlyB2BCategoryRows.forEach((r: any) => {
        const year = String(r.year);
        if (!yearlyB2BCategoryMap.has(year)) yearlyB2BCategoryMap.set(year, new Map<string, number>());
        const catMap = yearlyB2BCategoryMap.get(year)!;
        catMap.set(r.category, (catMap.get(r.category) || 0) + (Number(r.sales_weight) || 0));
      });
      const years = Array.from(yearlyMap.keys()).sort((a, b) => Number(b) - Number(a));
      const yearlySummary = years.map((year) => {
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const b2cTotal = Array.from(categoriesMap.values()).reduce((sum, c) => sum + c.sales_weight, 0);
        const b2bTotal = Array.from(yearlyB2BCategoryMap.get(year)?.values() || []).reduce((sum, v) => sum + Number(v || 0), 0);
        const total = b2cTotal + b2bTotal;
        const purchaseTotal = Array.from(categoriesMap.values()).reduce((sum, c) => sum + c.purchase_weight, 0);
        const target = Array.from(categoriesMap.values()).reduce((sum, c) => sum + c.target_weight, 0);
        const prevMap = yearlyMap.get(String(Number(year) - 1)) as Map<string, any> | undefined;
        const prevB2cTotal = prevMap ? Array.from(prevMap.values()).reduce((sum, c) => sum + c.sales_weight, 0) : 0;
        const prevB2bTotal = Array.from(yearlyB2BCategoryMap.get(String(Number(year) - 1))?.values() || []).reduce((sum, v) => sum + Number(v || 0), 0);
        const prevTotal = prevB2cTotal + prevB2bTotal;
        return {
          year,
          sales_weight: Math.round(total),
          last_year_sales_weight: Math.round(prevTotal),
          purchase_weight: Math.round(purchaseTotal),
          yoy_growth_rate: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0,
          target_weight: Math.round(target),
          achievement_rate: target > 0 ? (total / target) * 100 : 0,
        };
      });
      const yearlyCategoryBreakdown = years.map((year) => {
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const prevMap = yearlyMap.get(String(Number(year) - 1)) as Map<string, any> | undefined;
        return {
          year,
          categories: categoryOrder.map((category) => {
            const curr = categoriesMap.get(category) || { sales_weight: 0, purchase_weight: 0, target_weight: 0, branchesMap: new Map() };
            const prev = prevMap?.get(category) || { sales_weight: 0 };
            const b2bCurrent = Number(yearlyB2BCategoryMap.get(year)?.get(category) || 0);
            const b2bPrev = Number(yearlyB2BCategoryMap.get(String(Number(year) - 1))?.get(category) || 0);
            return {
              category,
              sales_weight: Math.round(curr.sales_weight),
              last_year_sales_weight: Math.round(prev.sales_weight),
              purchase_weight: Math.round(curr.purchase_weight),
              yoy_growth_rate: prev.sales_weight > 0 ? ((curr.sales_weight - prev.sales_weight) / prev.sales_weight) * 100 : 0,
              target_weight: Math.round(curr.target_weight),
              achievement_rate: curr.target_weight > 0 ? (curr.sales_weight / curr.target_weight) * 100 : 0,
              b2b_total: {
                sales_weight: Math.round(b2bCurrent),
                last_year_sales_weight: Math.round(b2bPrev),
                yoy_growth_rate: b2bPrev > 0 ? ((b2bCurrent - b2bPrev) / b2bPrev) * 100 : 0,
              },
              branches: Array.from(curr.branchesMap.values())
                .sort((a: any, b: any) => String(a.branch).localeCompare(String(b.branch)))
                .map((b: any) => ({
                  branch: b.branch,
                  sales_weight: Math.round(b.sales_weight),
                  last_year_sales_weight: Math.round(prev.branchesMap?.get(b.branch)?.sales_weight || 0),
                  yoy_growth_rate: (prev.branchesMap?.get(b.branch)?.sales_weight || 0) > 0
                    ? ((b.sales_weight - (prev.branchesMap?.get(b.branch)?.sales_weight || 0)) / (prev.branchesMap?.get(b.branch)?.sales_weight || 0)) * 100
                    : 0,
                  target_weight: Math.round(b.target_weight || 0),
                  achievement_rate: (b.target_weight || 0) > 0 ? (b.sales_weight / b.target_weight) * 100 : 0,
                  teams: Array.from(b.teamsMap.entries())
                    .sort((a: any, b: any) => String(a[0]).localeCompare(String(b[0])))
                    .map(([teamName, teamData]: any) => {
                      const prevTeamSales = Number(prev.branchesMap?.get(b.branch)?.teamsMap?.get(teamName)?.sales_weight || 0);
                      return {
                        team_name: teamName,
                        sales_weight: Math.round(Number(teamData?.sales_weight) || 0),
                        last_year_sales_weight: Math.round(prevTeamSales),
                        yoy_growth_rate: prevTeamSales > 0 ? (((Number(teamData?.sales_weight) || 0) - prevTeamSales) / prevTeamSales) * 100 : 0,
                        target_weight: Math.round(Number(teamData?.target_weight) || 0),
                        achievement_rate: (Number(teamData?.target_weight) || 0) > 0
                          ? ((Number(teamData?.sales_weight) || 0) / Number(teamData?.target_weight)) * 100
                          : 0,
                      };
                    }),
                })),
            };
          }),
        };
      });
      const yearlyAutoBreakdown = years.map((year) => {
        const current = yearlyAutoRawMap.get(year) || { PVL: 0, CVL: 0 };
        const prev = yearlyAutoRawMap.get(String(Number(year) - 1)) || { PVL: 0, CVL: 0 };
        return {
          year,
          PVL: { sales_weight: Math.round(current.PVL), last_year_sales_weight: Math.round(prev.PVL) },
          CVL: { sales_weight: Math.round(current.CVL), last_year_sales_weight: Math.round(prev.CVL) },
        };
      });

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
      const order = ['MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL', '기타'];
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
          const teamTarget = teamGoalsMap.get(teamName) || 0;

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
          yearlySummary,
          yearlyCategoryBreakdown,
          yearlyAutoBreakdown,
          b2bTotal: grandTotals.b2b,
          total: {
            current_month_weight: totalActualWeight,
            current_month_amount: categories.reduce((sum: number, c: any) => sum + c.current_month_amount, 0),
            ytd_weight: grandTotals.b2c.ytd_weight + grandTotals.b2b.ytd_weight,
            ytd_amount: grandTotals.b2c.ytd_amount + grandTotals.b2b.ytd_amount,
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

      // 사업소: employee_category 전체사업소 기준 (clients.거래처그룹1명 미존재 DB·yearlyGoals 등에서도 동작)
      const branchMapping = `
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
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as current_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as last_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${yoyMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as yoy_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
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
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as current_month_amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${lastMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_month_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${yoyMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as yoy_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
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
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) = '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as amount,
          SUM(CASE WHEN substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as ytd_weight,
          SUM(CASE WHEN substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}' THEN CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor} ELSE 0 END) as ytd_amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}')
          AND ec.b2c_팀 != 'B2B'
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
      `;

      // 4. Query current division YTD for comparison
      const b2bYtdQuery = `
        SELECT
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE (substr(s.일자, 1, 7) >= '${currentYear}-01' AND substr(s.일자, 1, 7) <= '${currentMonthStr}')
          AND ec.b2c_팀 = 'B2B'
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
      `;

      // Query goals aggregated by category and team for B2B IL
      const b2bGoalsQuery = `
        SELECT
          category,
          ec.b2b팀 as team,
          SUM(sg.target_weight) as target_weight
        FROM sales_goals sg
        LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
        WHERE sg.year = '${currentYear}'
          AND sg.month = '${monthNum}'
          AND sg.category_type = 'division'
          AND sg.category = 'IL'
          AND ec.b2c_팀 = 'B2B'
          AND ec.b2b팀 IS NOT NULL
        GROUP BY category, team
      `;

      const [catResult, hierarchyResult, b2cResult, b2bYtdResult, goalsResult] = await Promise.all([
        executeSQL(b2bCategoryQuery),
        executeSQL(b2bHierarchyQuery),
        executeSQL(b2cTotalQuery),
        executeSQL(b2bYtdQuery),
        executeSQL(b2bGoalsQuery)
      ]);

      const catData = catResult?.rows || [];
      const hierarchyData = hierarchyResult?.rows || [];
      const b2cTotalData = b2cResult?.rows?.[0] || { weight: 0, amount: 0, ytd_weight: 0, ytd_amount: 0 };
      const b2bYtdData = b2bYtdResult?.rows?.[0] || { weight: 0, amount: 0 };
      const goalsData = goalsResult?.rows || [];

      // Build goalsMap for categories (aggregate all teams)
      const categoryGoalsMap = new Map<string, number>();
      const teamGoalsMap = new Map<string, number>();

      goalsData.forEach((g: any) => {
        // Category-level goals
        const catKey = g.category;
        categoryGoalsMap.set(catKey, (categoryGoalsMap.get(catKey) || 0) + (Number(g.target_weight) || 0));

        // Team-level goals
        const teamKey = g.team;
        teamGoalsMap.set(teamKey, (teamGoalsMap.get(teamKey) || 0) + (Number(g.target_weight) || 0));
      });

      const goalsMap = categoryGoalsMap; // For backward compatibility with category lookup

      const yearlyHierarchyQuery = `
        SELECT
          substr(s.일자, 1, 4) as year,
          ${branchMapping} as branch,
          ec.b2b팀 as team,
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
          END as category,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 IS NOT NULL
          AND ec.b2c_팀 = 'B2B'
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
          AND substr(s.일자, 6, 2) <= '${monthNum}'
        GROUP BY 1, 2, 3, 4
      `;
      const yearlyGoalsQuery = `
        SELECT
          sg.year as year,
          ${branchMapping} as branch,
          ec.b2b팀 as team,
          sg.category as category,
          SUM(sg.target_weight) as target_weight
        FROM sales_goals sg
        LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
        WHERE sg.category_type = 'division'
          AND sg.category = 'IL'
          AND ec.b2c_팀 = 'B2B'
          AND ec.b2b팀 IS NOT NULL
          AND sg.month <= '${monthNum}'
        GROUP BY 1, 2, 3, 4
      `;
      const yearlyPurchaseQuery = `
        SELECT
          substr(p.일자, 1, 4) as year,
          CASE
            WHEN p.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN p.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN p.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
          END as category,
          SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as purchase_weight
        FROM (${basePurchasesSubquery}) p
        LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE p.일자 IS NOT NULL
          AND ec.b2c_팀 = 'B2B'
          AND p.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND substr(p.일자, 6, 2) <= '${monthNum}'
        GROUP BY 1, 2
      `;
      const yearlyB2CCategoryQuery = `
        SELECT
          substr(s.일자, 1, 4) as year,
          CASE
            WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN s.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI + MAR'
            WHEN s.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
          END as category,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE s.일자 IS NOT NULL
          AND ec.b2c_팀 != 'B2B'
          AND s.품목그룹1코드 IN ('MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL')
          AND e.사원_담당_명 != '김도량'
          AND substr(s.일자, 6, 2) <= '${monthNum}'
        GROUP BY 1, 2
      `;
      const [yearlyHierarchyResult, yearlyGoalsResult, yearlyPurchaseResult, yearlyB2CCategoryResult] = await Promise.all([
        executeSQL(yearlyHierarchyQuery),
        executeSQL(yearlyGoalsQuery),
        executeSQL(yearlyPurchaseQuery),
        executeSQL(yearlyB2CCategoryQuery),
      ]);
      const yearlyRows = yearlyHierarchyResult?.rows || [];
      const yearlyGoalRows = yearlyGoalsResult?.rows || [];
      const yearlyPurchaseRows = yearlyPurchaseResult?.rows || [];
      const yearlyB2CCategoryRows = yearlyB2CCategoryResult?.rows || [];
      const yearlyB2CCategoryMap = new Map<string, Map<string, number>>();
      yearlyB2CCategoryRows.forEach((r: any) => {
        const y = String(r.year);
        if (!yearlyB2CCategoryMap.has(y)) yearlyB2CCategoryMap.set(y, new Map<string, number>());
        yearlyB2CCategoryMap.get(y)!.set(r.category, Number(r.sales_weight) || 0);
      });
      const categoryOrder = ['MB', 'AVI + MAR', 'AUTO', 'IL'];
      const yearlyMap = new Map<string, any>();
      yearlyRows.forEach((r: any) => {
        const year = String(r.year);
        if (!yearlyMap.has(year)) {
          const categoriesMap = new Map<string, any>();
          categoryOrder.forEach((c) => categoriesMap.set(c, { category: c, sales_weight: 0, purchase_weight: 0, target_weight: 0, branchesMap: new Map() }));
          yearlyMap.set(year, categoriesMap);
        }
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const cat = categoriesMap.get(r.category);
        if (!cat) return;
        const weight = Number(r.sales_weight) || 0;
        cat.sales_weight += weight;
        if (!cat.branchesMap.has(r.branch)) {
          cat.branchesMap.set(r.branch, { branch: r.branch, sales_weight: 0, target_weight: 0, teamsMap: new Map() });
        }
        const branch = cat.branchesMap.get(r.branch);
        branch.sales_weight += weight;
        const teamObj = branch.teamsMap.get(r.team) || { sales_weight: 0, target_weight: 0 };
        teamObj.sales_weight += weight;
        branch.teamsMap.set(r.team, teamObj);
      });
      yearlyGoalRows.forEach((r: any) => {
        const year = String(r.year);
        if (!yearlyMap.has(year)) {
          const categoriesMap = new Map<string, any>();
          categoryOrder.forEach((c) => categoriesMap.set(c, { category: c, sales_weight: 0, purchase_weight: 0, target_weight: 0, branchesMap: new Map() }));
          yearlyMap.set(year, categoriesMap);
        }
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const cat = categoriesMap.get(r.category);
        if (!cat) return;
        const targetWeight = Number(r.target_weight) || 0;
        cat.target_weight += targetWeight;
        if (!cat.branchesMap.has(r.branch)) {
          cat.branchesMap.set(r.branch, { branch: r.branch, sales_weight: 0, target_weight: 0, teamsMap: new Map() });
        }
        const branch = cat.branchesMap.get(r.branch);
        branch.target_weight += targetWeight;
        const teamObj = branch.teamsMap.get(r.team) || { sales_weight: 0, target_weight: 0 };
        teamObj.target_weight += targetWeight;
        branch.teamsMap.set(r.team, teamObj);
      });
      yearlyPurchaseRows.forEach((r: any) => {
        const year = String(r.year);
        if (!yearlyMap.has(year)) {
          const categoriesMap = new Map<string, any>();
          categoryOrder.forEach((c) => categoriesMap.set(c, { category: c, sales_weight: 0, purchase_weight: 0, target_weight: 0, branchesMap: new Map() }));
          yearlyMap.set(year, categoriesMap);
        }
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const cat = categoriesMap.get(r.category);
        if (cat) cat.purchase_weight += Number(r.purchase_weight) || 0;
      });
      const years = Array.from(yearlyMap.keys()).sort((a, b) => Number(b) - Number(a));
      const yearlySummary = years.map((year) => {
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const total = Array.from(categoriesMap.values()).reduce((sum, c) => sum + c.sales_weight, 0);
        const purchaseTotal = Array.from(categoriesMap.values()).reduce((sum, c) => sum + c.purchase_weight, 0);
        const target = Array.from(categoriesMap.values()).reduce((sum, c) => sum + c.target_weight, 0);
        const prevMap = yearlyMap.get(String(Number(year) - 1)) as Map<string, any> | undefined;
        const prevTotal = prevMap ? Array.from(prevMap.values()).reduce((sum, c) => sum + c.sales_weight, 0) : 0;
        return {
          year,
          sales_weight: Math.round(total),
          last_year_sales_weight: Math.round(prevTotal),
          purchase_weight: Math.round(purchaseTotal),
          yoy_growth_rate: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0,
          target_weight: Math.round(target),
          achievement_rate: target > 0 ? (total / target) * 100 : 0,
        };
      });
      const yearlyCategoryBreakdown = years.map((year) => {
        const categoriesMap = yearlyMap.get(year) as Map<string, any>;
        const prevMap = yearlyMap.get(String(Number(year) - 1)) as Map<string, any> | undefined;
        return {
          year,
          categories: categoryOrder.map((category) => {
            const curr = categoriesMap.get(category) || { sales_weight: 0, purchase_weight: 0, target_weight: 0, branchesMap: new Map() };
            const prev = prevMap?.get(category) || { sales_weight: 0 };
            const b2cCurrent = Number(yearlyB2CCategoryMap.get(year)?.get(category) || 0);
            const b2cPrev = Number(yearlyB2CCategoryMap.get(String(Number(year) - 1))?.get(category) || 0);
            return {
              category,
              sales_weight: Math.round(curr.sales_weight),
              last_year_sales_weight: Math.round(prev.sales_weight),
              purchase_weight: Math.round(curr.purchase_weight),
              yoy_growth_rate: prev.sales_weight > 0 ? ((curr.sales_weight - prev.sales_weight) / prev.sales_weight) * 100 : 0,
              target_weight: Math.round(curr.target_weight),
              achievement_rate: curr.target_weight > 0 ? (curr.sales_weight / curr.target_weight) * 100 : 0,
              b2c_total: {
                sales_weight: Math.round(b2cCurrent),
                last_year_sales_weight: Math.round(b2cPrev),
                yoy_growth_rate: b2cPrev > 0 ? ((b2cCurrent - b2cPrev) / b2cPrev) * 100 : 0,
              },
              branches: Array.from(curr.branchesMap.values())
                .sort((a: any, b: any) => String(a.branch).localeCompare(String(b.branch)))
                .map((b: any) => ({
                  branch: b.branch,
                  sales_weight: Math.round(b.sales_weight),
                  last_year_sales_weight: Math.round(prev.branchesMap?.get(b.branch)?.sales_weight || 0),
                  yoy_growth_rate: (prev.branchesMap?.get(b.branch)?.sales_weight || 0) > 0
                    ? ((b.sales_weight - (prev.branchesMap?.get(b.branch)?.sales_weight || 0)) / (prev.branchesMap?.get(b.branch)?.sales_weight || 0)) * 100
                    : 0,
                  target_weight: Math.round(b.target_weight || 0),
                  achievement_rate: (b.target_weight || 0) > 0 ? (b.sales_weight / b.target_weight) * 100 : 0,
                  teams: Array.from(b.teamsMap.entries())
                    .sort((a: any, b: any) => String(a[0]).localeCompare(String(b[0])))
                    .map(([teamName, teamData]: any) => {
                      const prevTeamSales = Number(prev.branchesMap?.get(b.branch)?.teamsMap?.get(teamName)?.sales_weight || 0);
                      return {
                        team_name: teamName,
                        sales_weight: Math.round(Number(teamData?.sales_weight) || 0),
                        last_year_sales_weight: Math.round(prevTeamSales),
                        yoy_growth_rate: prevTeamSales > 0 ? (((Number(teamData?.sales_weight) || 0) - prevTeamSales) / prevTeamSales) * 100 : 0,
                        target_weight: Math.round(Number(teamData?.target_weight) || 0),
                        achievement_rate: (Number(teamData?.target_weight) || 0) > 0
                          ? ((Number(teamData?.sales_weight) || 0) / Number(teamData?.target_weight)) * 100
                          : 0,
                      };
                    }),
                })),
            };
          }),
        };
      });
      const yearlyAutoBreakdown = years.map((year) => {
        const auto = yearlyCategoryBreakdown.find((r: any) => r.year === year)?.categories.find((c: any) => c.category === 'AUTO');
        const autoPrev = yearlyCategoryBreakdown.find((r: any) => r.year === String(Number(year) - 1))?.categories.find((c: any) => c.category === 'AUTO');
        return {
          year,
          PVL: {
            sales_weight: Math.round(auto?.sales_weight || 0),
            last_year_sales_weight: Math.round(autoPrev?.sales_weight || 0),
          },
          CVL: {
            sales_weight: 0,
            last_year_sales_weight: 0,
          },
        };
      });

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
          const teamTarget = teamGoalsMap.get(teamName) || 0;

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
          yearlySummary,
          yearlyCategoryBreakdown,
          yearlyAutoBreakdown,
          b2cTotal: {
            weight: Math.round(Number(b2cTotalData.weight) || 0),
            amount: Math.round(Number(b2cTotalData.amount) || 0),
            ytd_weight: Math.round(Number(b2cTotalData.ytd_weight) || 0),
            ytd_amount: Math.round(Number(b2cTotalData.ytd_amount) || 0),
          },
          total: {
            current_month_weight: totalActualWeight,
            current_month_amount: categories.reduce((sum: number, c: any) => sum + c.current_month_amount, 0),
            ytd_weight: Math.round(Number(b2bYtdData.weight) || 0),
            ytd_amount: Math.round(Number(b2bYtdData.amount) || 0),
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
      const categoryType = searchParams.get('categoryType') || 'tier';

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

      // Build category CASE statement based on categoryType
      let categoryCaseStatement: string;
      let categoryHavingClause: string;
      let additionalJoins = '';

      if (categoryType === 'tier') {
        categoryCaseStatement = `
          CASE
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'STA' THEN 'Standard'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'PRE' THEN 'Premium'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'FLA' THEN 'Flagship'
            WHEN i.품목그룹1코드 NOT IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN 'Alliance'
            ELSE 'Others'
          END`;
        categoryHavingClause = "category IN ('Standard', 'Premium', 'Flagship', 'Alliance')";
      } else if (categoryType === 'division') {
        categoryCaseStatement = `
          CASE
            WHEN i.품목그룹1코드 = 'IL' THEN 'IL'
            WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
            WHEN i.품목그룹1코드 = 'MB' THEN 'MB'
            WHEN i.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI+MAR'
            ELSE '기타'
          END`;
        categoryHavingClause = "category IN ('IL', 'AUTO', 'MB', 'AVI+MAR')";
      } else if (categoryType === 'business_type') {
        additionalJoins = `LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드`;
        categoryCaseStatement = `
          CASE
            WHEN ca.업종분류코드 IN ('28600', '28610', '28710') THEN 'Fleet'
            WHEN ca.업종분류코드 IS NOT NULL THEN 'LCC'
            ELSE NULL
          END`;
        categoryHavingClause = "category IN ('Fleet', 'LCC')";
      } else if (categoryType === 'industry_sector') {
        // Use industry and sector from company_type
        categoryCaseStatement = `COALESCE(ct.산업분류 || ' / ' || ct.섹터분류, '미분류')`;
        categoryHavingClause = "category IS NOT NULL";
      } else {
        // family
        categoryCaseStatement = `
          CASE
            WHEN i.제품군 = 'MOBIL 1' THEN 'MOBIL 1'
            WHEN i.제품군 = 'AIOP' THEN 'AIOP'
            WHEN i.제품군 = 'TP' THEN 'TP'
            WHEN i.제품군 = 'SPECIAL P' THEN 'SPECIAL P'
            WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'CVL Products'
            ELSE 'Others'
          END`;
        categoryHavingClause = "category IN ('MOBIL 1', 'AIOP', 'TP', 'SPECIAL P', 'CVL Products')";
      }

      // Employee Category Actuals Query
      const employeeCategoryActualQuery = `
        SELECT
          substr(s.일자, 1, 7) as month,
          e.사원_담당_명 as employee_name,
          ec.전체사업소 as branch,
          CASE
            WHEN ec.b2c_팀 = 'B2B' THEN COALESCE(ec.b2b팀, '미분류')
            ELSE COALESCE(ec.b2c_팀, '미분류')
          END as team,
          ${categoryCaseStatement} as category,
          COALESCE(ct.산업분류, '미분류') as industry,
          COALESCE(ct.섹터분류, '미분류') as sector,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as amount
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
        ${additionalJoins}
        WHERE s.일자 LIKE '${prevYear}-%'
          AND e.사원_담당_명 IS NOT NULL
          AND e.사원_담당_명 != '김도량'
        GROUP BY month, employee_name, branch, team, category, industry, sector
        HAVING ${categoryHavingClause}
        ORDER BY branch, team, employee_name, category, industry, sector
      `;

      const employeeCategoryActualRes = await executeSQL(employeeCategoryActualQuery);
      const employeeCategoryActual = employeeCategoryActualRes?.rows || [];

      // Fetch goals from sales_goals table
      const goalsQuery = `
        SELECT
          id,
          year,
          month,
          employee_name,
          category_type,
          category,
          industry,
          sector,
          target_weight,
          target_amount
        FROM sales_goals
        WHERE year = '${selectedYear}'
          AND category_type = '${categoryType}'
      `;

      const goalsRes = await executeSQL(goalsQuery);
      const goals = goalsRes?.rows || [];

      // Get unique employees and categories
      const uniqueEmployees = new Set<string>();
      const uniqueCategories = new Set<string>();
      employeeCategoryActual.forEach((row: any) => {
        uniqueEmployees.add(row.employee_name);
        uniqueCategories.add(row.category);
      });

      return NextResponse.json({
        success: true,
        data: {
          employeeCategoryActual,
          goals,
          uniqueEmployees: Array.from(uniqueEmployees),
          uniqueCategories: Array.from(uniqueCategories),
          categoryType,
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

    // Handle save_all_goals action
    if (body.action === 'save_all_goals') {
      const goals = body.goals || [];
      if (goals.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }

      const rows = goals.map((goal: any) => ({
        year: goal.year,
        month: goal.month,
        employee_name: goal.employee_name,
        category_type: goal.category_type,
        category: goal.category,
        industry: goal.industry || '미분류',
        sector: goal.sector || '미분류',
        target_weight: goal.target_weight || 0,
        target_amount: goal.target_amount || 0
      }));

      await insertRows('sales_goals', rows);
      return NextResponse.json({ success: true, count: goals.length });
    }

    // Handle save_goal action (single goal save)
    if (body.action === 'save_goal') {
      const { year, month, employee_name, category_type, category, industry, sector, target_weight, target_amount } = body;

      if (!year || !month || !employee_name || !category_type || !category) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }

      // insertRows handles upsert with unique constraint
      await insertRows('sales_goals', [{
        year,
        month,
        employee_name,
        category_type,
        category,
        industry: industry || '미분류',
        sector: sector || '미분류',
        target_weight: target_weight || 0,
        target_amount: target_amount || 0
      }]);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Closing Meeting POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
