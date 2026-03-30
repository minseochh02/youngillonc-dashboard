import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'industry';
    const includeVat = searchParams.get('includeVat') === 'true';
    const divisor = includeVat ? '1.0' : '1.1';

    // 0. Base table for sales (unioned across all three tables and using 실납업체 logic)
    const baseSalesSubquery = `(
      SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM east_division_sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM west_division_sales
    )`;

    if (tab === 'industry') {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Query sales by industry (영일분류)
      const query = `
        SELECT
          ct.영일분류,
          ct.모빌분류 as industry_name,
          strftime('%Y', s.일자) as year,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesSubquery} s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND i.품목그룹1코드 = 'IL'
          AND e.사원_담당_명 != '김도량'
        GROUP BY ct.영일분류, ct.모빌분류, year
        ORDER BY ct.영일분류, year
      `;

      const industryDataRaw = await executeSQL(query);
      const industryDataArray = Array.isArray(industryDataRaw) ? industryDataRaw : (industryDataRaw?.rows || []);

      const industryData = industryDataArray.map((row: any) => ({
        영일분류: row.영일분류,
        industry_name: row.industry_name || '미분류',
        year: row.year,
        total_weight: Number(row.total_weight || 0),
        total_amount: Number(row.total_amount || 0),
        total_quantity: Number(row.total_quantity || 0),
      }));

      return NextResponse.json({
        success: true,
        data: {
          industryData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
        },
      });
    }

    if (tab === 'client') {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Query product sales comparison year-over-year for B2B across all three tables
      const query = `
        SELECT
          i.품목코드,
          i.품목명,
          i.품목그룹1코드,
          i.품목그룹2코드,
          i.품목그룹3코드,
          SUM(CASE WHEN strftime('%Y', s.일자) = '${lastYear}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as last_year_weight,
          SUM(CASE WHEN strftime('%Y', s.일자) = '${currentYear}' THEN CAST(REPLACE(s.중량, ',', '') AS NUMERIC) ELSE 0 END) as current_year_weight
        FROM ${baseSalesSubquery} s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND i.품목그룹1코드 = 'IL'
          AND e.사원_담당_명 != '김도량'
        GROUP BY i.품목코드, i.품목명, i.품목그룹1코드, i.품목그룹2코드, i.품목그룹3코드
        HAVING last_year_weight > 0 OR current_year_weight > 0
        ORDER BY current_year_weight DESC
      `;

      const productDataRaw = await executeSQL(query);
      const productDataArray = Array.isArray(productDataRaw) ? productDataRaw : (productDataRaw?.rows || []);

      const productData = productDataArray.map((row: any) => {
        const currentWeight = Number(row.current_year_weight || 0);
        const lastWeight = Number(row.last_year_weight || 0);

        return {
          품목코드: row.품목코드,
          품목명: row.품목명,
          품목그룹1코드: row.품목그룹1코드 || '',
          품목그룹2코드: row.품목그룹2코드 || '',
          품목그룹3코드: row.품목그룹3코드 || '',
          last_year_weight: lastWeight,
          current_year_weight: currentWeight,
          change_weight: currentWeight - lastWeight,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          productData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
        },
      });
    }

    if (tab === 'product-group') {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Query sales by product group across all three tables
      const query = `
        SELECT
          CASE
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'STA' THEN 'Standard'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'PRE' THEN 'Premium'
            WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'FLA' THEN 'Flagship'
            WHEN i.품목그룹1코드 NOT IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN 'Alliance'
            ELSE 'Others'
          END as product_group,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesSubquery} s
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND (COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) NOT IN (SELECT 거래처코드 FROM clients WHERE 담당자코드 IN (SELECT 사원_담당_코드 FROM employees WHERE 사원_담당_명 = '김도량')) OR COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) IS NULL)
        GROUP BY product_group, year, year_month
        HAVING product_group IN ('Standard', 'Premium', 'Flagship', 'Alliance')
        ORDER BY product_group, year, year_month
      `;

      const productGroupDataRaw = await executeSQL(query);
      const productGroupDataArray = Array.isArray(productGroupDataRaw) ? productGroupDataRaw : (productGroupDataRaw?.rows || []);

      const productGroupData = productGroupDataArray.map((row: any) => ({
        product_group: row.product_group,
        year: row.year,
        year_month: row.year_month,
        total_weight: Number(row.total_weight || 0),
        total_amount: Number(row.total_amount || 0),
        total_quantity: Number(row.total_quantity || 0),
      }));

      return NextResponse.json({
        success: true,
        data: {
          productGroupData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
        },
      });
    }

    if (tab === 'team') {
      const currentYear = new Date().getFullYear();

      // Query monthly sales by B2B office, team, industry, and sector across all three tables
      const query = `
        SELECT
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
          END as b2b_office,
          COALESCE(ec.b2b팀, '기타') as b2b_team,
          ct.산업분류 as industry,
          ct.섹터분류 as sector,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount
        FROM ${baseSalesSubquery} s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        WHERE s.일자 >= '${currentYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND e.사원_담당_명 != '김도량'
          AND c.거래처그룹1명 IS NOT NULL
        GROUP BY b2b_office, b2b_team, ct.산업분류, ct.섹터분류, year_month
        ORDER BY b2b_office, b2b_team, ct.산업분류, ct.섹터분류, year_month
      `;

      const b2bDataRaw = await executeSQL(query);
      const b2bDataArray = Array.isArray(b2bDataRaw) ? b2bDataRaw : (b2bDataRaw?.rows || []);

      const b2bData = b2bDataArray.map((row: any) => ({
        b2b_office: row.b2b_office || '',
        b2b_team: row.b2b_team || '',
        industry: row.industry || '',
        sector: row.sector || '',
        year_month: row.year_month,
        total_weight: Number(row.total_weight || 0),
        total_amount: Number(row.total_amount || 0),
      }));

      return NextResponse.json({
        success: true,
        data: {
          b2bData,
          currentYear: currentYear.toString(),
        },
      });
    }

    if (tab === 'fps') {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Query sales by FPS (Flagship/Premium/Standard) categories across all three tables
      const query = `
        SELECT
          CASE
            WHEN i.품목그룹3코드 = 'FLA' THEN 'Flagship'
            WHEN i.품목그룹3코드 = 'PRE' THEN 'Premium'
            WHEN i.품목그룹3코드 = 'STA' THEN 'Standard'
            ELSE 'Others'
          END as fps_category,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesSubquery} s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
          AND e.사원_담당_명 != '김도량'
        GROUP BY fps_category, year, year_month
        HAVING fps_category IN ('Flagship', 'Premium', 'Standard')
        ORDER BY fps_category, year, year_month
      `;

      const fpsDataRaw = await executeSQL(query);
      const fpsDataArray = Array.isArray(fpsDataRaw) ? fpsDataRaw : (fpsDataRaw?.rows || []);

      const fpsData = fpsDataArray.map((row: any) => ({
        fps_category: row.fps_category,
        year: row.year,
        year_month: row.year_month,
        total_weight: Number(row.total_weight || 0),
        total_amount: Number(row.total_amount || 0),
        total_quantity: Number(row.total_quantity || 0),
      }));

      return NextResponse.json({
        success: true,
        data: {
          fpsData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
        },
      });
    }

    if (tab === 'region') {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Query sales by region (지역코드) grouped into 서울경기, 충청, 경남 across all three tables
      const query = `
        SELECT
          CASE
            WHEN c.지역코드 LIKE '%서울%' OR c.지역코드 LIKE '%경기%' THEN '서울경기'
            WHEN c.지역코드 LIKE '%충청%' OR c.지역코드 LIKE '%대전%' OR c.지역코드 LIKE '%세종%' THEN '충청'
            WHEN c.지역코드 LIKE '%경남%' OR c.지역코드 LIKE '%부산%' OR c.지역코드 LIKE '%울산%' THEN '경남'
            ELSE '기타'
          END as region,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesSubquery} s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND i.품목그룹1코드 IN ('PVL', 'CVL')
          AND e.사원_담당_명 != '김도량'
        GROUP BY region, year, year_month
        HAVING region != '기타'
        ORDER BY region, year, year_month
      `;

      const regionDataRaw = await executeSQL(query);
      const regionDataArray = Array.isArray(regionDataRaw) ? regionDataRaw : (regionDataRaw?.rows || []);

      const regionData = regionDataArray.map((row: any) => ({
        region: row.region,
        year: row.year,
        year_month: row.year_month,
        total_weight: Number(row.total_weight || 0),
        total_amount: Number(row.total_amount || 0),
        total_quantity: Number(row.total_quantity || 0),
      }));

      return NextResponse.json({
        success: true,
        data: {
          regionData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
        },
      });
    }

    if (tab === 'new') {
      // Query new B2B clients (clients with 신규일 data) and their sales data across all three tables
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      const query = `
        SELECT
          c.거래처코드,
          c.거래처명,
          c.신규일,
          e.사원_담당_명 as 담당자명,
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
          END as branch,
          strftime('%Y', s.일자) as year,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity,
          COUNT(DISTINCT s.일자) as transaction_days
        FROM clients c
        LEFT JOIN ${baseSalesSubquery} s ON c.거래처코드 = COALESCE(NULLIF(s.실납업체, ''), s.거래처코드)
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        WHERE c.신규일 IS NOT NULL
          AND c.신규일 != ''
          AND s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND i.품목그룹1코드 = 'IL'
          AND e.사원_담당_명 != '김도량'
        GROUP BY c.거래처코드, c.거래처명, c.신규일, e.사원_담당_명, branch, year
        ORDER BY e.사원_담당_명, c.신규일 DESC, total_weight DESC
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
            branch: row.branch,
            year: row.year,
            total_weight: 0,
            total_amount: 0,
            total_quantity: 0,
            client_count: 0,
          };
        }
        managerSummary[key].total_weight += Number(row.total_weight || 0);
        managerSummary[key].total_amount += Number(row.total_amount || 0);
        managerSummary[key].total_quantity += Number(row.total_quantity || 0);
        managerSummary[key].client_count += 1;
      });

      // Calculate totals by year
      const totalsByYear: any = {};
      newClientsData.forEach((row: any) => {
        const year = row.year;
        if (!totalsByYear[year]) {
          totalsByYear[year] = {
            total_weight: 0,
            total_amount: 0,
            total_quantity: 0,
            client_count: 0,
          };
        }
        totalsByYear[year].total_weight += Number(row.total_weight || 0);
        totalsByYear[year].total_amount += Number(row.total_amount || 0);
        totalsByYear[year].total_quantity += Number(row.total_quantity || 0);
      });

      // Count unique clients per year
      const clientCountsByYear: any = {};
      newClientsData.forEach((row: any) => {
        const year = row.year;
        if (!clientCountsByYear[year]) {
          clientCountsByYear[year] = new Set();
        }
        clientCountsByYear[year].add(row.거래처코드);
      });

      Object.keys(clientCountsByYear).forEach((year) => {
        if (totalsByYear[year]) {
          totalsByYear[year].client_count = clientCountsByYear[year].size;
        }
      });

      const clients = newClientsData.map((row: any) => ({
        거래처코드: row.거래처코드,
        거래처명: row.거래처명,
        신규일: row.신규일,
        담당자명: row.담당자명,
        branch: row.branch,
        year: row.year,
        total_weight: Number(row.total_weight || 0),
        total_amount: Number(row.total_amount || 0),
        total_quantity: Number(row.total_quantity || 0),
        transaction_days: Number(row.transaction_days || 0),
      }));

      return NextResponse.json({
        success: true,
        data: {
          clients,
          managerSummary: Object.values(managerSummary),
          totalsByYear,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
        },
      });
    }

    if (tab === 'all-products') {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Query sales by B2B team (all products) across all three tables
      const query = `
        SELECT
          CASE
            WHEN ca.업종분류코드 IS NOT NULL THEN 'AUTO'
            ELSE COALESCE(ec.b2b팀, '미분류')
          END as team,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesSubquery} s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND e.사원_담당_명 != '김도량'
        GROUP BY team, year, year_month
        HAVING team != '미분류'
        ORDER BY team, year, year_month
      `;

      const allProductsDataRaw = await executeSQL(query);
      const allProductsDataArray = Array.isArray(allProductsDataRaw) ? allProductsDataRaw : (allProductsDataRaw?.rows || []);

      const allProductsData = allProductsDataArray.map((row: any) => ({
        team: row.team,
        year: row.year,
        year_month: row.year_month,
        total_weight: Number(row.total_weight || 0),
        total_amount: Number(row.total_amount || 0),
        total_quantity: Number(row.total_quantity || 0),
      }));

      return NextResponse.json({
        success: true,
        data: {
          allProductsData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
        },
      });
    }

    if (tab === 'industry-dairy') {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Query sales by individual items across all three tables for IL group
      const query = `
        SELECT
          i.품목코드,
          i.품목명,
          ct.영일분류 as youngil_category,
          strftime('%Y', s.일자) as year,
          strftime('%Y-%m', s.일자) as year_month,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
          SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC) / ${divisor}) as total_amount,
          SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC)) as total_quantity
        FROM ${baseSalesSubquery} s
        LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
        LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
        LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
        LEFT JOIN items i ON s.품목코드 = i.품목코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        WHERE s.일자 >= '${lastYear}-01-01'
          AND s.일자 <= '${currentYear}-12-31'
          AND ca.업종분류코드 IS NULL
          AND i.품목그룹1코드 = 'IL'
          AND e.사원_담당_명 != '김도량'
        GROUP BY i.품목코드, i.품목명, ct.영일분류, year, year_month
        ORDER BY i.품목코드, year, year_month
      `;

      const industryDairyDataRaw = await executeSQL(query);
      const industryDairyDataArray = Array.isArray(industryDairyDataRaw) ? industryDairyDataRaw : (industryDairyDataRaw?.rows || []);

      const industryDairyData = industryDairyDataArray.map((row: any) => {
        const currentWeight = Number(row.total_weight || 0);
        const weight = currentWeight;
        
        return {
          품목코드: row.품목코드,
          품목명: row.품목명,
          youngil_category: row.youngil_category || '미분류',
          year: row.year,
          year_month: row.year_month,
          total_weight: weight,
          total_amount: Number(row.total_amount || 0),
          total_quantity: Number(row.total_quantity || 0),
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          industryDairyData,
          currentYear: currentYear.toString(),
          lastYear: lastYear.toString(),
        },
      });
    }

    // Default response for other tabs
    return NextResponse.json({
      success: false,
      error: 'Tab not implemented yet',
    }, { status: 501 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch B2B meetings data',
    }, { status: 500 });
  }
}
