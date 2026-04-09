import { NextRequest, NextResponse } from 'next/server';
import { executeSQL, updateRows } from '@/egdesk-helpers';

type CategoryType = 'tier' | 'division' | 'family' | 'business_type';

interface ProductType {
  category: string;
  product_family?: string;
  total_weight: number;
  total_amount: number;
}

interface Client {
  client_code: string;
  client_name: string;
  client_group: string;
  industry: string;
  sector: string;
  last_year_weight: number;
  last_year_amount: number;
  current_year_weight: number;
  current_year_amount: number;
  new_client_date: string;
  product_types?: ProductType[];
}

async function getClientProductTypes(currentYear: number, categoryType: CategoryType = 'tier'): Promise<Map<string, ProductType[]>> {
  // Try to read from summary table first
  try {
    const summaryQuery = `
      SELECT
        client_code,
        category,
        total_weight,
        total_amount
      FROM client_product_summary
      WHERE year = '${currentYear}'
        AND category_type = '${categoryType}'
      ORDER BY client_code, total_weight DESC
    `;

    const productDataRaw = await executeSQL(summaryQuery);
    const productDataArray = Array.isArray(productDataRaw) ? productDataRaw : (productDataRaw?.rows || []);

    if (productDataArray.length > 0) {
      // Successfully retrieved from summary table
      const productMap = new Map<string, ProductType[]>();

      productDataArray.forEach((row: any) => {
        const clientCode = row.client_code;
        if (!productMap.has(clientCode)) {
          productMap.set(clientCode, []);
        }

        const products = productMap.get(clientCode)!;
        if (products.length < 5) {
          products.push({
            category: row.category,
            product_family: undefined,
            total_weight: Number(row.total_weight || 0),
            total_amount: Number(row.total_amount || 0)
          });
        }
      });

      return productMap;
    }
  } catch (error) {
    console.log('Summary table not available, falling back to direct query:', error);
  }

  // Fallback: Compute directly from sales data
  let caseStatement: string;
  let havingClause: string;
  let additionalJoins = '';

  if (categoryType === 'tier') {
    caseStatement = `
      CASE
        WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'STA' THEN 'Standard'
        WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'PRE' THEN 'Premium'
        WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'FLA' THEN 'Flagship'
        WHEN i.품목그룹1코드 NOT IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN 'Alliance'
        ELSE 'Others'
      END`;
    havingClause = "category IN ('Standard', 'Premium', 'Flagship', 'Alliance')";
  } else if (categoryType === 'division') {
    caseStatement = `
      CASE
        WHEN i.품목그룹1코드 = 'IL' THEN 'IL'
        WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
        WHEN i.품목그룹1코드 = 'MB' THEN 'MB'
        WHEN i.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI+MAR'
        ELSE '기타'
      END`;
    havingClause = "category IN ('IL', 'AUTO', 'MB', 'AVI+MAR', '기타')";
  } else if (categoryType === 'business_type') {
    additionalJoins = `LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드`;
    caseStatement = `
      CASE
        WHEN ca.업종분류코드 IN ('28600', '28610', '28710') THEN 'Fleet'
        WHEN ca.업종분류코드 IS NOT NULL THEN 'LCC'
        ELSE NULL
      END`;
    havingClause = "category IN ('Fleet', 'LCC')";
  } else {
    caseStatement = `
      CASE
        WHEN i.제품군 = 'MOBIL 1' THEN 'MOBIL 1'
        WHEN i.제품군 = 'AIOP' THEN 'AIOP'
        WHEN i.제품군 = 'TP' THEN 'TP'
        WHEN i.제품군 = 'SPECIAL P' THEN 'SPECIAL P'
        WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'CVL Products'
        ELSE 'Others'
      END`;
    havingClause = "category IN ('MOBIL 1', 'AIOP', 'TP', 'SPECIAL P', 'CVL Products', 'Others')";
  }

  const productQuery = `
    SELECT
      COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) as client_code,
      ${caseStatement} as category,
      NULL as product_family,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
      SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as total_amount
    FROM (
      SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM east_division_sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계 FROM west_division_sales
    ) s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    ${additionalJoins}
    WHERE strftime('%Y', s.일자) = '${currentYear}'
      AND e.사원_담당_명 != '김도량'
      ${categoryType === 'business_type' ? '' : 'AND i.품목코드 IS NOT NULL'}
    GROUP BY client_code, category
    HAVING ${havingClause}
    ORDER BY client_code, total_weight DESC
  `;

  const productDataRaw = await executeSQL(productQuery);
  const productDataArray = Array.isArray(productDataRaw) ? productDataRaw : (productDataRaw?.rows || []);

  const productMap = new Map<string, ProductType[]>();

  productDataArray.forEach((row: any) => {
    const clientCode = row.client_code;
    if (!productMap.has(clientCode)) {
      productMap.set(clientCode, []);
    }

    const products = productMap.get(clientCode)!;
    if (products.length < 5) {
      products.push({
        category: row.category,
        product_family: row.product_family,
        total_weight: Number(row.total_weight || 0),
        total_amount: Number(row.total_amount || 0)
      });
    }
  });

  return productMap;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const selectedEmployee = searchParams.get('employee') || '';
    const searchQuery = searchParams.get('search') || '';
    const includeProducts = searchParams.get('includeProducts') === 'true';
    const categoryType = (searchParams.get('categoryType') || 'tier') as CategoryType;

    // Get CURRENT client assignments (who manages which clients right now)
    const query = `
      SELECT
        c.거래처코드 as client_code,
        c.거래처명 as client_name,
        c.담당자코드 as employee_code,
        e.사원_담당_명 as employee_name,
        ec.b2b팀 as b2b_team,
        ec.b2c_팀 as b2c_team,
        ec.전체사업소 as branch,
        c.거래처그룹1명 as client_group,
        ct.산업분류 as industry,
        ct.섹터분류 as sector,
        c.신규일 as new_client_date
      FROM clients c
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
      WHERE 1=1
        ${selectedEmployee ? `AND e.사원_담당_명 = '${selectedEmployee}'` : ''}
        ${searchQuery ? `AND (c.거래처명 LIKE '%${searchQuery}%' OR c.거래처코드 LIKE '%${searchQuery}%')` : ''}
      ORDER BY e.사원_담당_명, c.거래처명
    `;

    const resultRaw = await executeSQL(query);
    const result = Array.isArray(resultRaw) ? resultRaw : (resultRaw?.rows || []);

    console.log('Sample rows from query:', result.slice(0, 3));
    console.log('Total rows returned:', result.length);
    console.log('Rows with employee_name:', result.filter((r: any) => r.employee_name).length);
    console.log('Rows without employee_name:', result.filter((r: any) => !r.employee_name).length);

    // Get list of all employees for dropdown
    const employeesQuery = `
      SELECT DISTINCT
        e.사원_담당_코드 as employee_code,
        e.사원_담당_명 as employee_name,
        ec.b2b팀 as b2b_team,
        ec.b2c_팀 as b2c_team,
        ec.전체사업소 as branch
      FROM employees e
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE e.사원_담당_명 != '김도량'
      ORDER BY e.사원_담당_명
    `;

    const employeesResultRaw = await executeSQL(employeesQuery);
    const employeesResult = Array.isArray(employeesResultRaw) ? employeesResultRaw : (employeesResultRaw?.rows || []);

    // Group clients by employee
    const employeeMap = new Map<string, any>();

    result.forEach((row: any) => {
      const employeeName = row.employee_name || '미배정';

      if (!employeeMap.has(employeeName)) {
        employeeMap.set(employeeName, {
          employee_code: row.employee_code,
          employee_name: employeeName,
          b2b_team: row.b2b_team,
          b2c_team: row.b2c_team,
          branch: row.branch,
          clients: [],
          total_last_year_weight: 0,
          total_last_year_amount: 0,
          total_current_year_weight: 0,
          total_current_year_amount: 0,
          client_count: 0
        });
      }

      const employee = employeeMap.get(employeeName);
      employee.clients.push({
        client_code: row.client_code,
        client_name: row.client_name,
        client_group: row.client_group,
        industry: row.industry,
        sector: row.sector,
        last_year_weight: 0,
        last_year_amount: 0,
        current_year_weight: 0,
        current_year_amount: 0,
        new_client_date: row.new_client_date
      });

      employee.client_count += 1;
    });

    // Fetch product data if requested
    let productMap: Map<string, ProductType[]> | null = null;
    if (includeProducts) {
      const currentYear = new Date().getFullYear();
      productMap = await getClientProductTypes(currentYear, categoryType);
    }

    // Merge product data into client objects
    if (productMap) {
      employeeMap.forEach((employee) => {
        employee.clients.forEach((client: any) => {
          const productTypes = productMap!.get(client.client_code);
          if (productTypes && productTypes.length > 0) {
            client.product_types = productTypes;
          }
        });
      });
    }

    const employeeAssignments = Array.from(employeeMap.values());

    return NextResponse.json({
      success: true,
      data: {
        employeeAssignments,
        allEmployees: employeesResult,
        totalClients: result.length
      }
    });
  } catch (error) {
    console.error('Failed to fetch client assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch client assignments', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientCodes, newEmployeeCode } = body;

    if (!clientCodes || !Array.isArray(clientCodes) || clientCodes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Client codes are required' },
        { status: 400 }
      );
    }

    if (!newEmployeeCode) {
      return NextResponse.json(
        { success: false, error: 'New employee code is required' },
        { status: 400 }
      );
    }

    // Update client assignments
    for (const clientCode of clientCodes) {
      await updateRows('clients',
        { 담당자코드: newEmployeeCode },
        { filters: { 거래처코드: clientCode } }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${clientCodes.length}개 고객이 재배정되었습니다.`
    });
  } catch (error) {
    console.error('Failed to reassign clients:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reassign clients' },
      { status: 500 }
    );
  }
}
