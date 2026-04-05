import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint for Sales Analysis with Three-Way Filtering
 * Filters: Employee (individual/team/branch), Client (industry/region), Product (categories)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeVat = searchParams.get('includeVat') === 'true';
    const divisor = includeVat ? '1.0' : '1.1';

    // Base table for sales
    const baseSalesTable = 'sales';

    // Date range
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const startDate = searchParams.get('startDate') || firstDayOfMonth;
    const endDate = searchParams.get('endDate') || today;

    // Multiple grouping support - can now pass comma-separated values
    const employeeGroups = searchParams.get('employeeGroups')?.split(',').filter(v => v.trim() !== '' && v !== 'none') || [];
    const employeeValues = searchParams.get('employeeValues')?.split(',').filter(v => v.trim() !== '') || [];

    const clientGroups = searchParams.get('clientGroups')?.split(',').filter(v => v.trim() !== '' && v !== 'none') || [];
    const clientValues = searchParams.get('clientValues')?.split(',').filter(v => v.trim() !== '') || [];

    const productGroups = searchParams.get('productGroups')?.split(',').filter(v => v.trim() !== '' && v !== 'none') || [];
    const productValues = searchParams.get('productValues')?.split(',').filter(v => v.trim() !== '') || [];

    // Backward compatibility with single group parameters
    const employeeGroup = searchParams.get('employeeGroup');
    if (employeeGroup && employeeGroup !== 'none' && !employeeGroups.length) {
      employeeGroups.push(employeeGroup);
    }
    const clientGroup = searchParams.get('clientGroup');
    if (clientGroup && clientGroup !== 'none' && !clientGroups.length) {
      clientGroups.push(clientGroup);
    }
    const productGroup = searchParams.get('productGroup');
    if (productGroup && productGroup !== 'none' && !productGroups.length) {
      productGroups.push(productGroup);
    }

    // Build WHERE clauses based on filter values (not groupings)
    let employeeWhere = '';
    if (employeeValues.length > 0) {
      // Combine all employee filters with OR logic
      const conditions = [];

      // Check which groupings are active and build conditions accordingly
      if (employeeGroups.includes('individual')) {
        const individualValues = employeeValues.filter(v => v && v.trim() !== '');
        if (individualValues.length > 0) {
          const quoted = individualValues.map(v => `'${v}'`).join(',');
          conditions.push(`e.사원_담당_명 IN (${quoted})`);
        }
      }

      if (employeeGroups.includes('team')) {
        const teamValues = employeeValues.filter(v => v && v.trim() !== '');
        if (teamValues.length > 0) {
          const quoted = teamValues.map(v => `'${v}'`).join(',');
          conditions.push(`ec.b2c_팀 IN (${quoted})`);
        }
      }

      if (employeeGroups.includes('branch')) {
        const branchValues = employeeValues.filter(v => v && v.trim() !== '');
        if (branchValues.length > 0) {
          const branchConditions = branchValues.map(v => {
            if (v === 'MB') return "ec.전체사업소 = '벤츠'";
            if (v === '창원') return "ec.전체사업소 = '경남사업소'";
            return `ec.전체사업소 LIKE '%${v}%'`;
          });
          conditions.push(`(${branchConditions.join(' OR ')})`);
        }
      }

      if (conditions.length > 0) {
        employeeWhere = `AND (${conditions.join(' OR ')})`;
      }
    }

    let clientWhere = '';
    if (clientValues.length > 0) {
      const conditions = [];
      if (clientGroups.includes('industry')) {
        const quoted = clientValues.map(v => `'${v}'`).join(',');
        if (quoted) conditions.push(`c.업종분류코드 IN (${quoted})`);
      }
      if (clientGroups.includes('region')) {
        const quoted = clientValues.map(v => `'${v}'`).join(',');
        if (quoted) conditions.push(`c.지역코드 IN (${quoted})`);
      }
      if (conditions.length > 0) {
        clientWhere = `AND (${conditions.join(' OR ')})`;
      }
    }

    let productWhere = '';
    if (productValues.length > 0) {
      const conditions = [];
      if (productGroups.includes('group1')) {
        const quoted = productValues.map(v => `'${v}'`).join(',');
        if (quoted) conditions.push(`i.품목그룹1코드 IN (${quoted})`);
      }
      if (productGroups.includes('group2')) {
        const quoted = productValues.map(v => `'${v}'`).join(',');
        if (quoted) conditions.push(`i.품목그룹2코드 IN (${quoted})`);
      }
      if (productGroups.includes('group3')) {
        const quoted = productValues.map(v => `'${v}'`).join(',');
        if (quoted) conditions.push(`i.품목그룹3코드 IN (${quoted})`);
      }
      if (conditions.length > 0) {
        productWhere = `AND (${conditions.join(' OR ')})`;
      }
    }

    // Build GROUP BY based on ALL selected groupings
    let groupByFields = [];
    let selectFields = [];

    // Employee grouping - add all selected dimensions
    if (employeeGroups.includes('branch')) {
      selectFields.push(`CASE
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
      END as branch_name`);
      groupByFields.push('branch_name');
    }
    if (employeeGroups.includes('team')) {
      selectFields.push('ec.b2c_팀 as team_name');
      groupByFields.push('ec.b2c_팀');
    }
    if (employeeGroups.includes('individual')) {
      selectFields.push('e.사원_담당_명 as employee_name');
      groupByFields.push('e.사원_담당_명');
    }

    // Client grouping - add all selected dimensions
    if (clientGroups.includes('industry')) {
      selectFields.push('c.업종분류코드 as industry_code', 'ct.모빌분류 as industry_name');
      groupByFields.push('c.업종분류코드', 'ct.모빌분류');
    }
    if (clientGroups.includes('region')) {
      selectFields.push('c.지역코드 as region_code');
      groupByFields.push('c.지역코드');
    }

    // Product grouping - add all selected dimensions
    if (productGroups.includes('group1')) {
      selectFields.push('i.품목그룹1코드 as product_group1');
      groupByFields.push('i.품목그룹1코드');
    }
    if (productGroups.includes('group2')) {
      selectFields.push('i.품목그룹2코드 as product_group2');
      groupByFields.push('i.품목그룹2코드');
    }
    if (productGroups.includes('group3')) {
      selectFields.push('i.품목그룹3코드 as product_group3');
      groupByFields.push('i.품목그룹3코드');
    }

    // Aggregation fields
    selectFields.push(
      'COUNT(DISTINCT s.id) as transaction_count',
      'COUNT(DISTINCT s.거래처코드) as client_count',
      'SUM(CAST(REPLACE(s.수량, \',\', \'\') AS NUMERIC)) as total_quantity',
      'SUM(CAST(REPLACE(s.중량, \',\', \'\') AS NUMERIC)) as total_weight',
      `SUM(CAST(REPLACE(s.수량, ',', '') AS NUMERIC) * CAST(REPLACE(s.단가, ',', '') AS NUMERIC)) / ${divisor} as total_supply_amount`,
      `SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) / ${divisor} as total_amount`
    );

    const query = `
      SELECT
        ${selectFields.join(',\n        ')}
      FROM ${baseSalesTable} s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
      WHERE s.일자 BETWEEN '${startDate}' AND '${endDate}'
        ${employeeWhere}
        ${clientWhere}
        ${productWhere}
        AND e.사원_담당_명 != '김도량'
      GROUP BY ${groupByFields.join(', ')}
      ORDER BY total_amount DESC
      LIMIT 1000
    `;

    // Safety check for GROUP BY
    if (groupByFields.length === 0) {
      throw new Error('No grouping fields selected. This should not happen.');
    }

    console.log('Executing sales analysis query:', query);
    console.log('Filters:', { employeeGroup, employeeValues, clientGroup, clientValues, productGroup, productValues });
    console.log('GROUP BY fields:', groupByFields);

    const resultData = await executeSQL(query);
    const data = resultData?.rows || [];

    // Get filter options for dropdowns
    const filterOptionsQueries = {
      employees: `
        SELECT DISTINCT e.사원_담당_명 as name
        FROM employees e
        WHERE e.사원_담당_명 IS NOT NULL AND e.사원_담당_명 != ''
        ORDER BY e.사원_담당_명
      `,
      teams: `
        SELECT DISTINCT ec.b2c_팀 as name
        FROM employee_category ec
        WHERE ec.b2c_팀 IS NOT NULL AND ec.b2c_팀 != ''
        ORDER BY ec.b2c_팀
      `,
      branches: `
        SELECT DISTINCT
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
          END as name
        FROM employee_category ec
        WHERE ec.전체사업소 IS NOT NULL AND ec.전체사업소 != ''
        ORDER BY name
      `,
      industries: `
        SELECT DISTINCT c.업종분류코드 as code, ct.모빌분류 as name
        FROM clients c
        LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
        WHERE c.업종분류코드 IS NOT NULL AND c.업종분류코드 != ''
        ORDER BY c.업종분류코드
      `,
      regions: `
        SELECT DISTINCT c.지역코드 as code
        FROM clients c
        WHERE c.지역코드 IS NOT NULL AND c.지역코드 != ''
        ORDER BY c.지역코드
      `,
      productGroup1: `
        SELECT DISTINCT i.품목그룹1코드 as code
        FROM items i
        WHERE i.품목그룹1코드 IS NOT NULL AND i.품목그룹1코드 != ''
        ORDER BY i.품목그룹1코드
      `,
      productGroup2: `
        SELECT DISTINCT i.품목그룹2코드 as code
        FROM items i
        WHERE i.품목그룹2코드 IS NOT NULL AND i.품목그룹2코드 != ''
        ORDER BY i.품목그룹2코드
      `,
      productGroup3: `
        SELECT DISTINCT i.품목그룹3코드 as code
        FROM items i
        WHERE i.품목그룹3코드 IS NOT NULL AND i.품목그룹3코드 != ''
        ORDER BY i.품목그룹3코드
      `
    };

    const filterOptions: any = {};
    for (const [key, query] of Object.entries(filterOptionsQueries)) {
      const result = await executeSQL(query);
      filterOptions[key] = result?.rows || [];
    }

    return NextResponse.json({
      success: true,
      data,
      filterOptions,
      filters: {
        employeeGroup,
        employeeValues,
        clientGroup,
        clientValues,
        productGroup,
        productValues,
        startDate,
        endDate
      }
    });
  } catch (error: any) {
    console.error('API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch sales analysis data',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
