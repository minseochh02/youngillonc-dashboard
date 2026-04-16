import { executeSQL } from '@/egdesk-helpers';
import { compareOffices, compareTeams, loadFullDisplayOrderContext } from '@/lib/display-order';

const WHERE_B2C = `(ec.b2c_팀 IS NULL OR ec.b2c_팀 != 'B2B')`;
const WHERE_B2B = `ec.b2c_팀 = 'B2B'`;

const B2B_TEAM = `COALESCE(NULLIF(TRIM(ec.b2b팀), ''), '미분류')`;

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

const CATEGORIES = ['MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL', '기타'] as const;

export interface CumulativeMetricBlock {
  yPast3: number;
  yPast2: number;
  yPast1: number;
  yCurrent: number;
  growthRate: number;
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
}

export interface CumulativeSection {
  category: string;
  rows: CumulativeRow[];
}

export interface CumulativeViewPayload {
  yearLabels: { yPast3: number; yPast2: number; yPast1: number; yCurrent: number };
  monthLabel: string;
  sections: CumulativeSection[];
  availableMonths: string[];
  currentMonth: string;
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

export async function buildCumulativeViewPayload(params: {
  currentMonthStr: string;
  currentYear: number;
  availableMonths: string[];
  baseSalesSubquery: string;
  basePurchasesSubquery: string;
}): Promise<CumulativeViewPayload> {
  const { currentMonthStr, currentYear, availableMonths, baseSalesSubquery, basePurchasesSubquery } = params;
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

  const salesYtdSql = `
    SELECT
      CAST(substr(s.일자, 1, 4) AS INTEGER) as year,
      ${SALES_CAT} as category,
      (${BRANCH_FROM_EC}) as branch,
      ec.b2c_팀 as team,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (${baseSalesSubquery}) s
    LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE ${salesYtdFilter}
      AND ${WHERE_B2C}
      AND e.사원_담당_명 != '김도량'
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
    LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(s.일자, 1, 7) IN ('${monthKeyPrev}', '${monthKeyCur}')
      AND ${WHERE_B2C}
      AND e.사원_담당_명 != '김도량'
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
    LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE ${salesYtdFilter}
      AND ${WHERE_B2B}
      AND e.사원_담당_명 != '김도량'
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
    LEFT JOIN clients c ON COALESCE(NULLIF(s.실납업체, ''), s.거래처코드) = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    WHERE substr(s.일자, 1, 7) IN ('${monthKeyPrev}', '${monthKeyCur}')
      AND ${WHERE_B2B}
      AND e.사원_담당_명 != '김도량'
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

  const [
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
  ]);

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

  for (const r of salesYtdRes?.rows || []) {
    const y = Number(r.year);
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeam(r.team);
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
    const team = normTeam(r.team);
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
    const team = normTeam(r.team);
    if (!team) continue;
    const tw = Number(r.target_weight) || 0;
    const gk = `${cat}\t${branch}\t${team}`;
    goalsYtd.set(gk, (goalsYtd.get(gk) || 0) + tw);
  }

  for (const r of goalsMoRes?.rows || []) {
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeam(r.team);
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
    const team = normTeam(r.team);
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
    const team = normTeam(r.team);
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
    const team = normTeam(r.team);
    if (!team) continue;
    const tw = Number(r.target_weight) || 0;
    const gk = `${cat}\t${branch}\t${team}`;
    goalsB2bYtd.set(gk, (goalsB2bYtd.get(gk) || 0) + tw);
  }
  for (const r of b2bGoalsMoRes?.rows || []) {
    const cat = String(r.category);
    const branch = normBranch(r.branch);
    const team = normTeam(r.team);
    if (!team) continue;
    const y = String(r.year);
    const tw = Number(r.target_weight) || 0;
    const gk = `${y}\t${cat}\t${branch}\t${team}`;
    goalsB2bMo.set(gk, (goalsB2bMo.get(gk) || 0) + tw);
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
  const invCombined = (y: number, cat: string) => inv(y, cat) + b2bInv(y, cat);

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

    const y3s = invCombined(y3, cat);
    const y2s = invCombined(y2, cat);
    const y1s = invCombined(y1, cat);
    const y0s = invCombined(y0, cat);
    rows.push({
      rowKind: 'inventory',
      label: '재고',
      metrics: blk(
        y3s,
        y2s,
        y1s,
        y0s,
        y1s,
        0,
        y0s,
        purCombined(purMo, b2bPurMo, y1, cat) -
          getCatSales(catSalesMo, y1, cat) -
          getCatSales(b2bCatSalesMo, y1, cat),
        0,
        purCombined(purMo, b2bPurMo, y0, cat) -
          getCatSales(catSalesMo, y0, cat) -
          getCatSales(b2bCatSalesMo, y0, cat)
      ),
    });

    const p3 = purCombined(purYtd, b2bPurYtd, y3, cat);
    const p2 = purCombined(purYtd, b2bPurYtd, y2, cat);
    const p1 = purCombined(purYtd, b2bPurYtd, y1, cat);
    const p0 = purCombined(purYtd, b2bPurYtd, y0, cat);
    rows.push({
      rowKind: 'sellin',
      label: 'sell-in',
      metrics: blk(
        p3,
        p2,
        p1,
        p0,
        p1,
        0,
        p0,
        purCombined(purMo, b2bPurMo, y1, cat),
        0,
        purCombined(purMo, b2bPurMo, y0, cat)
      ),
    });

    const s3 = getCatSales(catSalesYtd, y3, cat);
    const s2 = getCatSales(catSalesYtd, y2, cat);
    const s1 = getCatSales(catSalesYtd, y1, cat);
    const s0 = getCatSales(catSalesYtd, y0, cat);
    const gt = categoryGoalYtd(cat);
    rows.push({
      rowKind: 'total',
      label: '합계 (B2C)',
      metrics: blk(
        s3,
        s2,
        s1,
        s0,
        s1,
        gt,
        s0,
        getCatSales(catSalesMo, y1, cat),
        categoryGoalMo(y0, cat),
        getCatSales(catSalesMo, y0, cat)
      ),
    });

    for (const { branch, teams } of branchGroups) {
      let st3 = 0;
      let st2 = 0;
      let st1 = 0;
      let st0 = 0;
      let sct = 0;
      let smp = 0;
      let smt = 0;
      let smc = 0;
      for (const team of teams) {
        st3 += getBranchTeamSales(teamSalesYtd, y3, cat, branch, team);
        st2 += getBranchTeamSales(teamSalesYtd, y2, cat, branch, team);
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
        metrics: blk(st3, st2, st1, st0, st1, sct, st0, smp, smt, smc),
      });
      for (const team of teams) {
        const t3 = getBranchTeamSales(teamSalesYtd, y3, cat, branch, team);
        const t2 = getBranchTeamSales(teamSalesYtd, y2, cat, branch, team);
        const t1 = getBranchTeamSales(teamSalesYtd, y1, cat, branch, team);
        const t0 = getBranchTeamSales(teamSalesYtd, y0, cat, branch, team);
        const tgt = goalsYtd.get(goalKey(cat, branch, team)) || 0;
        rows.push({
          rowKind: 'team',
          label: team,
          metrics: blk(
            t3,
            t2,
            t1,
            t0,
            t1,
            tgt,
            t0,
            getBranchTeamSales(teamSalesMo, y1, cat, branch, team),
            goalsMo.get(goalMoKey(y0, cat, branch, team)) || 0,
            getBranchTeamSales(teamSalesMo, y0, cat, branch, team)
          ),
        });
      }
    }

    const b2gYtd = b2bCategoryGoalYtd(cat);
    rows.push({
      rowKind: 'b2b_total',
      label: '합계 (B2B)',
      metrics: blk(
        getCatSales(b2bCatSalesYtd, y3, cat),
        getCatSales(b2bCatSalesYtd, y2, cat),
        getCatSales(b2bCatSalesYtd, y1, cat),
        getCatSales(b2bCatSalesYtd, y0, cat),
        getCatSales(b2bCatSalesYtd, y1, cat),
        b2gYtd,
        getCatSales(b2bCatSalesYtd, y0, cat),
        getCatSales(b2bCatSalesMo, y1, cat),
        b2bCategoryGoalMo(y0, cat),
        getCatSales(b2bCatSalesMo, y0, cat)
      ),
    });

    for (const { branch, teams } of branchGroupsB2b) {
      let st3 = 0;
      let st2 = 0;
      let st1 = 0;
      let st0 = 0;
      let sct = 0;
      let smp = 0;
      let smt = 0;
      let smc = 0;
      for (const team of teams) {
        st3 += getBranchTeamSales(teamB2bSalesYtd, y3, cat, branch, team);
        st2 += getBranchTeamSales(teamB2bSalesYtd, y2, cat, branch, team);
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
        metrics: blk(st3, st2, st1, st0, st1, sct, st0, smp, smt, smc),
      });
      for (const team of teams) {
        const t3 = getBranchTeamSales(teamB2bSalesYtd, y3, cat, branch, team);
        const t2 = getBranchTeamSales(teamB2bSalesYtd, y2, cat, branch, team);
        const t1 = getBranchTeamSales(teamB2bSalesYtd, y1, cat, branch, team);
        const t0 = getBranchTeamSales(teamB2bSalesYtd, y0, cat, branch, team);
        const tgt = goalsB2bYtd.get(goalKey(cat, branch, team)) || 0;
        rows.push({
          rowKind: 'b2b_team',
          label: team,
          metrics: blk(
            t3,
            t2,
            t1,
            t0,
            t1,
            tgt,
            t0,
            getBranchTeamSales(teamB2bSalesMo, y1, cat, branch, team),
            goalsB2bMo.get(goalMoKey(y0, cat, branch, team)) || 0,
            getBranchTeamSales(teamB2bSalesMo, y0, cat, branch, team)
          ),
        });
      }
    }

    sections.push({ category: cat, rows });
  }

  return {
    yearLabels: { yPast3: y3, yPast2: y2, yPast1: y1, yCurrent: y0 },
    monthLabel: `${monthInt}월`,
    sections,
    availableMonths,
    currentMonth: currentMonthStr,
  };
}
