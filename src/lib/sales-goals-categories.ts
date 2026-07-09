/**
 * Product-group categories for sales_goals.
 * Stored as raw 품목그룹1코드 buckets so B2C (PVL/CVL) and B2B (AUTO / AVI+MAR) can both map cleanly.
 */

export const GOAL_CATEGORY_TYPE = 'product_group' as const;

/** Canonical categories stored on sales_goals.category */
export const GOAL_PRODUCT_CATEGORIES = [
  'MB',
  'AVI',
  'MAR',
  'PVL',
  'CVL',
  'IL',
  '기타',
] as const;

export type GoalProductCategory = (typeof GOAL_PRODUCT_CATEGORIES)[number];

export const GOAL_CATEGORY_ORDER: GoalProductCategory[] = [...GOAL_PRODUCT_CATEGORIES];

/** SQL CASE: product-group column → goal category */
export function sqlGoalCategoryCase(columnExpr: string): string {
  return `
  CASE
    WHEN ${columnExpr} = 'MB' THEN 'MB'
    WHEN ${columnExpr} = 'AVI' THEN 'AVI'
    WHEN ${columnExpr} = 'MAR' THEN 'MAR'
    WHEN ${columnExpr} = 'PVL' THEN 'PVL'
    WHEN ${columnExpr} = 'CVL' THEN 'CVL'
    WHEN ${columnExpr} = 'IL' THEN 'IL'
    ELSE '기타'
  END
`;
}

/** Default: sales subquery alias `s` already exposes 품목그룹1코드 */
export const SQL_SALES_GOAL_CATEGORY_CASE = sqlGoalCategoryCase('s.품목그룹1코드');

/** Map stored goal category → monthly-summary / B2B-style display bucket */
export function mapGoalCategoryToMonthlySummary(category: string): string {
  if (category === 'PVL' || category === 'CVL') return 'AUTO';
  if (GOAL_PRODUCT_CATEGORIES.includes(category as GoalProductCategory)) return category;
  return '기타';
}

/** Map stored goal category → B2B IL analysis display bucket */
export function mapGoalCategoryToB2b(category: string): string {
  if (category === 'PVL' || category === 'CVL') return 'AUTO';
  if (category === 'AVI' || category === 'MAR') return 'AVI + MAR';
  if (category === 'MB' || category === 'IL') return category;
  return '';
}

/** Map stored goal category → B2C AUTO analysis display bucket (identity for known codes) */
export function mapGoalCategoryToB2c(category: string): string {
  if (GOAL_PRODUCT_CATEGORIES.includes(category as GoalProductCategory)) return category;
  return '기타';
}

export function isGoalProductCategory(value: string): value is GoalProductCategory {
  return (GOAL_PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeGoalCategory(value: unknown): GoalProductCategory {
  const raw = String(value ?? '').trim();
  if (isGoalProductCategory(raw)) return raw;
  return '기타';
}
