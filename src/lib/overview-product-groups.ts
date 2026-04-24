/**
 * 마감회의 개요: 품목군 블록별 집계 (누적 보기 category 코드와 동일).
 * 순서: 기존 AUTO(PVL+CVL)+IL → AUTO(PVL+CVL) → IL → AVI → MAR → MB
 */
export type OverviewProductGroupId =
  | "pvl-cvl-il"
  | "pvl-cvl"
  | "il"
  | "avi"
  | "mar"
  | "mb";

export const OVERVIEW_PRODUCT_GROUPS: readonly {
  id: OverviewProductGroupId;
  /** 구분 열·요약에 쓰는 품목군 라벨 */
  groupLabel: string;
  categories: ReadonlySet<string>;
}[] = [
  { id: "pvl-cvl-il", groupLabel: "AUTO(PVL+CVL) + IL", categories: new Set(["PVL", "CVL", "IL"]) },
  { id: "pvl-cvl", groupLabel: "AUTO(PVL+CVL)", categories: new Set(["PVL", "CVL"]) },
  { id: "il", groupLabel: "IL", categories: new Set(["IL"]) },
  { id: "avi", groupLabel: "AVI", categories: new Set(["AVI"]) },
  { id: "mar", groupLabel: "MAR", categories: new Set(["MAR"]) },
  { id: "mb", groupLabel: "MB", categories: new Set(["MB"]) },
];

export function overviewSectionSummaryId(gid: OverviewProductGroupId): string {
  return `overview-section-summary:${gid}`;
}

export function overviewSectionTeamsId(gid: OverviewProductGroupId, channel?: "b2c" | "b2b"): string {
  if (!channel) return `overview-section-teams:${gid}`;
  return `overview-section-teams-${channel}:${gid}`;
}

export function parseOverviewSectionDragId(id: string):
  | { kind: "summary"; gid: OverviewProductGroupId }
  | { kind: "teams"; gid: OverviewProductGroupId; channel?: "b2c" | "b2b" }
  | { kind: "breakdown"; type: "sellin" | "sales" }
  | { kind: "breakdown-row"; type: "sellin" | "sales"; rowId: string }
  | null {
  const sumP = "overview-section-summary:";
  const teamP = "overview-section-teams:";
  const teamB2cP = "overview-section-teams-b2c:";
  const teamB2bP = "overview-section-teams-b2b:";
  const rowSellinP = "breakdown-row:sellin:";
  const rowSalesP = "breakdown-row:sales:";

  if (id.startsWith(sumP)) return { kind: "summary", gid: id.slice(sumP.length) as OverviewProductGroupId };
  if (id.startsWith(teamB2cP))
    return { kind: "teams", gid: id.slice(teamB2cP.length) as OverviewProductGroupId, channel: "b2c" };
  if (id.startsWith(teamB2bP))
    return { kind: "teams", gid: id.slice(teamB2bP.length) as OverviewProductGroupId, channel: "b2b" };
  if (id.startsWith(teamP))
    return { kind: "teams", gid: id.slice(teamP.length) as OverviewProductGroupId };

  if (id === "breakdown:sellin") return { kind: "breakdown", type: "sellin" };
  if (id === "breakdown:sales") return { kind: "breakdown", type: "sales" };

  if (id.startsWith(rowSellinP))
    return { kind: "breakdown-row", type: "sellin", rowId: id.slice(rowSellinP.length) };
  if (id.startsWith(rowSalesP))
    return { kind: "breakdown-row", type: "sales", rowId: id.slice(rowSalesP.length) };

  return null;
}

const OV_PREFIX = "ov";

/** @dnd-kit 팀 행 id — stableId(탭 포함) 안전 */
export function overviewTeamSortableId(gid: OverviewProductGroupId, stableTeamId: string): string {
  return JSON.stringify([OV_PREFIX, gid, stableTeamId]);
}

export function parseOverviewTeamSortableId(
  id: string
): { gid: OverviewProductGroupId; stableTeamId: string } | null {
  try {
    const j = JSON.parse(id) as unknown;
    if (!Array.isArray(j) || j.length !== 3 || j[0] !== OV_PREFIX || typeof j[2] !== "string")
      return null;
    return { gid: j[1] as OverviewProductGroupId, stableTeamId: j[2] };
  } catch {
    return null;
  }
}
