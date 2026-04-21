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

export function overviewSectionTeamsId(gid: OverviewProductGroupId): string {
  return `overview-section-teams:${gid}`;
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
