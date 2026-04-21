import type {
  CumulativeMetricBlock,
  CumulativeRow,
  CumulativeSection,
  CumulativeViewChannel,
} from "@/lib/closing-meeting-cumulative";

/** 합산 규칙은 품목군 간 합계 행과 동일 */
export function mergeMetricBlocks(blocks: CumulativeMetricBlock[]): CumulativeMetricBlock | null {
  if (blocks.length === 0) return null;
  const y3 = blocks.reduce((s, m) => s + m.yPast3, 0);
  const y2 = blocks.reduce((s, m) => s + m.yPast2, 0);
  const y1 = blocks.reduce((s, m) => s + m.yPast1, 0);
  const y0 = blocks.reduce((s, m) => s + m.yCurrent, 0);
  const cp = blocks.reduce((s, m) => s + m.cum.priorYear, 0);
  const ct = blocks.reduce((s, m) => s + m.cum.target, 0);
  const cc = blocks.reduce((s, m) => s + m.cum.currentYear, 0);
  const mp = blocks.reduce((s, m) => s + m.mo.priorYear, 0);
  const mt = blocks.reduce((s, m) => s + m.mo.target, 0);
  const mc = blocks.reduce((s, m) => s + m.mo.currentYear, 0);
  const g1 = blocks.reduce((s, m) => s + (m.growthBaseY1 ?? 0), 0);
  const g0 = blocks.reduce((s, m) => s + (m.growthBaseY0 ?? 0), 0);
  const allHaveGrowthBases =
    blocks.length > 0 &&
    blocks.every(
      (m) => typeof m.growthBaseY1 === "number" && typeof m.growthBaseY0 === "number"
    );
  const growthRate =
    allHaveGrowthBases && g1 !== 0 ? (g0 - g1) / g1 : y1 !== 0 ? (y0 - y1) / y1 : 0;
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

/**
 * Sums per-category 합계 rows (same rules as 누적 보기 전체 합계), optionally limited to given categories.
 */
export function aggregateSectionTotals(
  sections: CumulativeSection[],
  cumulativeChannel: CumulativeViewChannel,
  categoryFilter?: ReadonlySet<string> | null
): CumulativeMetricBlock | null {
  const blocks: CumulativeMetricBlock[] = [];
  for (const sec of sections) {
    if (categoryFilter && !categoryFilter.has(sec.category)) continue;
    for (const row of sec.rows) {
      const include =
        cumulativeChannel === "combined"
          ? row.rowKind === "total"
          : cumulativeChannel === "b2c"
            ? row.rowKind === "total"
            : row.rowKind === "b2b_total";
      if (include) blocks.push(row.metrics);
    }
  }
  return mergeMetricBlocks(blocks);
}

/**
 * PVL+CVL+IL 등 품목군 부분집합에 대해 동일 `rowKind` 행만 합산 (재고·sell-in·판매량 등).
 * 마감회의 개요는 `combined` 기준 데이터만 사용합니다.
 */
export function aggregateSectionRowsOfKind(
  sections: CumulativeSection[],
  categoryFilter: ReadonlySet<string> | null | undefined,
  rowKind: CumulativeRow["rowKind"]
): CumulativeMetricBlock | null {
  const blocks: CumulativeMetricBlock[] = [];
  for (const sec of sections) {
    if (categoryFilter && !categoryFilter.has(sec.category)) continue;
    for (const row of sec.rows) {
      if (row.rowKind === rowKind) blocks.push(row.metrics);
    }
  }
  return mergeMetricBlocks(blocks);
}

/** `branch_subtotal` / `b2b_branch_subtotal` 라벨에서 사업소명 추출 */
function parseBranchFromBranchSubtotalLabel(label: string): string | null {
  const b2b = " 소계 (B2B)";
  if (label.endsWith(b2b)) {
    const b = label.slice(0, -b2b.length).trim();
    return b || null;
  }
  const sub = " 소계";
  if (label.endsWith(sub)) {
    const b = label.slice(0, -sub.length).trim();
    return b || null;
  }
  return null;
}

export type TeamSalesBreakdownChannel = "b2c" | "b2b";

export interface TeamSalesBreakdownRow {
  channel: TeamSalesBreakdownChannel;
  branch: string;
  team: string;
  metrics: CumulativeMetricBlock;
}

/**
 * PVL+CVL+IL 등 선택 품목군에서 `team` / `b2b_team` 행을 사업소·팀 단위로 합산 (누적 보기와 동일 원천).
 * combined 뷰에서 B2C 팀 행은 `branch_subtotal` 이후, B2B는 `b2b_branch_subtotal` 이후에 매칭합니다.
 */
export function aggregateTeamSalesBreakdownAcrossCategories(
  sections: CumulativeSection[],
  categoryFilter: ReadonlySet<string>
): TeamSalesBreakdownRow[] {
  const keyToBlocks = new Map<string, CumulativeMetricBlock[]>();

  const push = (key: string, m: CumulativeMetricBlock) => {
    if (!keyToBlocks.has(key)) keyToBlocks.set(key, []);
    keyToBlocks.get(key)!.push(m);
  };

  for (const sec of sections) {
    if (!categoryFilter.has(sec.category)) continue;
    let branchB2c = "";
    let branchB2b = "";
    for (const row of sec.rows) {
      if (row.rowKind === "branch_subtotal") {
        const b = parseBranchFromBranchSubtotalLabel(row.label);
        if (b) branchB2c = b;
        continue;
      }
      if (row.rowKind === "b2b_branch_subtotal") {
        const b = parseBranchFromBranchSubtotalLabel(row.label);
        if (b) branchB2b = b;
        continue;
      }
      if (row.rowKind === "team" && branchB2c) {
        push(`b2c\t${branchB2c}\t${row.label}`, row.metrics);
      }
      if (row.rowKind === "b2b_team" && branchB2b) {
        push(`b2b\t${branchB2b}\t${row.label}`, row.metrics);
      }
    }
  }

  const out: TeamSalesBreakdownRow[] = [];
  for (const [key, blocks] of keyToBlocks) {
    const merged = mergeMetricBlocks(blocks);
    if (!merged) continue;
    const parts = key.split("\t");
    const ch = parts[0];
    const branch = parts[1] ?? "";
    const team = parts.slice(2).join("\t");
    if (ch !== "b2c" && ch !== "b2b") continue;
    out.push({ channel: ch, branch, team, metrics: merged });
  }

  out.sort((a, b) => {
    if (a.channel !== b.channel) return a.channel === "b2c" ? -1 : 1;
    const br = a.branch.localeCompare(b.branch, "ko");
    if (br !== 0) return br;
    return a.team.localeCompare(b.team, "ko");
  });

  return out;
}
