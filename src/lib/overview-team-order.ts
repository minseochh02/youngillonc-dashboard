import type { TeamSalesBreakdownRow } from "@/lib/cumulative-section-aggregate";
import type { OverviewProductGroupId } from "@/lib/overview-product-groups";
import { arrayMove } from "@dnd-kit/sortable";

export function teamRowStableId(tr: TeamSalesBreakdownRow): string {
  return `${tr.channel}\t${tr.branch}\t${tr.team}`;
}

/** 지사 열 병합·블록 id용 라벨 — 지사명(branch) 그대로 사용. */
export function normalizeOverviewBranchLabel(tr: TeamSalesBreakdownRow): string {
  return tr.branch.trim();
}

export function branchBlockKey(tr: TeamSalesBreakdownRow): string {
  return `${tr.channel}\t${normalizeOverviewBranchLabel(tr)}`;
}

/** 품목군 블록마다 지사 접기 키가 겹치지 않도록 */
export function overviewBranchBlockKey(segmentId: string, tr: TeamSalesBreakdownRow): string {
  return `${segmentId}\t${branchBlockKey(tr)}`;
}

export function parseOverviewBranchBlockKey(
  fullKey: string
): { segmentId: string; branchKey: string } | null {
  const i = fullKey.indexOf("\t");
  if (i < 0) return null;
  return { segmentId: fullKey.slice(0, i), branchKey: fullKey.slice(i + 1) };
}

/** `branchBlockKey` / 지사 블록 id의 채널 접두사 */
export function channelFromBranchBlockKey(key: string): "b2c" | "b2b" | null {
  const p = key.split("\t")[0];
  if (p === "b2c" || p === "b2b") return p;
  return null;
}

/** B2C 행 전부 → B2B 행 전부 순으로만 허용 (팀·지사 순서는 각 구간 안에서 유지) */
export function normalizeTeamRowChannelOrder(rows: TeamSalesBreakdownRow[]): TeamSalesBreakdownRow[] {
  if (rows.length === 0) return rows;
  const b2c = rows.filter((r) => r.channel === "b2c");
  const b2b = rows.filter((r) => r.channel === "b2b");
  return [...b2c, ...b2b];
}

/** Exported for overview UI (collapse blocks). */
export function rowsToBranchBlocks(rows: TeamSalesBreakdownRow[]): {
  key: string;
  rows: TeamSalesBreakdownRow[];
}[] {
  const blocks: { key: string; rows: TeamSalesBreakdownRow[] }[] = [];
  for (const r of rows) {
    const key = branchBlockKey(r);
    const last = blocks[blocks.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else blocks.push({ key, rows: [r] });
  }
  return blocks;
}

/** Move one branch block before another (by block key). */
export function reorderBranchBlocks(
  rows: TeamSalesBreakdownRow[],
  fromKey: string,
  toKey: string
): TeamSalesBreakdownRow[] {
  if (fromKey === toKey) return rows;
  const fromCh = channelFromBranchBlockKey(fromKey);
  const toCh = channelFromBranchBlockKey(toKey);
  if (fromCh && toCh && fromCh !== toCh) return rows;
  const blocks = rowsToBranchBlocks(rows);
  const keys = blocks.map((b) => b.key);
  const fromIdx = keys.indexOf(fromKey);
  const toIdx = keys.indexOf(toKey);
  if (fromIdx < 0 || toIdx < 0) return rows;
  const newKeys = arrayMove(keys, fromIdx, toIdx);
  const map = new Map(blocks.map((b) => [b.key, b.rows] as const));
  return newKeys.flatMap((k) => map.get(k) ?? []);
}

const LS_PREFIX_V1 = "closing-meeting-overview-order:v1";
const LS_PREFIX_V2 = "closing-meeting-overview-order:v2";

export type OverviewSegmentPersist = {
  summaryFirst: boolean;
  teamRowIds: string[] | null;
  teamsSectionHidden: boolean;
  b2cBlockCollapsed: boolean;
  b2bBlockCollapsed: boolean;
  collapsedBranchKeys: string[];
};

export type OverviewOrderPersistV2 = {
  segments: Partial<Record<OverviewProductGroupId, OverviewSegmentPersist>>;
  groupOrder?: OverviewProductGroupId[];
};

function defaultSegmentPersist(): OverviewSegmentPersist {
  return {
    summaryFirst: true,
    teamRowIds: null,
    teamsSectionHidden: false,
    b2cBlockCollapsed: false,
    b2bBlockCollapsed: false,
    collapsedBranchKeys: [],
  };
}

/** v1 → v2: 기존 단일 블록을 `pvl-cvl-il` 로 이관 */
export function loadOverviewOrderV2(month: string): OverviewOrderPersistV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const rawV2 = localStorage.getItem(`${LS_PREFIX_V2}:${month}`);
    if (rawV2) {
      const j = JSON.parse(rawV2) as {
        segments?: OverviewOrderPersistV2["segments"];
        groupOrder?: OverviewProductGroupId[];
      };
      return {
        segments: j.segments && typeof j.segments === "object" ? j.segments : {},
        groupOrder: Array.isArray(j.groupOrder) ? j.groupOrder : undefined,
      };
    }
    const rawV1 = localStorage.getItem(`${LS_PREFIX_V1}:${month}`);
    if (!rawV1) return null;
    const j = JSON.parse(rawV1) as {
      summaryFirst?: boolean;
      teamRowIds?: string[];
      teamsSectionHidden?: boolean;
      salesRowCollapsed?: boolean;
      b2cBlockCollapsed?: boolean;
      collapsedBranchKeys?: string[];
    };
    const teamsHidden =
      typeof j.teamsSectionHidden === "boolean"
        ? j.teamsSectionHidden
        : typeof j.salesRowCollapsed === "boolean"
          ? j.salesRowCollapsed
          : false;
    return {
      segments: {
        "pvl-cvl-il": {
          summaryFirst: typeof j.summaryFirst === "boolean" ? j.summaryFirst : true,
          teamRowIds: Array.isArray(j.teamRowIds) ? j.teamRowIds : null,
          teamsSectionHidden: teamsHidden,
          b2cBlockCollapsed: typeof j.b2cBlockCollapsed === "boolean" ? j.b2cBlockCollapsed : false,
          b2bBlockCollapsed: false,
          collapsedBranchKeys: (Array.isArray(j.collapsedBranchKeys) ? j.collapsedBranchKeys : [])
            .filter((k): k is string => typeof k === "string")
            .map((k) => (k.startsWith("pvl-cvl-il\t") ? k : `pvl-cvl-il\t${k}`)),
        },
      },
      groupOrder: undefined,
    };
  } catch {
    return null;
  }
}

export function saveOverviewOrderV2(month: string, data: OverviewOrderPersistV2): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LS_PREFIX_V2}:${month}`, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function getSegmentPersist(
  loaded: OverviewOrderPersistV2 | null,
  gid: OverviewProductGroupId
): OverviewSegmentPersist {
  return loaded?.segments?.[gid] ?? defaultSegmentPersist();
}

/** Restore row order from saved ids; append rows missing from saved list. */
export function applySavedTeamOrder(
  baseline: TeamSalesBreakdownRow[],
  savedIds: string[] | null
): TeamSalesBreakdownRow[] {
  if (!savedIds?.length) return baseline;
  const out: TeamSalesBreakdownRow[] = [];
  const used = new Set<TeamSalesBreakdownRow>();
  for (const id of savedIds) {
    const tr = baseline.find((t) => teamRowStableId(t) === id);
    if (tr && !used.has(tr)) {
      out.push(tr);
      used.add(tr);
    }
  }
  for (const tr of baseline) {
    if (!used.has(tr)) out.push(tr);
  }
  return normalizeTeamRowChannelOrder(out);
}
