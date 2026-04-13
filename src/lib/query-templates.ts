/**
 * Query Template System
 *
 * Pattern-based natural language query matching for common database queries.
 * Provides fast, free, and secure SQL generation for common use cases.
 *
 * Amount columns: synced ERP tables use `합계` (gross) and `공급가액` (ex-VAT). Do not use 합계/1.1 for ex-VAT when `공급가액` exists.
 */

export interface QueryTemplate {
  pattern: RegExp;
  intent: string;
  paramExtractor: (query: string) => Record<string, string> | null;

  // Single-query (existing)
  sqlGenerator?: (params: Record<string, string>) => string;

  // Multi-query (new)
  multiQuery?: boolean;
  sqlGenerators?: Array<{
    title: string;
    description?: string;
    generator: (params: Record<string, string>) => string;
    intent: string;
  }>;
}

/**
 * Extract date parameters from query
 */
function extractDateParam(query: string): string {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (/오늘|today/i.test(query)) return today;
  if (/어제|yesterday/i.test(query)) return yesterday;

  // Extract M월 D일 format (e.g., "2월 7일")
  const koreanDateMatch = query.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanDateMatch) {
    const month = koreanDateMatch[1].padStart(2, '0');
    const day = koreanDateMatch[2].padStart(2, '0');
    const year = new Date().getFullYear();
    return `${year}-${month}-${day}`;
  }

  // Extract YYYY-MM-DD format
  const dateMatch = query.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1];

  return today;
}

/**
 * Extract month parameters
 */
function extractMonthParam(query: string): { startDate: string, endDate: string } {
  const now = new Date();

  if (/이번\s*달|this\s*month/i.test(query)) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }

  if (/지난\s*달|last\s*month/i.test(query)) {
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }

  // Default to current month
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

/**
 * Extract division/branch parameter
 */
function extractDivision(query: string): string | null {
  const divisions = ['창원', '화성', 'MB', '남부', '중부', '서부', '동부', '제주', '부산', '서울'];
  for (const div of divisions) {
    if (query.includes(div)) return div;
  }
  return null;
}

/**
 * Normalize branch name for SQL queries
 * @param columnName - The column to normalize (e.g., '거래처그룹1코드명' for sales, '창고명' for inventory)
 */
function normalizeBranch(columnName: string): string {
  return `CASE
    WHEN ${columnName} LIKE '%창원%' THEN '창원'
    WHEN ${columnName} LIKE '%화성%' THEN '화성'
    WHEN ${columnName} LIKE '%MB%' THEN 'MB'
    WHEN ${columnName} LIKE '%남부%' THEN '남부'
    WHEN ${columnName} LIKE '%중부%' THEN '중부'
    WHEN ${columnName} LIKE '%서부%' THEN '서부'
    WHEN ${columnName} LIKE '%동부%' THEN '동부'
    WHEN ${columnName} LIKE '%제주%' THEN '제주'
    WHEN ${columnName} LIKE '%부산%' THEN '부산'
    ELSE ${columnName}
  END`;
}

/**
 * Query Templates
 */
export const QUERY_TEMPLATES: QueryTemplate[] = [
  // Multi-query templates (should come first for priority matching)

  // 1. Sales and Inventory (e.g., "오늘 매출과 재고", "매출 재고")
  {
    pattern: /매출.*재고|재고.*매출/i,
    intent: 'sales_and_inventory',
    multiQuery: true,
    paramExtractor: (query) => {
      const date = extractDateParam(query);
      const division = extractDivision(query);
      return { date, division: division || '' };
    },
    sqlGenerators: [
      {
        title: '매출 현황',
        intent: 'daily_sales_by_branch',
        generator: (params) => {
          const divisionFilter = params.division
            ? `AND 거래처그룹1코드명 LIKE '%${params.division}%'`
            : '';

          return `
            SELECT
              ${normalizeBranch('거래처그룹1코드명')} as 사업소,
              SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as 총매출액
            FROM sales
            WHERE 일자 = '${params.date}'
              ${divisionFilter}
            GROUP BY ${normalizeBranch('거래처그룹1코드명')}
            ORDER BY 총매출액 DESC
          `;
        }
      },
      {
        title: '재고 현황',
        intent: 'inventory_status',
        generator: (params) => {
          const divisionFilter = params.division
            ? `WHERE 창고명 LIKE '%${params.division}%'`
            : '';

          return `
            SELECT
              창고명,
              품목명_규격_,
              CAST(REPLACE(재고수량, ',', '') AS NUMERIC) as 재고수량
            FROM inventory
            ${divisionFilter}
            ORDER BY CAST(REPLACE(재고수량, ',', '') AS NUMERIC) DESC
            LIMIT 100
          `;
        }
      }
    ]
  },

  // 2. Sales and Collections (e.g., "매출과 수금", "수금 매출")
  {
    pattern: /매출.*수금|수금.*매출/i,
    intent: 'sales_and_collections',
    multiQuery: true,
    paramExtractor: (query) => {
      const date = extractDateParam(query);
      const division = extractDivision(query);
      return { date, division: division || '' };
    },
    sqlGenerators: [
      {
        title: '매출 현황',
        intent: 'daily_sales_by_branch',
        generator: (params) => {
          const divisionFilter = params.division
            ? `AND 거래처그룹1코드명 LIKE '%${params.division}%'`
            : '';

          return `
            SELECT
              ${normalizeBranch('거래처그룹1코드명')} as 사업소,
              SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as 총매출액
            FROM sales
            WHERE 일자 = '${params.date}'
              ${divisionFilter}
            GROUP BY ${normalizeBranch('거래처그룹1코드명')}
            ORDER BY 총매출액 DESC
          `;
        }
      },
      {
        title: '수금 현황',
        intent: 'daily_collections',
        generator: (params) => {
          const divisionFilter = params.division
            ? `AND c.거래처그룹1명 LIKE '%${params.division}%'`
            : '';

          return `
            SELECT
              ${normalizeBranch('c.거래처그룹1명')} as 사업소,
              c.거래처명,
              SUM(COALESCE(l.대변금액, 0)) as 수금액
            FROM ledger l
            LEFT JOIN clients c ON l.거래처코드 = c.거래처코드
            WHERE l.일자 = '${params.date}'
              AND l.계정코드 = '1089'
              AND l.대변금액 > 0
              AND l.적요 NOT LIKE '%할인%'
              ${divisionFilter}
            GROUP BY 1, 2
            ORDER BY 수금액 DESC
          `;
        }
      }
    ]
  },

  // Single-query templates

  // 3. Specific date + division sales (e.g., "2월 7일 창원 매출")
  {
    pattern: /(\d{1,2}월\s*\d{1,2}일|\d{4}-\d{2}-\d{2}|오늘|어제).*(창원|화성|MB|남부|중부|서부|동부|제주|부산|서울).*매출|(창원|화성|MB|남부|중부|서부|동부|제주|부산|서울).*(\d{1,2}월\s*\d{1,2}일|\d{4}-\d{2}-\d{2}|오늘|어제).*매출/i,
    intent: 'daily_sales_by_division',
    paramExtractor: (query) => ({
      date: extractDateParam(query),
      division: extractDivision(query) || ''
    }),
    sqlGenerator: (params) => `
      SELECT
        ${normalizeBranch('거래처그룹1코드명')} as 사업소,
        SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as 총매출액
      FROM sales
      WHERE 일자 = '${params.date}'
        AND 거래처그룹1코드명 LIKE '%${params.division}%'
      GROUP BY ${normalizeBranch('거래처그룹1코드명')}
    `
  },

  // 4. Today's total sales
  {
    pattern: /오늘.*매출|매출.*오늘/i,
    intent: 'daily_total_sales',
    paramExtractor: (query) => ({
      date: extractDateParam(query)
    }),
    sqlGenerator: (params) => `
      SELECT
        ${normalizeBranch('거래처그룹1코드명')} as 사업소,
        SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as 총매출액
      FROM sales
      WHERE 일자 = '${params.date}'
      GROUP BY ${normalizeBranch('거래처그룹1코드명')}
      ORDER BY 총매출액 DESC
    `
  },

  // 3. Monthly sales by branch (this month)
  {
    pattern: /이번\s*달.*사업소.*매출|사업소.*이번\s*달.*매출/i,
    intent: 'monthly_sales_by_branch',
    paramExtractor: (query) => {
      const { startDate, endDate } = extractMonthParam(query);
      return { startDate, endDate };
    },
    sqlGenerator: (params) => `
      SELECT
        ${normalizeBranch('거래처그룹1코드명')} as 사업소,
        SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as 총매출액,
        SUM(CASE
          WHEN 품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
          THEN CAST(REPLACE(합계, ',', '') AS NUMERIC)
          ELSE 0
        END) as 모빌매출액
      FROM sales
      WHERE 일자 BETWEEN '${params.startDate}' AND '${params.endDate}'
      GROUP BY ${normalizeBranch('거래처그룹1코드명')}
      ORDER BY 총매출액 DESC
    `
  },

  // 3b. Monthly sales by branch (last month)
  {
    pattern: /지난\s*달.*사업소.*매출|사업소.*지난\s*달.*매출|저번\s*달.*사업소.*매출|사업소.*저번\s*달.*매출/i,
    intent: 'monthly_sales_by_branch',
    paramExtractor: (query) => {
      const { startDate, endDate } = extractMonthParam(query);
      return { startDate, endDate };
    },
    sqlGenerator: (params) => `
      SELECT
        ${normalizeBranch('거래처그룹1코드명')} as 사업소,
        SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as 총매출액,
        SUM(CASE
          WHEN 품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')
          THEN CAST(REPLACE(합계, ',', '') AS NUMERIC)
          ELSE 0
        END) as 모빌매출액
      FROM sales
      WHERE 일자 BETWEEN '${params.startDate}' AND '${params.endDate}'
      GROUP BY ${normalizeBranch('거래처그룹1코드명')}
      ORDER BY 총매출액 DESC
    `
  },

  // 4. Inventory status
  {
    pattern: /재고.*현황|현재.*재고|창고.*재고/i,
    intent: 'inventory_status',
    paramExtractor: (query) => {
      const division = extractDivision(query);
      return { division: division || '' };
    },
    sqlGenerator: (params) => {
      const whereClause = params.division
        ? `WHERE 창고명 LIKE '%${params.division}%'`
        : '';

      return `
        SELECT
          창고명,
          품목명_규격_,
          CAST(REPLACE(재고수량, ',', '') AS NUMERIC) as 재고수량
        FROM inventory
        ${whereClause}
        ORDER BY CAST(REPLACE(재고수량, ',', '') AS NUMERIC) DESC
        LIMIT 100
      `;
    }
  },

  // 5. High inventory items
  {
    pattern: /재고.*많은.*품목|품목.*재고.*많은/i,
    intent: 'high_inventory',
    paramExtractor: (query) => {
      const limitMatch = query.match(/(\d+)개|상위\s*(\d+)/);
      const limit = limitMatch ? (limitMatch[1] || limitMatch[2]) : '10';
      return { limit };
    },
    sqlGenerator: (params) => `
      SELECT
        창고명,
        품목명_규격_,
        CAST(REPLACE(재고수량, ',', '') AS NUMERIC) as 재고수량
      FROM inventory
      WHERE CAST(REPLACE(재고수량, ',', '') AS NUMERIC) > 0
      ORDER BY CAST(REPLACE(재고수량, ',', '') AS NUMERIC) DESC
      LIMIT ${params.limit}
    `
  },

  // 6. Yesterday's collections
  {
    pattern: /어제.*수금|수금.*어제|오늘.*수금|수금.*오늘/i,
    intent: 'daily_collections',
    paramExtractor: (query) => {
      const date = extractDateParam(query);
      const division = extractDivision(query);
      return { date, division: division || '' };
    },
    sqlGenerator: (params) => {
      const divisionFilter = params.division
        ? `AND c.거래처그룹1명 LIKE '%${params.division}%'`
        : '';

      return `
        SELECT
          ${normalizeBranch('c.거래처그룹1명')} as 사업소,
          c.거래처명,
          SUM(COALESCE(l.대변금액, 0)) as 수금액
        FROM ledger l
        LEFT JOIN clients c ON l.거래처코드 = c.거래처코드
        WHERE l.일자 = '${params.date}'
          AND l.계정코드 = '1089'
          AND l.대변금액 > 0
          AND l.적요 NOT LIKE '%할인%'
          ${divisionFilter}
        GROUP BY 1, 2
        ORDER BY 수금액 DESC
      `;
    }
  },

  // 7. Sales by customer
  {
    pattern: /^([가-힣a-zA-Z0-9\s]+)(?:거래처|고객|회사)?\s*매출$/i,
    intent: 'customer_sales',
    paramExtractor: (query) => {
      // Exclude comparison queries (대비, 증가율, 비교, vs, etc.)
      if (/대비|증가|감소|비교|차이|vs|versus|compared/i.test(query)) {
        return null as any;
      }

      // Exclude date-based queries (these should be handled by other templates)
      if (/\d{1,2}월\s*\d{1,2}일|\d{4}-\d{2}-\d{2}|오늘|어제/i.test(query)) {
        return null as any;
      }

      // Exclude branch-based queries
      if (/사업소|지사|창원|화성|MB|남부|중부|서부|동부|제주|부산/i.test(query)) {
        return null as any;
      }

      // Extract customer name (anything before "매출")
      const match = query.match(/^(.+?)(?:거래처|고객|회사)?\s*매출$/);
      const customer = match ? match[1].trim() : '';
      const { startDate, endDate } = extractMonthParam(query);
      return { customer, startDate, endDate };
    },
    sqlGenerator: (params) => `
      SELECT
        판매처명,
        SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as 총매출액,
        COUNT(*) as 거래건수
      FROM sales
      WHERE 판매처명 LIKE '%${params.customer}%'
        AND 일자 BETWEEN '${params.startDate}' AND '${params.endDate}'
      GROUP BY 판매처명
      ORDER BY 총매출액 DESC
    `
  },

  // 8. Pending purchases
  {
    pattern: /미구매.*현황|구매.*대기/i,
    intent: 'pending_purchases',
    paramExtractor: (query) => ({}),
    sqlGenerator: (params) => `
      SELECT
        (i.품목명 || ' ' || COALESCE(i.규격정보, '')) as 품명_및_규격,
        c.거래처명 as 거래처명,
        CAST(REPLACE(pp.잔량, ',', '') AS NUMERIC) as 잔량,
        pp.납기일자
      FROM pending_purchases pp
      LEFT JOIN items i ON pp.품목코드 = i.품목코드
      LEFT JOIN clients c ON pp.거래처코드 = c.거래처코드
      WHERE CAST(REPLACE(pp.잔량, ',', '') AS NUMERIC) > 0
      ORDER BY pp.납기일자 ASC
      LIMIT 50
    `
  },

  // 9. Pending sales
  {
    pattern: /미판매.*현황|판매.*대기/i,
    intent: 'pending_sales',
    paramExtractor: (query) => ({}),
    sqlGenerator: (params) => `
      SELECT
        (i.품목명 || ' ' || COALESCE(i.규격정보, '')) as 품명_및_규격,
        c.거래처명 as 거래처명,
        CAST(REPLACE(ps.잔량, ',', '') AS NUMERIC) as 잔량,
        ps.납기일자
      FROM pending_sales ps
      LEFT JOIN items i ON ps.품목코드 = i.품목코드
      LEFT JOIN clients c ON ps.거래처코드 = c.거래처코드
      WHERE CAST(REPLACE(ps.잔량, ',', '') AS NUMERIC) > 0
      ORDER BY ps.납기일자 ASC
    `
  },

  // 10. Product group sales
  {
    pattern: /(모빌|플래그십).*매출|매출.*(모빌|플래그십)/i,
    intent: 'product_group_sales',
    paramExtractor: (query) => {
      const productType = /모빌/i.test(query) ? 'mobil' : 'flagship';
      const { startDate, endDate } = extractMonthParam(query);
      return { productType, startDate, endDate };
    },
    sqlGenerator: (params) => {
      const productFilter = params.productType === 'mobil'
        ? "품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')"
        : "코드변경 = 'FLA'";

      return `
        SELECT
          ${normalizeBranch('거래처그룹1코드명')} as 사업소,
          SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as 매출액,
          SUM(CAST(REPLACE(중량, ',', '') AS NUMERIC)) as 중량
        FROM sales
        WHERE ${productFilter}
          AND 일자 BETWEEN '${params.startDate}' AND '${params.endDate}'
        GROUP BY ${normalizeBranch('거래처그룹1코드명')}
        ORDER BY 매출액 DESC
      `;
    }
  }
];

/**
 * Match natural language query to template
 */
export function matchQueryTemplate(query: string): { template: QueryTemplate; params: Record<string, string> } | null {
  for (const template of QUERY_TEMPLATES) {
    if (template.pattern.test(query)) {
      const params = template.paramExtractor(query);
      // Skip if paramExtractor returns null (conditional matching)
      if (params === null || params === undefined) {
        continue;
      }
      return { template, params };
    }
  }
  return null;
}

export interface TemplateQueryResult {
  title: string;
  description?: string;
  sql: string;
  intent: string;
}

export interface MultiTemplateResult {
  results: TemplateQueryResult[];
}

/**
 * Generate SQL from natural language query using templates
 */
export function generateSQLFromTemplate(query: string): MultiTemplateResult | null {
  const match = matchQueryTemplate(query);
  if (!match) return null;

  // Multi-query template
  if (match.template.multiQuery && match.template.sqlGenerators) {
    return {
      results: match.template.sqlGenerators.map(gen => ({
        title: gen.title,
        description: gen.description,
        sql: gen.generator(match.params).trim(),
        intent: gen.intent
      }))
    };
  }

  // Single-query template (backward compatible)
  if (match.template.sqlGenerator) {
    const sql = match.template.sqlGenerator(match.params).trim();
    return {
      results: [{
        title: '검색 결과',
        sql,
        intent: match.template.intent
      }]
    };
  }

  return null;
}
