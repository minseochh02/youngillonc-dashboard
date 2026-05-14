import { executeSQL } from '@/egdesk-helpers';
import { compareOffices, compareTeams, loadFullDisplayOrderContext } from '@/lib/display-order';
import {
  sqlAndEmployeeNotSpecialHandling,
  sqlAndSalesRemarkNotExact,
  sqlSalesResolvedClientKeyExpr,
} from '@/lib/special-handling-employees';
import { rebuildComputedInventoryMonthly, CATEGORIES } from './computed-inventory-utils';

/** Simple lock to prevent multiple concurrent rebuilds */
let isRebuildingComputedInventory = false;

const WHERE_B2C = `(ec.b2c_팀 IS NULL OR ec.b2c_팀 != 'B2B')`;
const WHERE_B2B = `ec.b2c_팀 = 'B2B'`;

const B2B_TEAM = `COALESCE(NULLIF(TRIM(ec.b2b팀), ''), '미분류')`;

/** Simple server-side cache to speed up repeated requests */
const PAYLOAD_CACHE = new Map<string, { timestamp: number; payload: CumulativeViewPayload }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** 담당자 사원분류(전체사업소) → 표시용 사업소 (closing-meeting route와 동일) */
const BRANCH_FROM_EC = `
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

const SALES_CAT = `
  CASE
    WHEN s.품목그룹1코드 = 'MB' THEN 'MB'
    WHEN s.품목그룹1코드 = 'AVI' THEN 'AVI'
    WHEN s.품목그룹1코드 = 'MAR' THEN 'MAR'
    WHEN s.품목그룹1코드 = 'PVL' THEN 'PVL'
    WHEN s.품목그룹1코드 = 'CVL' THEN 'CVL'
    WHEN s.품목그룹1코드 = 'IL' THEN 'IL'
    ELSE '기타'
  END
`;

const PUR_CAT = `
  CASE
    WHEN p.품목그룹1코드 = 'MB' THEN 'MB'
    WHEN p.품목그룹1코드 = 'AVI' THEN 'AVI'
    WHEN p.품목그룹1코드 = 'MAR' THEN 'MAR'
    WHEN p.품목그룹1코드 = 'PVL' THEN 'PVL'
    WHEN p.품목그룹1코드 = 'CVL' THEN 'CVL'
    WHEN p.품목그룹1코드 = 'IL' THEN 'IL'
    ELSE '기타'
  END
`;


// Raw (pass-through) versions for custom-group — no ELSE '기타' fallback
const SALES_CAT_RAW = `TRIM(COALESCE(s.품목그룹1코드, ''))`;
const PUR_CAT_RAW = `TRIM(COALESCE(p.품목그룹1코드, ''))`;
const CAT_KNOWN_ORDER = ['MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL'];
function catSortIndex(v: string): number {
  const i = CAT_KNOWN_ORDER.indexOf(v);
  return i >= 0 ? i : CAT_KNOWN_ORDER.length;
}
const SALES_CLIENT_KEY_EXPR = sqlSalesResolvedClientKeyExpr('s');

export interface CumulativeMetricBlock {
  yPast3: number;
  yPast2: number;
  yPast1: number;
  yCurrent: number;
  growthRate: number;
  /** 증감율 계산에 쓴 동기간 YTD(전체 합계 행에서 합산) */
  growthBaseY1?: number;
  growthBaseY0?: number;
  cum: {
    priorYear: number;
    target: number;
    currentYear: number;
    achievementRate: number;
    yoyRate: number;
  };
  mo: {
    priorYear: number;
    target: number;
    currentYear: number;
    achievementRate: number;
    yoyRate: number;
  };
}

export interface CumulativeRow {
  rowKind:
    | 'inventory'
    | 'sellin'
    | 'total'
    | 'branch_subtotal'
    | 'team'
    | 'b2b_total'
    | 'b2b_branch_subtotal'
    | 'b2b_team';
  label: string;
  metrics: CumulativeMetricBlock;
  amountMetrics?: CumulativeMetricBlock;
}

export interface CumulativeSection {
  category: string;
  group3?: string;
  clientGroup2?: string;
  rows: CumulativeRow[];
}

export interface CumulativeViewPayload {
  yearLabels: { yPast3: number; yPast2: number; yPast1: number; yCurrent: number };
  monthLabel: string;
  sections: CumulativeSection[];
  availableMonths: string[];
  currentMonth: string;
  availableGroup3Codes?: string[];
  availableGroup1Codes?: string[];
  availableClientGroup2Codes?: string[];
}

/** 증감율: 동일 기간 YTD끼리 (전년 동월까지 vs 당해 동월까지) */
function withYtdYoYGrowth(
  m: CumulativeMetricBlock,
  y1Ytd: number,
  y0Ytd: number
): CumulativeMetricBlock {
  const growthRate = y1Ytd !== 0 ? (y0Ytd - y1Ytd) / y1Ytd : 0;
  return { ...m, growthRate, growthBaseY1: y1Ytd, growthBaseY0: y0Ytd };
}

function blk(
  y3: number,
  y2: number,
  y1: number,
  y0: number,
  cp: number,
  ct: number,
  cc: number,
  mp: number,
  mt: number,
  mc: number
): CumulativeMetricBlock {
  const growthRate = y1 !== 0 ? (y0 - y1) / y1 : 0;
  const achievementRate = ct !== 0 ? cc / ct : 0;
  const yoyRate = cp !== 0 ? (cc - cp) / cp : 0;
  const moAchievement = mt !== 0 ? mc / mt : 0;
  const moYoy = mp !== 0 ? (mc - mp) / mp : 0;
  return {
    yPast3: Math.round(y3),
    yPast2: Math.round(y2),
    yPast1: Math.round(y1),
    yCurrent: Math.round(y0),
    growthRate,
    cum: {
      priorYear: Math.round(cp),
      target: Math.round(ct),
      currentYear: Math.round(cc),
      achievementRate,
      yoyRate,
    },
    mo: {
      priorYear: Math.round(mp),
      target: Math.round(mt),
      currentYear: Math.round(mc),
      achievementRate: moAchievement,
      yoyRate: moYoy,
    },
  };
}

function getYtdYearFilter(y3: number, y2: number, y1: number, y0: number, monthNum: string, alias: string) {
  return `(
    (substr(${alias}.일자, 1, 4) = '${y3}' AND substr(${alias}.일자, 6, 2) <= '${monthNum}')
    OR (substr(${alias}.일자, 1, 4) = '${y2}' AND substr(${alias}.일자, 6, 2) <= '${monthNum}')
    OR (substr(${alias}.일자, 1, 4) = '${y1}' AND substr(${alias}.일자, 6, 2) <= '${monthNum}')
    OR (substr(${alias}.일자, 1, 4) = '${y0}' AND substr(${alias}.일자, 6, 2) <= '${monthNum}')
  )`;
}

export type CumulativeViewChannel = 'combined' | 'b2c' | 'b2b';

export async function buildCumulativeViewPayload(params: {
  currentMonthStr: string;
  currentYear: number;
  availableMonths: string[];
  baseSalesSubquery: string;
  basePurchasesSubquery: string;
  /** `combined` = 마감회의 전체(기본). `b2c` / `b2b` = 해당 채널만. */
  cumulativeChannel?: CumulativeViewChannel;
  /** If true, ignore and overwrite server-side cache */
  refresh?: boolean;
}): Promise<CumulativeViewPayload> {
  const {
    currentMonthStr,
    currentYear,
    availableMonths,
    baseSalesSubquery,
    basePurchasesSubquery,
    cumulativeChannel = 'combined',
    refresh = false,
  } = params;

  // 1. Check server-side cache
  const cacheKey = `${currentMonthStr}:${cumulativeChannel}`;
  if (!refresh) {
    const cached = PAYLOAD_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.payload;
    }
  }

  const monthNum = currentMonthStr.split('-')[1];
  const monthInt = parseInt(monthNum, 10);
  const y0 = currentYear;
  const y1 = currentYear - 1;
  const y2 = currentYear - 2;
  const y3 = currentYear - 3;
  const monthKeyPrev = `${y1}-${monthNum}`;
  const monthKeyCur = `${y0}-${monthNum}`;

  const displayOrderMaps = await loadFullDisplayOrderContext();

  const salesYtdFilter = getYtdYearFilter(y3, y2, y1, y0, monthNum, 's');
  const purYtdFilter = getYtdYearFilter(y3, y2, y1, y0, monthNum, 'p');
  const yearlyMonthKeys = Array.from(
    new Set([
      `${y3}-${monthNum}`,
      `${y2}-${monthNum}`,
      `${y1}-${monthNum}`,
      `${y0}-${monthNum}`,
      `${y3}-12`,
      `${y2}-12`,
      `${y1}-12`,
      `${y0}-12`,
    ])
  );
  const computedInventoryByMonthCat = new Map<string, number>();
  const computedAtMap = new Map<string, string>();
  const computedInventorySql = `
    SELECT month, category, inventory_weight, computed_at
    FROM computed_inventory_monthly
    WHERE month IN ('${yearlyMonthKeys.join("','")}')
  `;

  const fetchComputedInventory = async () => {
    const res = await executeSQL(computedInventorySql);
    (res?.rows || []).forEach((row: any) => {
      const k = `${String(row.month)}\t${String(row.category)}`;
      computedInventoryByMonthCat.set(k, Number(row.inventory_weight) || 0);
      computedAtMap.set(k, String(row.computed_at || ''));
    });
  };

  await fetchComputedInventory();

  // Check if any required month/category is missing or stale
  const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const currentActualMonth = todayStr.slice(0, 7);

  let needsRebuild = false;
  for (const m of yearlyMonthKeys) {
    for (const cat of CATEGORIES) {
      const k = `${m}\t${cat}`;
      if (!computedInventoryByMonthCat.has(k)) {
        needsRebuild = true;
        break;
      }
      // If it's the current month, ensure it was computed today
      if (m === currentActualMonth && computedAtMap.get(k) !== todayStr) {
        needsRebuild = true;
        break;
      }
    }
    if (needsRebuild) break;
  }

  if (needsRebuild) {
    if (!isRebuildingComputedInventory) {
      isRebuildingComputedInventory = true;
      try {
        console.log('Missing or stale computed inventory detected. Rebuilding...');
        await rebuildComputedInventoryMonthly();
      } catch (e) {
        console.error('Failed to rebuild computed inventory:', e);
      } finally {
        isRebuildingComputedInventory = false;
      }
      computedInventoryByMonthCat.clear();
      computedAtMap.clear();
      await fetchComputedInventory();
    } else {
      // Wait for the other process to finish rebuilding (up to 20s)
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!isRebuildingComputedInventory) break;
      }
      computedInventoryByMonthCat.clear();
      computedAtMap.clear();
      await fetchComputedInventory();
    }
  }

  const getComputedInventory = (y: number, cat: string, monthOverride?: string): number => {
    const m = monthOverride ?? monthNum;
    const k = `${y}-${m}\t${cat}`;
    const v = computedInventoryByMonthCat.get(k);
    if (v == null) {
      throw new Error(
        `Missing computed inventory: month=${y}-${m}, category=${cat}. Run rebuild-computed-inventory-monthly first.`
      );
    }
    return v;
  };

  /** 과거 3개 연도: 연간 전체(1~12월). 실적 23·24·25년 컬럼용. 당해 연도(y0)는 YTD만 별도 쿼리. */
  const threePastYearsIn = `('${y3}', '${y2}', '${y1}')`;

  const salesAnnualSql = `
    SELECT
      CAST(substr(s.일자, 1, 4) AS INTEGER) as year,
      ${SALES_CAT} as category,
      (${BRANCH_FROM_EC}) as branch,
      ec.b2c_팀 as team,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(s.일자, 1, 4) IN ${threePastYearsIn}
      AND ${WHERE_B2C}
      ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
      AND ec.b2c_팀 IS NOT NULL AND TRIM(ec.b2c_팀) != ''
    GROUP BY 1, 2, 3, 4
  `;

  const purAnnualSql = `
    SELECT
      CAST(substr(p.일자, 1, 4) AS INTEGER) as year,
      ${PUR_CAT} as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(p.일자, 1, 4) IN ${threePastYearsIn}
      AND ${WHERE_B2C}
    GROUP BY 1, 2
  `;

  const b2bSalesAnnualSql = `
    SELECT
      CAST(substr(s.일자, 1, 4) AS INTEGER) as year,
      ${SALES_CAT} as category,
      (${BRANCH_FROM_EC}) as branch,
      ${B2B_TEAM} as team,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(s.일자, 1, 4) IN ${threePastYearsIn}
      AND ${WHERE_B2B}
      ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
    GROUP BY 1, 2, 3, 4
  `;

  const b2bPurAnnualSql = `
    SELECT
      CAST(substr(p.일자, 1, 4) AS INTEGER) as year,
      ${PUR_CAT} as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(p.일자, 1, 4) IN ${threePastYearsIn}
      AND ${WHERE_B2B}
    GROUP BY 1, 2
  `;

  const salesYtdSql = `
    SELECT
      CAST(substr(s.일자, 1, 4) AS INTEGER) as year,
      ${SALES_CAT} as category,
      (${BRANCH_FROM_EC}) as branch,
      ec.b2c_팀 as team,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE ${salesYtdFilter}
      AND ${WHERE_B2C}
      ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
      AND ec.b2c_팀 IS NOT NULL AND TRIM(ec.b2c_팀) != ''
    GROUP BY 1, 2, 3, 4
  `;

  const purYtdSql = `
    SELECT
      CAST(substr(p.일자, 1, 4) AS INTEGER) as year,
      ${PUR_CAT} as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE ${purYtdFilter}
      AND ${WHERE_B2C}
    GROUP BY 1, 2
  `;

  const salesMonthSql = `
    SELECT
      CAST(substr(s.일자, 1, 4) AS INTEGER) as year,
      ${SALES_CAT} as category,
      (${BRANCH_FROM_EC}) as branch,
      ec.b2c_팀 as team,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(s.일자, 1, 7) IN ('${monthKeyPrev}', '${monthKeyCur}')
      AND ${WHERE_B2C}
      ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
      AND ec.b2c_팀 IS NOT NULL AND TRIM(ec.b2c_팀) != ''
    GROUP BY 1, 2, 3, 4
  `;

  const purMonthSql = `
    SELECT
      CAST(substr(p.일자, 1, 4) AS INTEGER) as year,
      ${PUR_CAT} as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(p.일자, 1, 7) IN ('${monthKeyPrev}', '${monthKeyCur}')
      AND ${WHERE_B2C}
    GROUP BY 1, 2
  `;

  const goalsYtdSql = `
    SELECT
      sg.category as category,
      (${BRANCH_FROM_EC}) as branch,
      ec.b2c_팀 as team,
      SUM(sg.target_weight) as target_weight
    FROM sales_goals sg
    LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
    WHERE sg.year = '${y0}'
      AND CAST(TRIM(sg.month) AS INTEGER) <= ${monthInt}
      AND sg.category_type = 'division'
      AND ${WHERE_B2C}
      AND ec.b2c_팀 IS NOT NULL AND TRIM(ec.b2c_팀) != ''
    GROUP BY sg.category, 2, ec.b2c_팀
  `;

  const goalsMonthSql = `
    SELECT
      sg.category as category,
      (${BRANCH_FROM_EC}) as branch,
      ec.b2c_팀 as team,
      sg.year as year,
      SUM(sg.target_weight) as target_weight
    FROM sales_goals sg
    LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
    WHERE sg.category_type = 'division'
      AND CAST(TRIM(sg.month) AS INTEGER) = ${monthInt}
      AND sg.year IN ('${y1}', '${y0}')
      AND ${WHERE_B2C}
      AND ec.b2c_팀 IS NOT NULL AND TRIM(ec.b2c_팀) != ''
    GROUP BY sg.category, 2, ec.b2c_팀, sg.year
  `;

  const b2bSalesYtdSql = `
    SELECT
      CAST(substr(s.일자, 1, 4) AS INTEGER) as year,
      ${SALES_CAT} as category,
      (${BRANCH_FROM_EC}) as branch,
      ${B2B_TEAM} as team,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE ${salesYtdFilter}
      AND ${WHERE_B2B}
      ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
    GROUP BY 1, 2, 3, 4
  `;

  const b2bPurYtdSql = `
    SELECT
      CAST(substr(p.일자, 1, 4) AS INTEGER) as year,
      ${PUR_CAT} as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE ${purYtdFilter}
      AND ${WHERE_B2B}
    GROUP BY 1, 2
  `;

  const b2bSalesMonthSql = `
    SELECT
      CAST(substr(s.일자, 1, 4) AS INTEGER) as year,
      ${SALES_CAT} as category,
      (${BRANCH_FROM_EC}) as branch,
      ${B2B_TEAM} as team,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(s.일자, 1, 7) IN ('${monthKeyPrev}', '${monthKeyCur}')
      AND ${WHERE_B2B}
      ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
    GROUP BY 1, 2, 3, 4
  `;

  const b2bPurMonthSql = `
    SELECT
      CAST(substr(p.일자, 1, 4) AS INTEGER) as year,
      ${PUR_CAT} as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(p.일자, 1, 7) IN ('${monthKeyPrev}', '${monthKeyCur}')
      AND ${WHERE_B2B}
    GROUP BY 1, 2
  `;

  const b2bGoalsYtdSql = `
    SELECT
      sg.category as category,
      (${BRANCH_FROM_EC}) as branch,
      ${B2B_TEAM} as team,
      SUM(sg.target_weight) as target_weight
    FROM sales_goals sg
    LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
    WHERE sg.year = '${y0}'
      AND CAST(TRIM(sg.month) AS INTEGER) <= ${monthInt}
      AND sg.category_type = 'division'
      AND ${WHERE_B2B}
    GROUP BY sg.category, 2, 3
  `;

  const b2bGoalsMonthSql = `
    SELECT
      sg.category as category,
      (${BRANCH_FROM_EC}) as branch,
      ${B2B_TEAM} as team,
      sg.year as year,
      SUM(sg.target_weight) as target_weight
    FROM sales_goals sg
    LEFT JOIN employee_category ec ON sg.employee_name = ec.담당자
    WHERE sg.category_type = 'division'
      AND CAST(TRIM(sg.month) AS INTEGER) = ${monthInt}
      AND sg.year IN ('${y1}', '${y0}')
      AND ${WHERE_B2B}
    GROUP BY sg.category, 2, 3, sg.year
  `;

  type SqlResult = Awaited<ReturnType<typeof executeSQL>>;
  const empty = { rows: [] } as SqlResult;

  let salesYtdRes: SqlResult;
  let purYtdRes: SqlResult;
  let salesMoRes: SqlResult;
  let purMoRes: SqlResult;
  let goalsYtdRes: SqlResult;
  let goalsMoRes: SqlResult;
  let b2bSalesYtdRes: SqlResult;
  let b2bPurYtdRes: SqlResult;
  let b2bSalesMoRes: SqlResult;
  let b2bPurMoRes: SqlResult;
  let b2bGoalsYtdRes: SqlResult;
  let b2bGoalsMoRes: SqlResult;
  let salesAnnualRes: SqlResult;
  let purAnnualRes: SqlResult;
  let b2bSalesAnnualRes: SqlResult;
  let b2bPurAnnualRes: SqlResult;

  if (cumulativeChannel === 'combined') {
    [
      salesYtdRes,
      purYtdRes,
      salesMoRes,
      purMoRes,
      goalsYtdRes,
      goalsMoRes,
      b2bSalesYtdRes,
      b2bPurYtdRes,
      b2bSalesMoRes,
      b2bPurMoRes,
      b2bGoalsYtdRes,
      b2bGoalsMoRes,
      salesAnnualRes,
      purAnnualRes,
      b2bSalesAnnualRes,
      b2bPurAnnualRes,
    ] = await Promise.all([
      executeSQL(salesYtdSql),
      executeSQL(purYtdSql),
      executeSQL(salesMonthSql),
      executeSQL(purMonthSql),
      executeSQL(goalsYtdSql),
      executeSQL(goalsMonthSql),
      executeSQL(b2bSalesYtdSql),
      executeSQL(b2bPurYtdSql),
      executeSQL(b2bSalesMonthSql),
      executeSQL(b2bPurMonthSql),
      executeSQL(b2bGoalsYtdSql),
      executeSQL(b2bGoalsMonthSql),
      executeSQL(salesAnnualSql),
      executeSQL(purAnnualSql),
      executeSQL(b2bSalesAnnualSql),
      executeSQL(b2bPurAnnualSql),
    ]);
  } else if (cumulativeChannel === 'b2c') {
    [salesYtdRes, purYtdRes, salesMoRes, purMoRes, goalsYtdRes, goalsMoRes, salesAnnualRes, purAnnualRes] =
      await Promise.all([
        executeSQL(salesYtdSql),
        executeSQL(purYtdSql),
        executeSQL(salesMonthSql),
        executeSQL(purMonthSql),
        executeSQL(goalsYtdSql),
        executeSQL(goalsMonthSql),
        executeSQL(salesAnnualSql),
        executeSQL(purAnnualSql),
      ]);
    b2bSalesYtdRes = b2bPurYtdRes = b2bSalesMoRes = b2bPurMoRes = b2bGoalsYtdRes = b2bGoalsMoRes = empty;
    b2bSalesAnnualRes = b2bPurAnnualRes = empty;
  } else {
    [b2bSalesYtdRes, b2bPurYtdRes, b2bSalesMoRes, b2bPurMoRes, b2bGoalsYtdRes, b2bGoalsMoRes, b2bSalesAnnualRes, b2bPurAnnualRes] =
      await Promise.all([
        executeSQL(b2bSalesYtdSql),
        executeSQL(b2bPurYtdSql),
        executeSQL(b2bSalesMonthSql),
        executeSQL(b2bPurMonthSql),
        executeSQL(b2bGoalsYtdSql),
        executeSQL(b2bGoalsMonthSql),
        executeSQL(b2bSalesAnnualSql),
        executeSQL(b2bPurAnnualSql),
      ]);
    salesYtdRes = purYtdRes = salesMoRes = purMoRes = goalsYtdRes = goalsMoRes = empty;
    salesAnnualRes = purAnnualRes = empty;
  }

  /** year → category → branch → team → weight */
  const teamSalesYtd = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const catSalesYtd = new Map<number, Map<string, number>>();
  const purYtd = new Map<number, Map<string, number>>();
  const teamSalesMo = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const catSalesMo = new Map<number, Map<string, number>>();
  const purMo = new Map<number, Map<string, number>>();
  const goalsYtd = new Map<string, number>();
  const goalsMo = new Map<string, number>();
  const b2bCatSalesYtd = new Map<number, Map<string, number>>();
  const teamB2bSalesYtd = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const b2bPurYtd = new Map<number, Map<string, number>>();
  const b2bCatSalesMo = new Map<number, Map<string, number>>();
  const teamB2bSalesMo = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const b2bPurMo = new Map<number, Map<string, number>>();
  const goalsB2bYtd = new Map<string, number>();
  const goalsB2bMo = new Map<string, number>();

  /** 과거 3개 연도 연간 합계 — 실적 열만 (누적/월은 YTD 맵 유지) */
  const catSalesFull = new Map<number, Map<string, number>>();
  const purFull = new Map<number, Map<string, number>>();
  const teamSalesFull = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const b2bCatSalesFull = new Map<number, Map<string, number>>();
  const b2bPurFull = new Map<number, Map<string, number>>();
  const teamB2bSalesFull = new Map<number, Map<string, Map<string, Map<string, number>>>>();

  const ensureYCat = (m: Map<number, Map<string, number>>, y: number, cat: string) => {
    if (!m.has(y)) m.set(y, new Map());
    const inner = m.get(y)!;
    if (!inner.has(cat)) inner.set(cat, 0);
    return inner;
  };

  const ensureYCatBranchTeam = (
    m: Map<number, Map<string, Map<string, Map<string, number>>>>,
    y: number,
    cat: string,
    branch: string,
    team: string
  ) => {
    if (!m.has(y)) m.set(y, new Map());
    const ym = m.get(y)!;
    if (!ym.has(cat)) ym.set(cat, new Map());
    const cm = ym.get(cat)!;
    if (!cm.has(branch)) cm.set(branch, new Map());
    const bm = cm.get(branch)!;
    if (!bm.has(team)) bm.set(team, 0);
    return bm;
  };

  const normBranch = (b: unknown) => {
    const s = String(b ?? '').trim();
    return s || '미분류';
  };

  /** Must match `team_display_order.팀` trimming — used for maps + compareTeams sort keys */
  const normTeam = (t: unknown) => String(t ?? '').trim();
  const normTeamByBranch = (branch: string, team: unknown) => {
    const t = normTeam(team);
    if (!t) return t;
    const bc = branch.replace(/\s+/g, '');
    const tc = t.replace(/\s+/g, '');
    // Normalize duplicate labels like "부산" vs "부산팀"/"부산 팀".
    if (bc && tc === `${bc}팀`) return branch;
    return t;
  };

  for (const r of salesYtdRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const w = Number(r.weight) || 0;
    const catInner = ensureYCat(catSalesYtd, y, cat);
    catInner.set(cat, (catInner.get(cat) || 0) + w);
    const bm = ensureYCatBranchTeam(teamSalesYtd, y, cat, branch, team);
    bm.set(team, (bm.get(team) || 0) + w);
  }

  for (const r of purYtdRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const w = Number(r.weight) || 0;
    const inner = ensureYCat(purYtd, y, cat);
    inner.set(cat, (inner.get(cat) || 0) + w);
  }

  for (const r of salesMoRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const w = Number(r.weight) || 0;
    const catInnerMo = ensureYCat(catSalesMo, y, cat);
    catInnerMo.set(cat, (catInnerMo.get(cat) || 0) + w);
    const bm = ensureYCatBranchTeam(teamSalesMo, y, cat, branch, team);
    bm.set(team, (bm.get(team) || 0) + w);
  }

  for (const r of purMoRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const w = Number(r.weight) || 0;
    const inner = ensureYCat(purMo, y, cat);
    inner.set(cat, (inner.get(cat) || 0) + w);
  }

  for (const r of goalsYtdRes?.rows || []) {
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const tw = Number(r.target_weight) || 0;
    const gk = `${cat}\t${branch}\t${team}`;
    goalsYtd.set(gk, (goalsYtd.get(gk) || 0) + tw);
  }

  for (const r of goalsMoRes?.rows || []) {
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const y = String(r.year);
    const tw = Number(r.target_weight) || 0;
    const gk = `${y}\t${cat}\t${branch}\t${team}`;
    goalsMo.set(gk, (goalsMo.get(gk) || 0) + tw);
  }

  for (const r of b2bSalesYtdRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const w = Number(r.weight) || 0;
    const catInnerB2b = ensureYCat(b2bCatSalesYtd, y, cat);
    catInnerB2b.set(cat, (catInnerB2b.get(cat) || 0) + w);
    const bmB2b = ensureYCatBranchTeam(teamB2bSalesYtd, y, cat, branch, team);
    bmB2b.set(team, (bmB2b.get(team) || 0) + w);
  }
  for (const r of b2bPurYtdRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const w = Number(r.weight) || 0;
    const inner = ensureYCat(b2bPurYtd, y, cat);
    inner.set(cat, (inner.get(cat) || 0) + w);
  }
  for (const r of b2bSalesMoRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const w = Number(r.weight) || 0;
    const catInnerB2bMo = ensureYCat(b2bCatSalesMo, y, cat);
    catInnerB2bMo.set(cat, (catInnerB2bMo.get(cat) || 0) + w);
    const bmB2bMo = ensureYCatBranchTeam(teamB2bSalesMo, y, cat, branch, team);
    bmB2bMo.set(team, (bmB2bMo.get(team) || 0) + w);
  }
  for (const r of b2bPurMoRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const w = Number(r.weight) || 0;
    const inner = ensureYCat(b2bPurMo, y, cat);
    inner.set(cat, (inner.get(cat) || 0) + w);
  }
  for (const r of b2bGoalsYtdRes?.rows || []) {
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const tw = Number(r.target_weight) || 0;
    const gk = `${cat}\t${branch}\t${team}`;
    goalsB2bYtd.set(gk, (goalsB2bYtd.get(gk) || 0) + tw);
  }
  for (const r of b2bGoalsMoRes?.rows || []) {
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const y = String(r.year);
    const tw = Number(r.target_weight) || 0;
    const gk = `${y}\t${cat}\t${branch}\t${team}`;
    goalsB2bMo.set(gk, (goalsB2bMo.get(gk) || 0) + tw);
  }

  for (const r of salesAnnualRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const w = Number(r.weight) || 0;
    const catInner = ensureYCat(catSalesFull, y, cat);
    catInner.set(cat, (catInner.get(cat) || 0) + w);
    const bm = ensureYCatBranchTeam(teamSalesFull, y, cat, branch, team);
    bm.set(team, (bm.get(team) || 0) + w);
  }
  for (const r of purAnnualRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const w = Number(r.weight) || 0;
    const inner = ensureYCat(purFull, y, cat);
    inner.set(cat, (inner.get(cat) || 0) + w);
  }
  for (const r of b2bSalesAnnualRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeamByBranch(branch, r.team);
    if (!team) continue;
    const w = Number(r.weight) || 0;
    const catInnerB2b = ensureYCat(b2bCatSalesFull, y, cat);
    catInnerB2b.set(cat, (catInnerB2b.get(cat) || 0) + w);
    const bmB2b = ensureYCatBranchTeam(teamB2bSalesFull, y, cat, branch, team);
    bmB2b.set(team, (bmB2b.get(team) || 0) + w);
  }
  for (const r of b2bPurAnnualRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const w = Number(r.weight) || 0;
    const inner = ensureYCat(b2bPurFull, y, cat);
    inner.set(cat, (inner.get(cat) || 0) + w);
  }

  const getCatSales = (m: Map<number, Map<string, number>>, y: number, cat: string) =>
    m.get(y)?.get(cat) || 0;

  const getBranchTeamSales = (
    m: Map<number, Map<string, Map<string, Map<string, number>>>>,
    y: number,
    cat: string,
    branch: string,
    team: string
  ) => m.get(y)?.get(cat)?.get(branch)?.get(team) || 0;

  const getPur = (m: Map<number, Map<string, number>>, y: number, cat: string) => m.get(y)?.get(cat) || 0;

  const inv = (y: number, cat: string) => getPur(purYtd, y, cat) - getCatSales(catSalesYtd, y, cat);

  const b2bInv = (y: number, cat: string) =>
    getPur(b2bPurYtd, y, cat) - getCatSales(b2bCatSalesYtd, y, cat);

  /** 매입−매출 (B2C+B2B), 품목 기준 */
  const invCombined = (y: number, cat: string) => {
    return getComputedInventory(y, cat);
  };

  const purCombined = (
    mB2c: Map<number, Map<string, number>>,
    mB2b: Map<number, Map<string, number>>,
    y: number,
    cat: string
  ) => getPur(mB2c, y, cat) + getPur(mB2b, y, cat);

  const b2bCategoryGoalYtd = (cat: string) => {
    let s = 0;
    for (const [k, v] of goalsB2bYtd.entries()) {
      if (k.startsWith(`${cat}\t`)) s += v;
    }
    return s;
  };

  const b2bCategoryGoalMo = (y: number, cat: string) => {
    let s = 0;
    const prefix = `${y}\t${cat}\t`;
    for (const [k, v] of goalsB2bMo.entries()) {
      if (k.startsWith(prefix)) s += v;
    }
    return s;
  };

  const addBranchTeamPair = (set: Set<string>, branch: string, team: string) => {
    const b = normBranch(branch);
    const t = String(team || '').trim();
    if (!t) return;
    set.add(`${b}\t${t}`);
  };

  const collectBranchGroups = (cat: string): { branch: string; teams: string[] }[] => {
    const pairSet = new Set<string>();

    for (const y of [y3, y2, y1, y0]) {
      const catMap = teamSalesYtd.get(y)?.get(cat);
      if (!catMap) continue;
      catMap.forEach((teamMap, branch) => {
        teamMap.forEach((_w, team) => addBranchTeamPair(pairSet, branch, team));
      });
    }
    for (const y of [y1, y0]) {
      const catMap = teamSalesMo.get(y)?.get(cat);
      if (!catMap) continue;
      catMap.forEach((teamMap, branch) => {
        teamMap.forEach((_w, team) => addBranchTeamPair(pairSet, branch, team));
      });
    }

    const catPrefix = `${cat}\t`;
    for (const k of goalsYtd.keys()) {
      if (!k.startsWith(catPrefix)) continue;
      const rest = k.slice(catPrefix.length);
      const i = rest.indexOf('\t');
      if (i < 0) continue;
      addBranchTeamPair(pairSet, rest.slice(0, i), rest.slice(i + 1));
    }

    for (const k of goalsMo.keys()) {
      const parts = k.split('\t');
      if (parts.length < 4) continue;
      const gcat = parts[1];
      const gbranch = parts[2];
      const gteam = parts.slice(3).join('\t');
      if (gcat !== cat) continue;
      addBranchTeamPair(pairSet, gbranch, gteam);
    }

    const byBranch = new Map<string, Set<string>>();
    for (const p of pairSet) {
      const i = p.indexOf('\t');
      const b = p.slice(0, i);
      const t = p.slice(i + 1);
      if (!byBranch.has(b)) byBranch.set(b, new Set());
      byBranch.get(b)!.add(t);
    }

    const branches = Array.from(byBranch.keys()).sort((a, b) =>
      compareOffices(a, b, displayOrderMaps.office)
    );

    return branches.map((branch) => ({
      branch,
      teams: Array.from(byBranch.get(branch)!).sort((a, bb) =>
        compareTeams(a, bb, displayOrderMaps.teamB2c, displayOrderMaps.teamB2b)
      ),
    }));
  };

  const collectBranchGroupsB2b = (cat: string): { branch: string; teams: string[] }[] => {
    const pairSet = new Set<string>();

    for (const y of [y3, y2, y1, y0]) {
      const catMap = teamB2bSalesYtd.get(y)?.get(cat);
      if (!catMap) continue;
      catMap.forEach((teamMap, branch) => {
        teamMap.forEach((_w, team) => addBranchTeamPair(pairSet, branch, team));
      });
    }
    for (const y of [y1, y0]) {
      const catMap = teamB2bSalesMo.get(y)?.get(cat);
      if (!catMap) continue;
      catMap.forEach((teamMap, branch) => {
        teamMap.forEach((_w, team) => addBranchTeamPair(pairSet, branch, team));
      });
    }

    const catPrefixB2b = `${cat}\t`;
    for (const k of goalsB2bYtd.keys()) {
      if (!k.startsWith(catPrefixB2b)) continue;
      const rest = k.slice(catPrefixB2b.length);
      const i = rest.indexOf('\t');
      if (i < 0) continue;
      addBranchTeamPair(pairSet, rest.slice(0, i), rest.slice(i + 1));
    }

    for (const k of goalsB2bMo.keys()) {
      const parts = k.split('\t');
      if (parts.length < 4) continue;
      const gcat = parts[1];
      const gbranch = parts[2];
      const gteam = parts.slice(3).join('\t');
      if (gcat !== cat) continue;
      addBranchTeamPair(pairSet, gbranch, gteam);
    }

    const byBranchB2b = new Map<string, Set<string>>();
    for (const p of pairSet) {
      const i = p.indexOf('\t');
      const b = p.slice(0, i);
      const t = p.slice(i + 1);
      if (!byBranchB2b.has(b)) byBranchB2b.set(b, new Set());
      byBranchB2b.get(b)!.add(t);
    }

    const branchesB2b = Array.from(byBranchB2b.keys()).sort((a, b) =>
      compareOffices(a, b, displayOrderMaps.office)
    );

    return branchesB2b.map((branch) => ({
      branch,
      teams: Array.from(byBranchB2b.get(branch)!).sort((a, bb) =>
        compareTeams(a, bb, displayOrderMaps.teamB2b, displayOrderMaps.teamB2c)
      ),
    }));
  };

  const goalKey = (cat: string, branch: string, team: string) => `${cat}\t${normBranch(branch)}\t${team}`;
  const goalMoKey = (y: number, cat: string, branch: string, team: string) =>
    `${y}\t${cat}\t${normBranch(branch)}\t${team}`;

  const categoryGoalYtd = (cat: string) => {
    let s = 0;
    for (const [k, v] of goalsYtd.entries()) {
      if (k.startsWith(`${cat}\t`)) s += v;
    }
    return s;
  };

  const categoryGoalMo = (y: number, cat: string) => {
    let s = 0;
    const prefix = `${y}\t${cat}\t`;
    for (const [k, v] of goalsMo.entries()) {
      if (k.startsWith(prefix)) s += v;
    }
    return s;
  };

  const sections: CumulativeSection[] = [];

  for (const cat of CATEGORIES) {
    const branchGroups = collectBranchGroups(cat);
    const branchGroupsB2b = collectBranchGroupsB2b(cat);
    const rows: CumulativeRow[] = [];

    const invForYear = (y: number) => {
      if (cumulativeChannel === 'combined') return invCombined(y, cat);
      if (cumulativeChannel === 'b2c') return inv(y, cat);
      return b2bInv(y, cat);
    };

    const purSellinYtd = (y: number) => {
      if (cumulativeChannel === 'combined') return purCombined(purYtd, b2bPurYtd, y, cat);
      if (cumulativeChannel === 'b2c') return getPur(purYtd, y, cat);
      return getPur(b2bPurYtd, y, cat);
    };

    const invMonthSnapshot = (y: number) => {
      if (cumulativeChannel === 'combined') {
        return getComputedInventory(y, cat);
      }
      if (cumulativeChannel === 'b2c') {
        return getPur(purMo, y, cat) - getCatSales(catSalesMo, y, cat);
      }
      return getPur(b2bPurMo, y, cat) - getCatSales(b2bCatSalesMo, y, cat);
    };

    const sellinMonthPur = (y: number) => {
      if (cumulativeChannel === 'combined') return purCombined(purMo, b2bPurMo, y, cat);
      if (cumulativeChannel === 'b2c') return getPur(purMo, y, cat);
      return getPur(b2bPurMo, y, cat);
    };

    /** 실적 23·24·25년: 연간 — 재고 행 */
    const invFullForYear = (y: number) => {
      if (cumulativeChannel === 'combined') {
        // 연도 실적 컬럼(23/24/25)은 항상 연말(12월말) 재고를 사용한다.
        return getComputedInventory(y, cat, '12');
      }
      if (cumulativeChannel === 'b2c') return getPur(purFull, y, cat) - getCatSales(catSalesFull, y, cat);
      return getPur(b2bPurFull, y, cat) - getCatSales(b2bCatSalesFull, y, cat);
    };

    /** 실적 23·24·25년: 연간 매입 — sell-in 행 */
    const purSellinFullYear = (y: number) => {
      if (cumulativeChannel === 'combined') return getPur(purFull, y, cat) + getPur(b2bPurFull, y, cat);
      if (cumulativeChannel === 'b2c') return getPur(purFull, y, cat);
      return getPur(b2bPurFull, y, cat);
    };

    const y3s = invForYear(y3);
    const y2s = invForYear(y2);
    const y1s = invForYear(y1);
    const y0s = invForYear(y0);
    rows.push({
      rowKind: 'inventory',
      label: '재고',
      metrics: withYtdYoYGrowth(
        blk(
          invFullForYear(y3),
          invFullForYear(y2),
          invFullForYear(y1),
          0,
          y1s,
          0,
          y0s,
          invMonthSnapshot(y1),
          0,
          invMonthSnapshot(y0)
        ),
        invForYear(y1),
        invForYear(y0)
      ),
    });

    const p3 = purSellinYtd(y3);
    const p2 = purSellinYtd(y2);
    const p1 = purSellinYtd(y1);
    const p0 = purSellinYtd(y0);
    rows.push({
      rowKind: 'sellin',
      label: 'sell-in',
      metrics: withYtdYoYGrowth(
        blk(
          purSellinFullYear(y3),
          purSellinFullYear(y2),
          purSellinFullYear(y1),
          0,
          p1,
          0,
          p0,
          sellinMonthPur(y1),
          0,
          sellinMonthPur(y0)
        ),
        p1,
        p0
      ),
    });

    if (cumulativeChannel !== 'b2b') {
      const s3 = getCatSales(catSalesYtd, y3, cat);
      const s2 = getCatSales(catSalesYtd, y2, cat);
      const s1 = getCatSales(catSalesYtd, y1, cat);
      const s0 = getCatSales(catSalesYtd, y0, cat);
      const gt = categoryGoalYtd(cat);

      if (cumulativeChannel === 'combined') {
        const b1 = getCatSales(b2bCatSalesYtd, y1, cat);
        const b0 = getCatSales(b2bCatSalesYtd, y0, cat);
        const b2gYtd = b2bCategoryGoalYtd(cat);
        const s3f = getCatSales(catSalesFull, y3, cat) + getCatSales(b2bCatSalesFull, y3, cat);
        const s2f = getCatSales(catSalesFull, y2, cat) + getCatSales(b2bCatSalesFull, y2, cat);
        const s1f = getCatSales(catSalesFull, y1, cat) + getCatSales(b2bCatSalesFull, y1, cat);
        rows.push({
          rowKind: 'total',
          label: '합계',
          metrics: withYtdYoYGrowth(
            blk(
              s3f,
              s2f,
              s1f,
              gt + b2gYtd,
              s1 + b1,
              gt + b2gYtd,
              s0 + b0,
              getCatSales(catSalesMo, y1, cat) + getCatSales(b2bCatSalesMo, y1, cat),
              categoryGoalMo(y0, cat) + b2bCategoryGoalMo(y0, cat),
              getCatSales(catSalesMo, y0, cat) + getCatSales(b2bCatSalesMo, y0, cat)
            ),
            s1 + b1,
            s0 + b0
          ),
        });
      } else {
        const s3f = getCatSales(catSalesFull, y3, cat);
        const s2f = getCatSales(catSalesFull, y2, cat);
        const s1f = getCatSales(catSalesFull, y1, cat);
        rows.push({
          rowKind: 'total',
          label: '합계 (B2C)',
          metrics: withYtdYoYGrowth(
            blk(
              s3f,
              s2f,
              s1f,
              gt,
              s1,
              gt,
              s0,
              getCatSales(catSalesMo, y1, cat),
              categoryGoalMo(y0, cat),
              getCatSales(catSalesMo, y0, cat)
            ),
            s1,
            s0
          ),
        });
      }

      for (const { branch, teams } of branchGroups) {
      let st3f = 0;
      let st2f = 0;
      let st1f = 0;
      let st1 = 0;
      let st0 = 0;
      let sct = 0;
      let smp = 0;
      let smt = 0;
      let smc = 0;
      for (const team of teams) {
        st3f += getBranchTeamSales(teamSalesFull, y3, cat, branch, team);
        st2f += getBranchTeamSales(teamSalesFull, y2, cat, branch, team);
        st1f += getBranchTeamSales(teamSalesFull, y1, cat, branch, team);
        st1 += getBranchTeamSales(teamSalesYtd, y1, cat, branch, team);
        st0 += getBranchTeamSales(teamSalesYtd, y0, cat, branch, team);
        sct += goalsYtd.get(goalKey(cat, branch, team)) || 0;
        smp += getBranchTeamSales(teamSalesMo, y1, cat, branch, team);
        smt += goalsMo.get(goalMoKey(y0, cat, branch, team)) || 0;
        smc += getBranchTeamSales(teamSalesMo, y0, cat, branch, team);
      }
      rows.push({
        rowKind: 'branch_subtotal',
        label: `${branch} 소계`,
        metrics: withYtdYoYGrowth(
          blk(st3f, st2f, st1f, sct, st1, sct, st0, smp, smt, smc),
          st1,
          st0
        ),
      });
      for (const team of teams) {
        const t3f = getBranchTeamSales(teamSalesFull, y3, cat, branch, team);
        const t2f = getBranchTeamSales(teamSalesFull, y2, cat, branch, team);
        const t1f = getBranchTeamSales(teamSalesFull, y1, cat, branch, team);
        const t1y = getBranchTeamSales(teamSalesYtd, y1, cat, branch, team);
        const t0y = getBranchTeamSales(teamSalesYtd, y0, cat, branch, team);
        const tgt = goalsYtd.get(goalKey(cat, branch, team)) || 0;
        rows.push({
          rowKind: 'team',
          label: team,
          metrics: withYtdYoYGrowth(
            blk(
              t3f,
              t2f,
              t1f,
              tgt,
              t1y,
              tgt,
              t0y,
              getBranchTeamSales(teamSalesMo, y1, cat, branch, team),
              goalsMo.get(goalMoKey(y0, cat, branch, team)) || 0,
              getBranchTeamSales(teamSalesMo, y0, cat, branch, team)
            ),
            t1y,
            t0y
          ),
        });
      }
    }
    }

    if (cumulativeChannel !== 'b2c') {
    if (cumulativeChannel !== 'combined') {
      const b2gYtd = b2bCategoryGoalYtd(cat);
      const b3f = getCatSales(b2bCatSalesFull, y3, cat);
      const b2f = getCatSales(b2bCatSalesFull, y2, cat);
      const b1f = getCatSales(b2bCatSalesFull, y1, cat);
      const b1 = getCatSales(b2bCatSalesYtd, y1, cat);
      const b0 = getCatSales(b2bCatSalesYtd, y0, cat);
      rows.push({
        rowKind: 'b2b_total',
        label: '합계 (B2B)',
        metrics: withYtdYoYGrowth(
          blk(
            b3f,
            b2f,
            b1f,
            b2gYtd,
            b1,
            b2gYtd,
            b0,
            getCatSales(b2bCatSalesMo, y1, cat),
            b2bCategoryGoalMo(y0, cat),
            getCatSales(b2bCatSalesMo, y0, cat)
          ),
          b1,
          b0
        ),
      });
    }

    for (const { branch, teams } of branchGroupsB2b) {
      let st3f = 0;
      let st2f = 0;
      let st1f = 0;
      let st1 = 0;
      let st0 = 0;
      let sct = 0;
      let smp = 0;
      let smt = 0;
      let smc = 0;
      for (const team of teams) {
        st3f += getBranchTeamSales(teamB2bSalesFull, y3, cat, branch, team);
        st2f += getBranchTeamSales(teamB2bSalesFull, y2, cat, branch, team);
        st1f += getBranchTeamSales(teamB2bSalesFull, y1, cat, branch, team);
        st1 += getBranchTeamSales(teamB2bSalesYtd, y1, cat, branch, team);
        st0 += getBranchTeamSales(teamB2bSalesYtd, y0, cat, branch, team);
        sct += goalsB2bYtd.get(goalKey(cat, branch, team)) || 0;
        smp += getBranchTeamSales(teamB2bSalesMo, y1, cat, branch, team);
        smt += goalsB2bMo.get(goalMoKey(y0, cat, branch, team)) || 0;
        smc += getBranchTeamSales(teamB2bSalesMo, y0, cat, branch, team);
      }
      rows.push({
        rowKind: 'b2b_branch_subtotal',
        label: `${branch} 소계 (B2B)`,
        metrics: withYtdYoYGrowth(
          blk(st3f, st2f, st1f, sct, st1, sct, st0, smp, smt, smc),
          st1,
          st0
        ),
      });
      for (const team of teams) {
        const t3f = getBranchTeamSales(teamB2bSalesFull, y3, cat, branch, team);
        const t2f = getBranchTeamSales(teamB2bSalesFull, y2, cat, branch, team);
        const t1f = getBranchTeamSales(teamB2bSalesFull, y1, cat, branch, team);
        const t1y = getBranchTeamSales(teamB2bSalesYtd, y1, cat, branch, team);
        const t0y = getBranchTeamSales(teamB2bSalesYtd, y0, cat, branch, team);
        const tgt = goalsB2bYtd.get(goalKey(cat, branch, team)) || 0;
        rows.push({
          rowKind: 'b2b_team',
          label: team,
          metrics: withYtdYoYGrowth(
            blk(
              t3f,
              t2f,
              t1f,
              tgt,
              t1y,
              tgt,
              t0y,
              getBranchTeamSales(teamB2bSalesMo, y1, cat, branch, team),
              goalsB2bMo.get(goalMoKey(y0, cat, branch, team)) || 0,
              getBranchTeamSales(teamB2bSalesMo, y0, cat, branch, team)
            ),
            t1y,
            t0y
          ),
        });
      }
    }
    }

    sections.push({ category: cat, rows });
  }

  const payload: CumulativeViewPayload = {
    yearLabels: { yPast3: y3, yPast2: y2, yPast1: y1, yCurrent: y0 },
    monthLabel: `${monthInt}월`,
    sections,
    availableMonths,
    currentMonth: currentMonthStr,
  };

  // Store in cache
  PAYLOAD_CACHE.set(cacheKey, { timestamp: Date.now(), payload });

  return payload;
}

// ─── buildCustomGroupPayload ──────────────────────────────────────────────────
// Like buildCumulativeViewPayload but adds 품목그룹3 dimension to every section.
// Inventory = purchase − sales (no computed_inventory_monthly for group3).
// All goal targets = 0 (sales_goals has no group3 breakdown).
// baseSalesSubquery / basePurchasesSubquery MUST expose s.품목그룹3코드 / p.품목그룹3코드.

const G3_SALES_EXPR = `TRIM(COALESCE(s.품목그룹3코드, ''))`;
const G3_PUR_EXPR = `TRIM(COALESCE(p.품목그룹3코드, ''))`;
// Known tier order — any other codes land after these alphabetically
const G3_KNOWN_ORDER = ['STA', 'PRE', 'FLA', 'ALL'];
// 거래처그룹2 — from company_type_auto joined as `ca`
const CG2_EXPR = `TRIM(COALESCE(ca.거래처그룹2, ''))`;
function g3SortIndex(v: string): number {
  const i = G3_KNOWN_ORDER.indexOf(v);
  return i >= 0 ? i : G3_KNOWN_ORDER.length;
}

export async function buildCustomGroupPayload(params: {
  currentMonthStr: string;
  currentYear: number;
  availableMonths: string[];
  baseSalesSubquery: string;
  basePurchasesSubquery: string;
  includeVat?: boolean;
}): Promise<CumulativeViewPayload> {
  const {
    currentMonthStr,
    currentYear,
    availableMonths,
    baseSalesSubquery,
    basePurchasesSubquery,
    includeVat = false,
  } = params;
  const SALES_AMT = includeVat
    ? `CAST(REPLACE(s.합계, ',', '') AS NUMERIC)`
    : `CAST(REPLACE(s.공급가액, ',', '') AS NUMERIC)`;
  const PUR_AMT = includeVat
    ? `CAST(REPLACE(p.합계, ',', '') AS NUMERIC)`
    : `CAST(REPLACE(p.공급가액, ',', '') AS NUMERIC)`;

  const monthNum = currentMonthStr.split('-')[1];
  const monthInt = parseInt(monthNum, 10);
  const y0 = currentYear;
  const y1 = y0 - 1;
  const y2 = y0 - 2;
  const y3 = y0 - 3;
  const monthKeyPrev = `${y1}-${monthNum}`;
  const monthKeyCur = `${y0}-${monthNum}`;
  const threePastYearsIn = `('${y3}', '${y2}', '${y1}')`;
  const salesYtdFilter = getYtdYearFilter(y3, y2, y1, y0, monthNum, 's');
  const purYtdFilter = getYtdYearFilter(y3, y2, y1, y0, monthNum, 'p');

  const displayOrderMaps = await loadFullDisplayOrderContext();

  // ── SQL Queries (12 total — B2C/B2B × annual/YTD/monthly × sales/purchases) ──

  const salesAnnualG3Sql = `
    SELECT CAST(substr(s.일자,1,4) AS INTEGER) as year,
      ${SALES_CAT_RAW} as category, ${G3_SALES_EXPR} as group3, ${CG2_EXPR} as client_group2,
      (${BRANCH_FROM_EC}) as branch, ec.b2c_팀 as team,
      SUM(CAST(REPLACE(s.중량,',','') AS NUMERIC)) as weight, SUM(${SALES_AMT}) as amount
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE substr(s.일자,1,4) IN ${threePastYearsIn}
      AND ${WHERE_B2C} ${sqlAndEmployeeNotSpecialHandling()} ${sqlAndSalesRemarkNotExact('s.적요')}
      AND ec.b2c_팀 IS NOT NULL AND TRIM(ec.b2c_팀) != ''
    GROUP BY 1,2,3,4,5,6`;

  const purAnnualG3Sql = `
    SELECT CAST(substr(p.일자,1,4) AS INTEGER) as year,
      ${PUR_CAT_RAW} as category, ${G3_PUR_EXPR} as group3, ${CG2_EXPR} as client_group2,
      SUM(CAST(REPLACE(p.중량,',','') AS NUMERIC)) as weight, SUM(${PUR_AMT}) as amount
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE substr(p.일자,1,4) IN ${threePastYearsIn} AND ${WHERE_B2C}
    GROUP BY 1,2,3,4`;

  const salesYtdG3Sql = `
    SELECT CAST(substr(s.일자,1,4) AS INTEGER) as year,
      ${SALES_CAT_RAW} as category, ${G3_SALES_EXPR} as group3, ${CG2_EXPR} as client_group2,
      (${BRANCH_FROM_EC}) as branch, ec.b2c_팀 as team,
      SUM(CAST(REPLACE(s.중량,',','') AS NUMERIC)) as weight, SUM(${SALES_AMT}) as amount
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE ${salesYtdFilter}
      AND ${WHERE_B2C} ${sqlAndEmployeeNotSpecialHandling()} ${sqlAndSalesRemarkNotExact('s.적요')}
      AND ec.b2c_팀 IS NOT NULL AND TRIM(ec.b2c_팀) != ''
    GROUP BY 1,2,3,4,5,6`;

  const purYtdG3Sql = `
    SELECT CAST(substr(p.일자,1,4) AS INTEGER) as year,
      ${PUR_CAT_RAW} as category, ${G3_PUR_EXPR} as group3, ${CG2_EXPR} as client_group2,
      SUM(CAST(REPLACE(p.중량,',','') AS NUMERIC)) as weight, SUM(${PUR_AMT}) as amount
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE ${purYtdFilter} AND ${WHERE_B2C}
    GROUP BY 1,2,3,4`;

  const salesMonthG3Sql = `
    SELECT CAST(substr(s.일자,1,4) AS INTEGER) as year,
      ${SALES_CAT_RAW} as category, ${G3_SALES_EXPR} as group3, ${CG2_EXPR} as client_group2,
      (${BRANCH_FROM_EC}) as branch, ec.b2c_팀 as team,
      SUM(CAST(REPLACE(s.중량,',','') AS NUMERIC)) as weight, SUM(${SALES_AMT}) as amount
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE substr(s.일자,1,7) IN ('${monthKeyPrev}','${monthKeyCur}')
      AND ${WHERE_B2C} ${sqlAndEmployeeNotSpecialHandling()} ${sqlAndSalesRemarkNotExact('s.적요')}
      AND ec.b2c_팀 IS NOT NULL AND TRIM(ec.b2c_팀) != ''
    GROUP BY 1,2,3,4,5,6`;

  const purMonthG3Sql = `
    SELECT CAST(substr(p.일자,1,4) AS INTEGER) as year,
      ${PUR_CAT_RAW} as category, ${G3_PUR_EXPR} as group3, ${CG2_EXPR} as client_group2,
      SUM(CAST(REPLACE(p.중량,',','') AS NUMERIC)) as weight, SUM(${PUR_AMT}) as amount
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE substr(p.일자,1,7) IN ('${monthKeyPrev}','${monthKeyCur}') AND ${WHERE_B2C}
    GROUP BY 1,2,3,4`;

  const b2bSalesAnnualG3Sql = `
    SELECT CAST(substr(s.일자,1,4) AS INTEGER) as year,
      ${SALES_CAT_RAW} as category, ${G3_SALES_EXPR} as group3, ${CG2_EXPR} as client_group2,
      (${BRANCH_FROM_EC}) as branch, ${B2B_TEAM} as team,
      SUM(CAST(REPLACE(s.중량,',','') AS NUMERIC)) as weight, SUM(${SALES_AMT}) as amount
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE substr(s.일자,1,4) IN ${threePastYearsIn}
      AND ${WHERE_B2B} ${sqlAndEmployeeNotSpecialHandling()} ${sqlAndSalesRemarkNotExact('s.적요')}
    GROUP BY 1,2,3,4,5,6`;

  const b2bPurAnnualG3Sql = `
    SELECT CAST(substr(p.일자,1,4) AS INTEGER) as year,
      ${PUR_CAT_RAW} as category, ${G3_PUR_EXPR} as group3, ${CG2_EXPR} as client_group2,
      SUM(CAST(REPLACE(p.중량,',','') AS NUMERIC)) as weight, SUM(${PUR_AMT}) as amount
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE substr(p.일자,1,4) IN ${threePastYearsIn} AND ${WHERE_B2B}
    GROUP BY 1,2,3,4`;

  const b2bSalesYtdG3Sql = `
    SELECT CAST(substr(s.일자,1,4) AS INTEGER) as year,
      ${SALES_CAT_RAW} as category, ${G3_SALES_EXPR} as group3, ${CG2_EXPR} as client_group2,
      (${BRANCH_FROM_EC}) as branch, ${B2B_TEAM} as team,
      SUM(CAST(REPLACE(s.중량,',','') AS NUMERIC)) as weight, SUM(${SALES_AMT}) as amount
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE ${salesYtdFilter}
      AND ${WHERE_B2B} ${sqlAndEmployeeNotSpecialHandling()} ${sqlAndSalesRemarkNotExact('s.적요')}
    GROUP BY 1,2,3,4,5,6`;

  const b2bPurYtdG3Sql = `
    SELECT CAST(substr(p.일자,1,4) AS INTEGER) as year,
      ${PUR_CAT_RAW} as category, ${G3_PUR_EXPR} as group3, ${CG2_EXPR} as client_group2,
      SUM(CAST(REPLACE(p.중량,',','') AS NUMERIC)) as weight, SUM(${PUR_AMT}) as amount
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE ${purYtdFilter} AND ${WHERE_B2B}
    GROUP BY 1,2,3,4`;

  const b2bSalesMonthG3Sql = `
    SELECT CAST(substr(s.일자,1,4) AS INTEGER) as year,
      ${SALES_CAT_RAW} as category, ${G3_SALES_EXPR} as group3, ${CG2_EXPR} as client_group2,
      (${BRANCH_FROM_EC}) as branch, ${B2B_TEAM} as team,
      SUM(CAST(REPLACE(s.중량,',','') AS NUMERIC)) as weight, SUM(${SALES_AMT}) as amount
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON ${SALES_CLIENT_KEY_EXPR} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE substr(s.일자,1,7) IN ('${monthKeyPrev}','${monthKeyCur}')
      AND ${WHERE_B2B} ${sqlAndEmployeeNotSpecialHandling()} ${sqlAndSalesRemarkNotExact('s.적요')}
    GROUP BY 1,2,3,4,5,6`;

  const b2bPurMonthG3Sql = `
    SELECT CAST(substr(p.일자,1,4) AS INTEGER) as year,
      ${PUR_CAT_RAW} as category, ${G3_PUR_EXPR} as group3, ${CG2_EXPR} as client_group2,
      SUM(CAST(REPLACE(p.중량,',','') AS NUMERIC)) as weight, SUM(${PUR_AMT}) as amount
    FROM (${basePurchasesSubquery}) p
    LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드
    WHERE substr(p.일자,1,7) IN ('${monthKeyPrev}','${monthKeyCur}') AND ${WHERE_B2B}
    GROUP BY 1,2,3,4`;

  const [
    salesAnnualRes, purAnnualRes,
    salesYtdRes, purYtdRes,
    salesMoRes, purMoRes,
    b2bSalesAnnualRes, b2bPurAnnualRes,
    b2bSalesYtdRes, b2bPurYtdRes,
    b2bSalesMoRes, b2bPurMoRes,
  ] = await Promise.all([
    executeSQL(salesAnnualG3Sql),
    executeSQL(purAnnualG3Sql),
    executeSQL(salesYtdG3Sql),
    executeSQL(purYtdG3Sql),
    executeSQL(salesMonthG3Sql),
    executeSQL(purMonthG3Sql),
    executeSQL(b2bSalesAnnualG3Sql),
    executeSQL(b2bPurAnnualG3Sql),
    executeSQL(b2bSalesYtdG3Sql),
    executeSQL(b2bPurYtdG3Sql),
    executeSQL(b2bSalesMonthG3Sql),
    executeSQL(b2bPurMonthG3Sql),
  ]);

  // ── Maps: keyed by catG3 = "category\tgroup3\tclientGroup2" ──
  // B2C
  const g3SalesFull = new Map<number, Map<string, number>>();
  const g3PurFull = new Map<number, Map<string, number>>();
  const g3SalesYtd = new Map<number, Map<string, number>>();
  const g3PurYtd = new Map<number, Map<string, number>>();
  const g3SalesMo = new Map<number, Map<string, number>>();
  const g3PurMo = new Map<number, Map<string, number>>();
  const g3TeamSalesFull = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const g3TeamSalesYtd = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const g3TeamSalesMo = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  // B2B
  const b2bG3SalesFull = new Map<number, Map<string, number>>();
  const b2bG3PurFull = new Map<number, Map<string, number>>();
  const b2bG3SalesYtd = new Map<number, Map<string, number>>();
  const b2bG3PurYtd = new Map<number, Map<string, number>>();
  const b2bG3SalesMo = new Map<number, Map<string, number>>();
  const b2bG3PurMo = new Map<number, Map<string, number>>();
  const b2bG3TeamSalesFull = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const b2bG3TeamSalesYtd = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const b2bG3TeamSalesMo = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  // Amount maps (parallel to weight maps)
  const amtG3SalesFull = new Map<number, Map<string, number>>();
  const amtG3PurFull = new Map<number, Map<string, number>>();
  const amtG3SalesYtd = new Map<number, Map<string, number>>();
  const amtG3PurYtd = new Map<number, Map<string, number>>();
  const amtG3SalesMo = new Map<number, Map<string, number>>();
  const amtG3PurMo = new Map<number, Map<string, number>>();
  const amtG3TeamSalesFull = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const amtG3TeamSalesYtd = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const amtG3TeamSalesMo = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const amtB2bG3SalesFull = new Map<number, Map<string, number>>();
  const amtB2bG3PurFull = new Map<number, Map<string, number>>();
  const amtB2bG3SalesYtd = new Map<number, Map<string, number>>();
  const amtB2bG3PurYtd = new Map<number, Map<string, number>>();
  const amtB2bG3SalesMo = new Map<number, Map<string, number>>();
  const amtB2bG3PurMo = new Map<number, Map<string, number>>();
  const amtB2bG3TeamSalesFull = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const amtB2bG3TeamSalesYtd = new Map<number, Map<string, Map<string, Map<string, number>>>>();
  const amtB2bG3TeamSalesMo = new Map<number, Map<string, Map<string, Map<string, number>>>>();

  const addToFlat = (m: Map<number, Map<string, number>>, y: number, key: string, w: number) => {
    if (!m.has(y)) m.set(y, new Map());
    const inner = m.get(y)!;
    inner.set(key, (inner.get(key) || 0) + w);
  };

  const addToTeam = (
    m: Map<number, Map<string, Map<string, Map<string, number>>>>,
    y: number, key: string, branch: string, team: string, w: number
  ) => {
    if (!m.has(y)) m.set(y, new Map());
    const ym = m.get(y)!;
    if (!ym.has(key)) ym.set(key, new Map());
    const km = ym.get(key)!;
    if (!km.has(branch)) km.set(branch, new Map());
    const bm = km.get(branch)!;
    bm.set(team, (bm.get(team) || 0) + w);
  };

  const normB = (b: unknown) => { const s = String(b ?? '').trim(); return s || '미분류'; };
  const normT = (t: unknown) => String(t ?? '').trim();
  const normTByBranch = (branch: string, team: unknown) => {
    const t = normT(team);
    if (!t) return t;
    const bc = branch.replace(/\s+/g, '');
    const tc = t.replace(/\s+/g, '');
    if (bc && tc === `${bc}팀`) return branch;
    return t;
  };

  const processB2cSales = (
    flatMap: Map<number, Map<string, number>>,
    teamMap: Map<number, Map<string, Map<string, Map<string, number>>>>,
    amtFlatMap: Map<number, Map<string, number>>,
    amtTeamMap: Map<number, Map<string, Map<string, Map<string, number>>>>,
    rows: any[]
  ) => {
    for (const r of rows || []) {
      const y = Number(r.year);
      const key = `${String(r.category)}\t${String(r.group3)}\t${String(r.client_group2 ?? '')}`;
      const branch = normB(r.branch);
      const team = normTByBranch(branch, r.team);
      if (!team) continue;
      const w = Number(r.weight) || 0;
      const a = Number(r.amount) || 0;
      addToFlat(flatMap, y, key, w);
      addToTeam(teamMap, y, key, branch, team, w);
      addToFlat(amtFlatMap, y, key, a);
      addToTeam(amtTeamMap, y, key, branch, team, a);
    }
  };

  const processPur = (
    flatMap: Map<number, Map<string, number>>,
    amtFlatMap: Map<number, Map<string, number>>,
    rows: any[]
  ) => {
    for (const r of rows || []) {
      const y = Number(r.year);
      const key = `${String(r.category)}\t${String(r.group3)}\t${String(r.client_group2 ?? '')}`;
      addToFlat(flatMap, y, key, Number(r.weight) || 0);
      addToFlat(amtFlatMap, y, key, Number(r.amount) || 0);
    }
  };

  const processB2bSales = (
    flatMap: Map<number, Map<string, number>>,
    teamMap: Map<number, Map<string, Map<string, Map<string, number>>>>,
    amtFlatMap: Map<number, Map<string, number>>,
    amtTeamMap: Map<number, Map<string, Map<string, Map<string, number>>>>,
    rows: any[]
  ) => {
    for (const r of rows || []) {
      const y = Number(r.year);
      const key = `${String(r.category)}\t${String(r.group3)}\t${String(r.client_group2 ?? '')}`;
      const branch = normB(r.branch);
      const team = normTByBranch(branch, r.team);
      if (!team) continue;
      const w = Number(r.weight) || 0;
      const a = Number(r.amount) || 0;
      addToFlat(flatMap, y, key, w);
      addToTeam(teamMap, y, key, branch, team, w);
      addToFlat(amtFlatMap, y, key, a);
      addToTeam(amtTeamMap, y, key, branch, team, a);
    }
  };

  processB2cSales(g3SalesFull, g3TeamSalesFull, amtG3SalesFull, amtG3TeamSalesFull, salesAnnualRes?.rows);
  processPur(g3PurFull, amtG3PurFull, purAnnualRes?.rows);
  processB2cSales(g3SalesYtd, g3TeamSalesYtd, amtG3SalesYtd, amtG3TeamSalesYtd, salesYtdRes?.rows);
  processPur(g3PurYtd, amtG3PurYtd, purYtdRes?.rows);
  processB2cSales(g3SalesMo, g3TeamSalesMo, amtG3SalesMo, amtG3TeamSalesMo, salesMoRes?.rows);
  processPur(g3PurMo, amtG3PurMo, purMoRes?.rows);
  processB2bSales(b2bG3SalesFull, b2bG3TeamSalesFull, amtB2bG3SalesFull, amtB2bG3TeamSalesFull, b2bSalesAnnualRes?.rows);
  processPur(b2bG3PurFull, amtB2bG3PurFull, b2bPurAnnualRes?.rows);
  processB2bSales(b2bG3SalesYtd, b2bG3TeamSalesYtd, amtB2bG3SalesYtd, amtB2bG3TeamSalesYtd, b2bSalesYtdRes?.rows);
  processPur(b2bG3PurYtd, amtB2bG3PurYtd, b2bPurYtdRes?.rows);
  processB2bSales(b2bG3SalesMo, b2bG3TeamSalesMo, amtB2bG3SalesMo, amtB2bG3TeamSalesMo, b2bSalesMoRes?.rows);
  processPur(b2bG3PurMo, amtB2bG3PurMo, b2bPurMoRes?.rows);

  // ── Collect unique catG3 keys ──
  const catG3KeySet = new Set<string>();
  for (const m of [
    g3SalesFull, g3PurFull, g3SalesYtd, g3PurYtd, g3SalesMo, g3PurMo,
    b2bG3SalesFull, b2bG3PurFull, b2bG3SalesYtd, b2bG3PurYtd, b2bG3SalesMo, b2bG3PurMo,
  ]) {
    for (const inner of m.values()) for (const k of inner.keys()) catG3KeySet.add(k);
  }

  const catG3Keys = Array.from(catG3KeySet).sort((a, b) => {
    const [aCat, aG3, aCg2] = a.split('\t');
    const [bCat, bG3, bCg2] = b.split('\t');
    const ci = catSortIndex(aCat) - catSortIndex(bCat);
    if (ci !== 0) return ci;
    const gi = g3SortIndex(aG3) - g3SortIndex(bG3);
    if (gi !== 0) return gi;
    return (aCg2 ?? '').localeCompare(bCg2 ?? '');
  });

  // ── Helpers ──
  const flat = (m: Map<number, Map<string, number>>, y: number, key: string) =>
    m.get(y)?.get(key) || 0;
  const teamVal = (
    m: Map<number, Map<string, Map<string, Map<string, number>>>>,
    y: number, key: string, branch: string, team: string
  ) => m.get(y)?.get(key)?.get(branch)?.get(team) || 0;
  const amtFlat = flat;
  const amtTeamVal = teamVal;

  const addPairToSet = (set: Set<string>, branch: string, team: string) => {
    const b = normB(branch);
    const t = String(team || '').trim();
    if (t) set.add(`${b}\t${t}`);
  };

  const pairsToGroups = (pairSet: Set<string>, isB2b: boolean): { branch: string; teams: string[] }[] => {
    const byBranch = new Map<string, Set<string>>();
    for (const p of pairSet) {
      const i = p.indexOf('\t');
      const b = p.slice(0, i);
      const t = p.slice(i + 1);
      if (!byBranch.has(b)) byBranch.set(b, new Set());
      byBranch.get(b)!.add(t);
    }
    return Array.from(byBranch.keys())
      .sort((a, b) => compareOffices(a, b, displayOrderMaps.office))
      .map((branch) => ({
        branch,
        teams: Array.from(byBranch.get(branch)!).sort((a, bb) =>
          isB2b
            ? compareTeams(a, bb, displayOrderMaps.teamB2b, displayOrderMaps.teamB2c)
            : compareTeams(a, bb, displayOrderMaps.teamB2c, displayOrderMaps.teamB2b)
        ),
      }));
  };

  const collectB2cBranchGroups = (key: string) => {
    const pairSet = new Set<string>();
    for (const y of [y3, y2, y1, y0]) {
      g3TeamSalesYtd.get(y)?.get(key)?.forEach((tm, branch) =>
        tm.forEach((_w, team) => addPairToSet(pairSet, branch, team))
      );
    }
    for (const y of [y1, y0]) {
      g3TeamSalesMo.get(y)?.get(key)?.forEach((tm, branch) =>
        tm.forEach((_w, team) => addPairToSet(pairSet, branch, team))
      );
    }
    return pairsToGroups(pairSet, false);
  };

  const collectB2bBranchGroups = (key: string) => {
    const pairSet = new Set<string>();
    for (const y of [y3, y2, y1, y0]) {
      b2bG3TeamSalesYtd.get(y)?.get(key)?.forEach((tm, branch) =>
        tm.forEach((_w, team) => addPairToSet(pairSet, branch, team))
      );
    }
    for (const y of [y1, y0]) {
      b2bG3TeamSalesMo.get(y)?.get(key)?.forEach((tm, branch) =>
        tm.forEach((_w, team) => addPairToSet(pairSet, branch, team))
      );
    }
    return pairsToGroups(pairSet, true);
  };

  // ── Build sections ──
  const sections: CumulativeSection[] = [];

  for (const catG3 of catG3Keys) {
    const [cat, g3, cg2] = catG3.split('\t');
    const branchGroupsB2c = collectB2cBranchGroups(catG3);
    const branchGroupsB2b = collectB2bBranchGroups(catG3);
    const rows: CumulativeRow[] = [];

    // Inventory helpers (purchase − sales, no computed_inventory_monthly for group3)
    const invFull = (y: number) =>
      flat(g3PurFull, y, catG3) + flat(b2bG3PurFull, y, catG3)
      - flat(g3SalesFull, y, catG3) - flat(b2bG3SalesFull, y, catG3);
    const invYtd = (y: number) =>
      flat(g3PurYtd, y, catG3) + flat(b2bG3PurYtd, y, catG3)
      - flat(g3SalesYtd, y, catG3) - flat(b2bG3SalesYtd, y, catG3);
    const invMo = (y: number) =>
      flat(g3PurMo, y, catG3) + flat(b2bG3PurMo, y, catG3)
      - flat(g3SalesMo, y, catG3) - flat(b2bG3SalesMo, y, catG3);
    // Amount: inventory
    const amtInvFull = (y: number) =>
      amtFlat(amtG3PurFull, y, catG3) + amtFlat(amtB2bG3PurFull, y, catG3)
      - amtFlat(amtG3SalesFull, y, catG3) - amtFlat(amtB2bG3SalesFull, y, catG3);
    const amtInvYtd = (y: number) =>
      amtFlat(amtG3PurYtd, y, catG3) + amtFlat(amtB2bG3PurYtd, y, catG3)
      - amtFlat(amtG3SalesYtd, y, catG3) - amtFlat(amtB2bG3SalesYtd, y, catG3);
    const amtInvMo = (y: number) =>
      amtFlat(amtG3PurMo, y, catG3) + amtFlat(amtB2bG3PurMo, y, catG3)
      - amtFlat(amtG3SalesMo, y, catG3) - amtFlat(amtB2bG3SalesMo, y, catG3);

    // ── inventory row ──
    rows.push({
      rowKind: 'inventory',
      label: '재고',
      metrics: withYtdYoYGrowth(
        blk(invFull(y3), invFull(y2), invFull(y1), 0, invYtd(y1), 0, invYtd(y0), invMo(y1), 0, invMo(y0)),
        invYtd(y1), invYtd(y0)
      ),
      amountMetrics: withYtdYoYGrowth(
        blk(amtInvFull(y3), amtInvFull(y2), amtInvFull(y1), 0, amtInvYtd(y1), 0, amtInvYtd(y0), amtInvMo(y1), 0, amtInvMo(y0)),
        amtInvYtd(y1), amtInvYtd(y0)
      ),
    });

    // ── sellin row ──
    const purFull = (y: number) => flat(g3PurFull, y, catG3) + flat(b2bG3PurFull, y, catG3);
    const purYtdVal = (y: number) => flat(g3PurYtd, y, catG3) + flat(b2bG3PurYtd, y, catG3);
    const purMoVal = (y: number) => flat(g3PurMo, y, catG3) + flat(b2bG3PurMo, y, catG3);
    const amtPurFull = (y: number) => amtFlat(amtG3PurFull, y, catG3) + amtFlat(amtB2bG3PurFull, y, catG3);
    const amtPurYtdVal = (y: number) => amtFlat(amtG3PurYtd, y, catG3) + amtFlat(amtB2bG3PurYtd, y, catG3);
    const amtPurMoVal = (y: number) => amtFlat(amtG3PurMo, y, catG3) + amtFlat(amtB2bG3PurMo, y, catG3);
    rows.push({
      rowKind: 'sellin',
      label: 'sell-in',
      metrics: withYtdYoYGrowth(
        blk(purFull(y3), purFull(y2), purFull(y1), 0, purYtdVal(y1), 0, purYtdVal(y0), purMoVal(y1), 0, purMoVal(y0)),
        purYtdVal(y1), purYtdVal(y0)
      ),
      amountMetrics: withYtdYoYGrowth(
        blk(amtPurFull(y3), amtPurFull(y2), amtPurFull(y1), 0, amtPurYtdVal(y1), 0, amtPurYtdVal(y0), amtPurMoVal(y1), 0, amtPurMoVal(y0)),
        amtPurYtdVal(y1), amtPurYtdVal(y0)
      ),
    });

    // ── total (combined B2C + B2B) row ──
    const salesFull = (y: number) => flat(g3SalesFull, y, catG3) + flat(b2bG3SalesFull, y, catG3);
    const salesYtdVal = (y: number) => flat(g3SalesYtd, y, catG3) + flat(b2bG3SalesYtd, y, catG3);
    const salesMoVal = (y: number) => flat(g3SalesMo, y, catG3) + flat(b2bG3SalesMo, y, catG3);
    const amtSalesFull = (y: number) => amtFlat(amtG3SalesFull, y, catG3) + amtFlat(amtB2bG3SalesFull, y, catG3);
    const amtSalesYtdVal = (y: number) => amtFlat(amtG3SalesYtd, y, catG3) + amtFlat(amtB2bG3SalesYtd, y, catG3);
    const amtSalesMoVal = (y: number) => amtFlat(amtG3SalesMo, y, catG3) + amtFlat(amtB2bG3SalesMo, y, catG3);
    rows.push({
      rowKind: 'total',
      label: '합계',
      metrics: withYtdYoYGrowth(
        blk(salesFull(y3), salesFull(y2), salesFull(y1), 0, salesYtdVal(y1), 0, salesYtdVal(y0), salesMoVal(y1), 0, salesMoVal(y0)),
        salesYtdVal(y1), salesYtdVal(y0)
      ),
      amountMetrics: withYtdYoYGrowth(
        blk(amtSalesFull(y3), amtSalesFull(y2), amtSalesFull(y1), 0, amtSalesYtdVal(y1), 0, amtSalesYtdVal(y0), amtSalesMoVal(y1), 0, amtSalesMoVal(y0)),
        amtSalesYtdVal(y1), amtSalesYtdVal(y0)
      ),
    });

    // ── B2C branch / team rows ──
    for (const { branch, teams } of branchGroupsB2c) {
      let st3f = 0, st2f = 0, st1f = 0, st1 = 0, st0 = 0, smp = 0, smc = 0;
      let ast3f = 0, ast2f = 0, ast1f = 0, ast1 = 0, ast0 = 0, asmp = 0, asmc = 0;
      for (const team of teams) {
        st3f += teamVal(g3TeamSalesFull, y3, catG3, branch, team);
        st2f += teamVal(g3TeamSalesFull, y2, catG3, branch, team);
        st1f += teamVal(g3TeamSalesFull, y1, catG3, branch, team);
        st1 += teamVal(g3TeamSalesYtd, y1, catG3, branch, team);
        st0 += teamVal(g3TeamSalesYtd, y0, catG3, branch, team);
        smp += teamVal(g3TeamSalesMo, y1, catG3, branch, team);
        smc += teamVal(g3TeamSalesMo, y0, catG3, branch, team);
        ast3f += amtTeamVal(amtG3TeamSalesFull, y3, catG3, branch, team);
        ast2f += amtTeamVal(amtG3TeamSalesFull, y2, catG3, branch, team);
        ast1f += amtTeamVal(amtG3TeamSalesFull, y1, catG3, branch, team);
        ast1 += amtTeamVal(amtG3TeamSalesYtd, y1, catG3, branch, team);
        ast0 += amtTeamVal(amtG3TeamSalesYtd, y0, catG3, branch, team);
        asmp += amtTeamVal(amtG3TeamSalesMo, y1, catG3, branch, team);
        asmc += amtTeamVal(amtG3TeamSalesMo, y0, catG3, branch, team);
      }
      rows.push({
        rowKind: 'branch_subtotal',
        label: `${branch} 소계`,
        metrics: withYtdYoYGrowth(
          blk(st3f, st2f, st1f, 0, st1, 0, st0, smp, 0, smc),
          st1, st0
        ),
        amountMetrics: withYtdYoYGrowth(
          blk(ast3f, ast2f, ast1f, 0, ast1, 0, ast0, asmp, 0, asmc),
          ast1, ast0
        ),
      });
      for (const team of teams) {
        const t3f = teamVal(g3TeamSalesFull, y3, catG3, branch, team);
        const t2f = teamVal(g3TeamSalesFull, y2, catG3, branch, team);
        const t1f = teamVal(g3TeamSalesFull, y1, catG3, branch, team);
        const t1y = teamVal(g3TeamSalesYtd, y1, catG3, branch, team);
        const t0y = teamVal(g3TeamSalesYtd, y0, catG3, branch, team);
        const at3f = amtTeamVal(amtG3TeamSalesFull, y3, catG3, branch, team);
        const at2f = amtTeamVal(amtG3TeamSalesFull, y2, catG3, branch, team);
        const at1f = amtTeamVal(amtG3TeamSalesFull, y1, catG3, branch, team);
        const at1y = amtTeamVal(amtG3TeamSalesYtd, y1, catG3, branch, team);
        const at0y = amtTeamVal(amtG3TeamSalesYtd, y0, catG3, branch, team);
        rows.push({
          rowKind: 'team',
          label: team,
          metrics: withYtdYoYGrowth(
            blk(t3f, t2f, t1f, 0, t1y, 0, t0y,
              teamVal(g3TeamSalesMo, y1, catG3, branch, team), 0,
              teamVal(g3TeamSalesMo, y0, catG3, branch, team)),
            t1y, t0y
          ),
          amountMetrics: withYtdYoYGrowth(
            blk(at3f, at2f, at1f, 0, at1y, 0, at0y,
              amtTeamVal(amtG3TeamSalesMo, y1, catG3, branch, team), 0,
              amtTeamVal(amtG3TeamSalesMo, y0, catG3, branch, team)),
            at1y, at0y
          ),
        });
      }
    }

    // ── B2B branch / team rows ──
    for (const { branch, teams } of branchGroupsB2b) {
      let bt3f = 0, bt2f = 0, bt1f = 0, bt1 = 0, bt0 = 0, bmp = 0, bmc = 0;
      let abt3f = 0, abt2f = 0, abt1f = 0, abt1 = 0, abt0 = 0, abmp = 0, abmc = 0;
      for (const team of teams) {
        bt3f += teamVal(b2bG3TeamSalesFull, y3, catG3, branch, team);
        bt2f += teamVal(b2bG3TeamSalesFull, y2, catG3, branch, team);
        bt1f += teamVal(b2bG3TeamSalesFull, y1, catG3, branch, team);
        bt1 += teamVal(b2bG3TeamSalesYtd, y1, catG3, branch, team);
        bt0 += teamVal(b2bG3TeamSalesYtd, y0, catG3, branch, team);
        bmp += teamVal(b2bG3TeamSalesMo, y1, catG3, branch, team);
        bmc += teamVal(b2bG3TeamSalesMo, y0, catG3, branch, team);
        abt3f += amtTeamVal(amtB2bG3TeamSalesFull, y3, catG3, branch, team);
        abt2f += amtTeamVal(amtB2bG3TeamSalesFull, y2, catG3, branch, team);
        abt1f += amtTeamVal(amtB2bG3TeamSalesFull, y1, catG3, branch, team);
        abt1 += amtTeamVal(amtB2bG3TeamSalesYtd, y1, catG3, branch, team);
        abt0 += amtTeamVal(amtB2bG3TeamSalesYtd, y0, catG3, branch, team);
        abmp += amtTeamVal(amtB2bG3TeamSalesMo, y1, catG3, branch, team);
        abmc += amtTeamVal(amtB2bG3TeamSalesMo, y0, catG3, branch, team);
      }
      rows.push({
        rowKind: 'b2b_branch_subtotal',
        label: `${branch} 소계 (B2B)`,
        metrics: withYtdYoYGrowth(
          blk(bt3f, bt2f, bt1f, 0, bt1, 0, bt0, bmp, 0, bmc),
          bt1, bt0
        ),
        amountMetrics: withYtdYoYGrowth(
          blk(abt3f, abt2f, abt1f, 0, abt1, 0, abt0, abmp, 0, abmc),
          abt1, abt0
        ),
      });
      for (const team of teams) {
        const t3f = teamVal(b2bG3TeamSalesFull, y3, catG3, branch, team);
        const t2f = teamVal(b2bG3TeamSalesFull, y2, catG3, branch, team);
        const t1f = teamVal(b2bG3TeamSalesFull, y1, catG3, branch, team);
        const t1y = teamVal(b2bG3TeamSalesYtd, y1, catG3, branch, team);
        const t0y = teamVal(b2bG3TeamSalesYtd, y0, catG3, branch, team);
        const at3f = amtTeamVal(amtB2bG3TeamSalesFull, y3, catG3, branch, team);
        const at2f = amtTeamVal(amtB2bG3TeamSalesFull, y2, catG3, branch, team);
        const at1f = amtTeamVal(amtB2bG3TeamSalesFull, y1, catG3, branch, team);
        const at1y = amtTeamVal(amtB2bG3TeamSalesYtd, y1, catG3, branch, team);
        const at0y = amtTeamVal(amtB2bG3TeamSalesYtd, y0, catG3, branch, team);
        rows.push({
          rowKind: 'b2b_team',
          label: team,
          metrics: withYtdYoYGrowth(
            blk(t3f, t2f, t1f, 0, t1y, 0, t0y,
              teamVal(b2bG3TeamSalesMo, y1, catG3, branch, team), 0,
              teamVal(b2bG3TeamSalesMo, y0, catG3, branch, team)),
            t1y, t0y
          ),
          amountMetrics: withYtdYoYGrowth(
            blk(at3f, at2f, at1f, 0, at1y, 0, at0y,
              amtTeamVal(amtB2bG3TeamSalesMo, y1, catG3, branch, team), 0,
              amtTeamVal(amtB2bG3TeamSalesMo, y0, catG3, branch, team)),
            at1y, at0y
          ),
        });
      }
    }

    sections.push({ category: cat, group3: g3, clientGroup2: cg2, rows });
  }

  // Fetch all distinct non-empty 품목그룹3코드 values from items table
  const g3CodesRes = await executeSQL(
    `SELECT DISTINCT TRIM(품목그룹3코드) as code FROM items
     WHERE 품목그룹3코드 IS NOT NULL AND TRIM(품목그룹3코드) != ''
     ORDER BY code`
  );
  const availableGroup3Codes: string[] = (g3CodesRes?.rows ?? [])
    .map((r: any) => String(r.code))
    .filter(Boolean)
    .sort((a: string, b: string) => {
      const d = g3SortIndex(a) - g3SortIndex(b);
      return d !== 0 ? d : a.localeCompare(b);
    });

  // Fetch all distinct non-empty 품목그룹1코드 values from items table
  const g1CodesRes = await executeSQL(
    `SELECT DISTINCT TRIM(품목그룹1코드) as code FROM items
     WHERE 품목그룹1코드 IS NOT NULL AND TRIM(품목그룹1코드) != ''
     ORDER BY code`
  );
  const availableGroup1Codes: string[] = (g1CodesRes?.rows ?? [])
    .map((r: any) => String(r.code))
    .filter(Boolean)
    .sort((a: string, b: string) => {
      const d = catSortIndex(a) - catSortIndex(b);
      return d !== 0 ? d : a.localeCompare(b);
    });

  // Fetch all distinct non-empty 거래처그룹2 values from company_type_auto table
  const cg2CodesRes = await executeSQL(
    `SELECT DISTINCT TRIM(거래처그룹2) as code FROM company_type_auto
     WHERE 거래처그룹2 IS NOT NULL AND TRIM(거래처그룹2) != ''
     ORDER BY code`
  );
  const availableClientGroup2Codes: string[] = (cg2CodesRes?.rows ?? [])
    .map((r: any) => String(r.code))
    .filter(Boolean);

  return {
    yearLabels: { yPast3: y3, yPast2: y2, yPast1: y1, yCurrent: y0 },
    monthLabel: `${monthInt}월`,
    sections,
    availableMonths,
    currentMonth: currentMonthStr,
    availableGroup3Codes,
    availableGroup1Codes,
    availableClientGroup2Codes,
  };
}
