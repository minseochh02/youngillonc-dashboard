import { NextRequest, NextResponse } from 'next/server';
import { executeSQL, createTable, deleteRows, insertRows } from '@/egdesk-helpers';

type CategoryType = 'tier' | 'division' | 'family';

interface ProductSummaryRow {
  client_code: string;
  year: string;
  category_type: string;
  category: string;
  total_weight: number;
  total_amount: number;
  computed_date: string;
}

async function ensureTableExists() {
  try {
    // Try to query the table
    await executeSQL('SELECT * FROM client_product_summary LIMIT 1');
  } catch (error) {
    // Table doesn't exist, create it
    console.log('Creating client_product_summary table...');
    await createTable(
      'Client Product Summary',
      [
        { name: 'client_code', type: 'TEXT', notNull: true },
        { name: 'year', type: 'TEXT', notNull: true },
        { name: 'category_type', type: 'TEXT', notNull: true },
        { name: 'category', type: 'TEXT', notNull: true },
        { name: 'total_weight', type: 'REAL', notNull: true, defaultValue: 0 },
        { name: 'total_amount', type: 'REAL', notNull: true, defaultValue: 0 },
        { name: 'computed_date', type: 'DATE', notNull: true }
      ],
      {
        tableName: 'client_product_summary',
        description: 'Pre-computed client product category summaries by year',
        uniqueKeyColumns: ['client_code', 'year', 'category_type', 'category'],
        duplicateAction: 'update'
      }
    );
  }
}

async function getAllAvailableYears(): Promise<string[]> {
  const query = `
    SELECT DISTINCT strftime('%Y', 일자) as year
    FROM (
      SELECT 일자 FROM sales WHERE 일자 IS NOT NULL
      UNION
      SELECT 일자 FROM east_division_sales WHERE 일자 IS NOT NULL
      UNION
      SELECT 일자 FROM west_division_sales WHERE 일자 IS NOT NULL
    )
    WHERE year IS NOT NULL
    ORDER BY year DESC
  `;

  const resultRaw = await executeSQL(query);
  const resultArray = Array.isArray(resultRaw) ? resultRaw : (resultRaw?.rows || []);

  return resultArray.map((row: any) => row.year).filter(Boolean);
}

async function isTableEmpty(): Promise<boolean> {
  try {
    const countQuery = 'SELECT COUNT(*) as count FROM client_product_summary';
    const resultRaw = await executeSQL(countQuery);
    const resultArray = Array.isArray(resultRaw) ? resultRaw : (resultRaw?.rows || []);
    const count = resultArray[0]?.count || 0;
    return count === 0;
  } catch (error) {
    // If query fails, assume table is empty/doesn't exist
    return true;
  }
}

async function computeProductSummary(year: string, categoryType: CategoryType): Promise<ProductSummaryRow[]> {
  let caseStatement: string;
  let havingClause: string;

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
      '${year}' as year,
      '${categoryType}' as category_type,
      ${caseStatement} as category,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight,
      SUM(CAST(REPLACE(s.합계, ',', '') AS NUMERIC)) as total_amount,
      date('now') as computed_date
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
    WHERE strftime('%Y', s.일자) = '${year}'
      AND e.사원_담당_명 != '김도량'
      AND i.품목코드 IS NOT NULL
    GROUP BY client_code, category
    HAVING ${havingClause}
  `;

  const resultRaw = await executeSQL(productQuery);
  const resultArray = Array.isArray(resultRaw) ? resultRaw : (resultRaw?.rows || []);

  return resultArray.map((row: any) => ({
    client_code: row.client_code,
    year: row.year,
    category_type: row.category_type,
    category: row.category,
    total_weight: Number(row.total_weight || 0),
    total_amount: Number(row.total_amount || 0),
    computed_date: row.computed_date
  }));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { years, force } = body;

    // Ensure table exists
    await ensureTableExists();

    // Determine which years to process
    let yearsToProcess: string[];
    let isInitialLoad = false;

    if (years) {
      // User explicitly specified years
      yearsToProcess = years;
    } else {
      // Smart selection based on table state
      const tableEmpty = await isTableEmpty();

      if (tableEmpty) {
        // First time: process ALL available years
        console.log('📊 Initial load detected - processing all available years...');
        yearsToProcess = await getAllAvailableYears();
        isInitialLoad = true;
      } else {
        // Subsequent refresh: only recent years
        const currentYear = new Date().getFullYear();
        yearsToProcess = [
          String(currentYear - 1),
          String(currentYear)
        ];
        console.log('🔄 Incremental refresh - updating recent years only...');
      }
    }

    console.log(`📅 Processing years: ${yearsToProcess.join(', ')}`);
    console.log(`📊 Total years: ${yearsToProcess.length}`);

    let totalRowsInserted = 0;
    const categoryTypes: CategoryType[] = ['tier', 'division', 'family'];

    for (const year of yearsToProcess) {
      // Clear existing data for this year if force refresh
      if (force) {
        await deleteRows('client_product_summary', {
          filters: { year }
        });
        console.log(`Cleared existing data for year ${year}`);
      }

      for (const categoryType of categoryTypes) {
        console.log(`Computing ${categoryType} for year ${year}...`);

        const summaryRows = await computeProductSummary(year, categoryType);

        if (summaryRows.length > 0) {
          await insertRows('client_product_summary', summaryRows);
          totalRowsInserted += summaryRows.length;
          console.log(`Inserted ${summaryRows.length} rows for ${year} - ${categoryType}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${yearsToProcess.length} years with ${totalRowsInserted} total rows`,
      years: yearsToProcess,
      rowsInserted: totalRowsInserted,
      isInitialLoad,
      yearRange: yearsToProcess.length > 0 ? `${yearsToProcess[yearsToProcess.length - 1]}-${yearsToProcess[0]}` : ''
    });
  } catch (error) {
    console.error('Failed to refresh product summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh product summary', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureTableExists();

    // Get summary statistics about the table
    const statsQuery = `
      SELECT
        year,
        category_type,
        COUNT(*) as row_count,
        MAX(computed_date) as computed_date
      FROM client_product_summary
      GROUP BY year, category_type
      ORDER BY year DESC, category_type
    `;

    const statsRaw = await executeSQL(statsQuery);
    const stats = Array.isArray(statsRaw) ? statsRaw : (statsRaw?.rows || []);

    return NextResponse.json({
      success: true,
      data: {
        stats,
        tableExists: true
      }
    });
  } catch (error) {
    console.error('Failed to get product summary stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get product summary stats', details: String(error) },
      { status: 500 }
    );
  }
}
