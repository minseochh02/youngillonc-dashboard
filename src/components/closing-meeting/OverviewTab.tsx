"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, GripVertical, Loader2 } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVatInclude } from "@/contexts/VatIncludeContext";
import { apiFetch } from "@/lib/api";
import { withIncludeVat } from "@/lib/vat-query";
import type { CumulativeMetricBlock, CumulativeViewPayload } from "@/lib/closing-meeting-cumulative";
import {
  aggregateSectionRowsOfKind,
  aggregateTeamSalesBreakdownAcrossCategories,
  mergeMetricBlocks,
  type TeamSalesBreakdownRow,
} from "@/lib/cumulative-section-aggregate";
import {
  OVERVIEW_PRODUCT_GROUPS,
  type OverviewProductGroupId,
  overviewSectionSummaryId,
  overviewSectionTeamsId,
  overviewTeamSortableId,
  parseOverviewTeamSortableId,
} from "@/lib/overview-product-groups";
import {
  applySavedTeamOrder,
  channelFromBranchBlockKey,
  getSegmentPersist,
  loadOverviewOrderV2,
  normalizeOverviewBranchLabel,
  overviewBranchBlockKey,
  parseOverviewBranchBlockKey,
  reorderBranchBlocks,
  rowsToBranchBlocks,
  saveOverviewOrderV2,
  teamRowStableId,
} from "@/lib/overview-team-order";
import type { OverviewOrderPersistV2 } from "@/lib/overview-team-order";

interface OverviewTabProps {
  selectedMonth: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

type OverviewSegmentUiState = {
  orderedTeams: TeamSalesBreakdownRow[];
  summarySectionFirst: boolean;
  teamsSectionHidden: boolean;
  b2cBlockCollapsed: boolean;
  collapsedBranches: string[];
};

function normalizeGroupOrder(raw: unknown): OverviewProductGroupId[] {
  const all = OVERVIEW_PRODUCT_GROUPS.map((g) => g.id);
  if (!Array.isArray(raw)) return all;
  const seen = new Set<OverviewProductGroupId>();
  const out: OverviewProductGroupId[] = [];
  for (const id of raw) {
    if (typeof id !== "string") continue;
    if (!all.includes(id as OverviewProductGroupId)) continue;
    const gid = id as OverviewProductGroupId;
    if (seen.has(gid)) continue;
    seen.add(gid);
    out.push(gid);
  }
  for (const id of all) if (!seen.has(id)) out.push(id);
  return out;
}

function formatInt(n: number) {
  if (Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("ko-KR");
}

function formatRate(r: number) {
  if (Number.isNaN(r) || !Number.isFinite(r)) return "—";
  return `${(r * 100).toFixed(1)}%`;
}

function teamOnlyFromLabel(label: string): string {
  const s = label.replace(/^\s*\[(?:B2C|B2B)\]\s*/i, "").trim();
  const dot = s.indexOf("·");
  if (dot >= 0) {
    const right = s.slice(dot + 1).trim();
    if (right) return right;
  }
  return s;
}

function branchMergeMeta(
  rows: readonly TeamSalesBreakdownRow[]
): { showBranchCell: boolean; branchRowSpan: number }[] {
  const n = rows.length;
  const out: { showBranchCell: boolean; branchRowSpan: number }[] = new Array(n);
  let i = 0;
  while (i < n) {
    const b = normalizeOverviewBranchLabel(rows[i]!);
    let j = i + 1;
    while (j < n && normalizeOverviewBranchLabel(rows[j]!) === b) j++;
    const span = j - i;
    out[i] = { showBranchCell: true, branchRowSpan: span };
    for (let k = i + 1; k < j; k++) {
      out[k] = { showBranchCell: false, branchRowSpan: 0 };
    }
    i = j;
  }
  return out;
}

const thBase =
  "border border-zinc-900 dark:border-zinc-600 px-2 py-2 text-center text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-[#d9e1f2] dark:bg-zinc-700 align-middle";
const thStickyR1 = `${thBase} sticky top-0 z-[32]`;
const thStickyR2 = `${thBase} sticky z-[28]`;
const tdNum =
  "border border-zinc-900 dark:border-zinc-600 px-2 py-1.5 text-right text-xs tabular-nums text-zinc-800 dark:text-zinc-200";
const thSub =
  "border border-zinc-900 dark:border-zinc-600 px-2 py-1.5 text-center text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900";
const thCat =
  "border border-zinc-900 dark:border-zinc-600 px-2 py-1.5 text-center text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800";

const thCatProduct =
  `${thCat} w-[4.25rem] max-w-[4.25rem] min-w-0 px-1 py-2 text-[10px] leading-snug whitespace-normal break-words [overflow-wrap:anywhere] align-middle`;

/** 요약/팀이 서로 다른 tbody라 AUTO 열이 두 개의 th로 쌓임 — 인접 경계선 제거 */
const autoColJoinAboveCls = "border-t-0";
const autoColJoinBelowCls = "border-b-0";

const rowInvCell = `${tdNum} bg-[#fce4d6] dark:bg-amber-950/35`;
const rowInvSub = `${thSub} bg-[#fce4d6] dark:bg-amber-950/35`;

function autoGroupLabelForChannel(groupLabel: string, ch: TeamSalesBreakdownRow["channel"]): string {
  return ch === "b2c" ? `${groupLabel} [b2c]` : `${groupLabel} [b2b]`;
}

function visibleTeamRowCountInBlock(
  rows: TeamSalesBreakdownRow[],
  collapsedBranchKeys: ReadonlySet<string>
): number {
  let n = rows.length;
  for (const b of rowsToBranchBlocks(rows)) {
    if (collapsedBranchKeys.has(b.key) && b.rows.length > 1) n -= b.rows.length - 1;
  }
  return Math.max(1, n);
}

const dragHandleBtn =
  "inline-flex shrink-0 cursor-grab touch-none rounded border border-zinc-300 bg-zinc-100/90 p-0.5 text-zinc-500 hover:bg-zinc-200 active:cursor-grabbing dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700";

const b2cBlockToggleBtn =
  "inline-flex shrink-0 items-center rounded border border-violet-400/50 bg-white/80 p-0.5 text-violet-700 hover:bg-violet-50 dark:border-violet-600 dark:bg-zinc-900/80 dark:text-violet-300 dark:hover:bg-zinc-800";

function DashMetricCells({ tdClass }: { tdClass: string }) {
  return (
    <>
      {Array.from({ length: 15 }, (_, i) => (
        <td key={i} className={tdClass}>
          —
        </td>
      ))}
    </>
  );
}

function MetricCells({ block, tdClass }: { block: CumulativeMetricBlock; tdClass: string }) {
  return (
    <>
      <td className={tdClass}>{formatInt(block.yPast3)}</td>
      <td className={tdClass}>{formatInt(block.yPast2)}</td>
      <td className={tdClass}>{formatInt(block.yPast1)}</td>
      <td className={tdClass}>{formatInt(block.yCurrent)}</td>
      <td className={tdClass}>{formatRate(block.growthRate)}</td>
      <td className={tdClass}>{formatInt(block.cum.priorYear)}</td>
      <td className={tdClass}>{formatInt(block.cum.target)}</td>
      <td className={tdClass}>{formatInt(block.cum.currentYear)}</td>
      <td className={tdClass}>{formatRate(block.cum.achievementRate)}</td>
      <td className={tdClass}>{formatRate(block.cum.yoyRate)}</td>
      <td className={tdClass}>{formatInt(block.mo.priorYear)}</td>
      <td className={tdClass}>{formatInt(block.mo.target)}</td>
      <td className={tdClass}>{formatInt(block.mo.currentYear)}</td>
      <td className={tdClass}>{formatRate(block.mo.achievementRate)}</td>
      <td className={tdClass}>{formatRate(block.mo.yoyRate)}</td>
    </>
  );
}

type TeamRowRender = (a: {
  setActivatorNodeRef: (el: HTMLElement | null) => void;
  listeners: Record<string, unknown>;
}) => ReactNode;

function SortableTeamRow({
  id,
  rowHidden,
  children,
}: {
  id: string;
  /** 접힌 지사 블록의 후속 행 — 레이아웃 유지용으로 DOM에만 두고 숨김 */
  rowHidden?: boolean;
  children: TeamRowRender;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: rowHidden });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : undefined,
    display: rowHidden ? "none" : undefined,
  };
  return (
    <tr ref={setNodeRef} style={style} {...attributes}>
      {children({ setActivatorNodeRef, listeners: listeners as Record<string, unknown> })}
    </tr>
  );
}

function OverviewSummarySection({
  groupLabel,
  sortableSectionId,
  invRow,
  sellinRow,
  salesRow,
  salesMetricCls,
  salesLabelCls,
  teamsSectionHidden,
  onToggleTeamsSection,
  autoColJoinAbove,
  autoColJoinBelow,
}: {
  groupLabel: string;
  sortableSectionId: string;
  invRow: CumulativeMetricBlock;
  sellinRow: CumulativeMetricBlock;
  salesRow: CumulativeMetricBlock;
  salesMetricCls: string;
  salesLabelCls: string;
  /** 아래 지사·팀 표 숨김 — 판매량 수치는 항상 표시 */
  teamsSectionHidden: boolean;
  onToggleTeamsSection: () => void;
  /** 팀 블록이 위에 있을 때 위쪽 AUTO th와 경계 맞춤 */
  autoColJoinAbove?: boolean;
  /** 팀 블록이 아래에 있을 때 아래쪽 AUTO th와 경계 맞춤 */
  autoColJoinBelow?: boolean;
}) {
  const sortable = useSortable({ id: sortableSectionId });
  return (
    <tbody ref={sortable.setNodeRef} style={{ opacity: sortable.isDragging ? 0.55 : undefined }}>
      <tr>
        <th
          rowSpan={3}
          className={`${thCatProduct}${autoColJoinAbove ? ` ${autoColJoinAboveCls}` : ""}${autoColJoinBelow ? ` ${autoColJoinBelowCls}` : ""}`}
        >
          <span className="flex flex-col items-center gap-1">
            <button
              type="button"
              className={dragHandleBtn}
              aria-label="요약 블록과 팀 블록 순서 바꾸기"
              title="드래그: 요약/팀 순서 이동 (다른 품목군 요약으로 드롭 시 품목군 순서 이동)"
              {...sortable.listeners}
              {...sortable.attributes}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <span className="block w-full min-w-0">
              {groupLabel}
            </span>
          </span>
        </th>
        <th className={rowInvSub} colSpan={2}>
          재고
        </th>
        <MetricCells block={invRow} tdClass={rowInvCell} />
      </tr>
      <tr>
        <th className={thSub} colSpan={2}>
          <strong>sell-in</strong>
        </th>
        <MetricCells block={sellinRow} tdClass={tdNum} />
      </tr>
      <tr>
        <th className={salesLabelCls} colSpan={2}>
          <span className="inline-flex flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              onClick={onToggleTeamsSection}
              className="inline-flex shrink-0 items-center rounded border border-violet-400/50 bg-white/80 p-0.5 text-violet-700 hover:bg-violet-50 dark:border-violet-600 dark:bg-zinc-900/80 dark:text-violet-300 dark:hover:bg-zinc-800"
              aria-expanded={!teamsSectionHidden}
              title={
                teamsSectionHidden
                  ? "지사·팀 표 펼치기 (판매량 숫자는 그대로)"
                  : "지사·팀 표 숨기기 (판매량 숫자는 그대로)"
              }
            >
              {teamsSectionHidden ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-sm border border-zinc-500/40 dark:border-zinc-400/50 bg-white/70 dark:bg-zinc-900/70 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                합계
              </span>
              <strong>판매량</strong>
            </span>
          </span>
        </th>
        <MetricCells block={salesRow} tdClass={salesMetricCls} />
      </tr>
    </tbody>
  );
}

/** 지사·팀을 숨긴 뒤에도 요약↔팀 블록 드래그·정렬용으로 팀 tbody 유지 */
function OverviewTeamsHiddenPlaceholder({
  sortableSectionTeamsId,
  autoColJoinAbove,
  autoColJoinBelow,
}: {
  sortableSectionTeamsId: string;
  autoColJoinAbove?: boolean;
  autoColJoinBelow?: boolean;
}) {
  const sectionSortable = useSortable({ id: sortableSectionTeamsId });
  return (
    <tbody
      ref={sectionSortable.setNodeRef}
      style={{ opacity: sectionSortable.isDragging ? 0.55 : undefined }}
    >
      <tr>
        {/* AUTO 열은 위 요약·아래 팀 표와 동일하게 단독 열 유지 (3열 합치지 않음) */}
        <th
          className={`${thCatProduct}${autoColJoinAbove ? ` ${autoColJoinAboveCls}` : ""}${autoColJoinBelow ? ` ${autoColJoinBelowCls}` : ""}`}
          aria-hidden
        />
        <th
          colSpan={2}
          className={`${thSub} text-left text-zinc-500 dark:text-zinc-400`}
        >
          <span className="px-1 text-[10px]">지사·팀 표 숨김</span>
        </th>
        <td colSpan={15} className={`${tdNum} text-center text-zinc-500 dark:text-zinc-400`}>
          위 &ldquo;합계 판매량&rdquo; 줄의 ◀ 버튼으로 다시 표시할 수 있습니다.
        </td>
      </tr>
    </tbody>
  );
}

function OverviewTeamsSection({
  groupId,
  groupLabel,
  sortableSectionTeamsId,
  orderedTeams,
  teamLabelCls,
  teamBranchCls,
  teamMetricCls,
  collapsedBranchKeys,
  onToggleBranchCollapse,
  onBranchDragStart,
  onBranchDragOver,
  onBranchDrop,
  autoColJoinAbove,
  autoColJoinBelow,
  b2cBlockCollapsed,
  onToggleB2cBlock,
}: {
  groupId: OverviewProductGroupId;
  groupLabel: string;
  sortableSectionTeamsId: string;
  orderedTeams: TeamSalesBreakdownRow[];
  teamLabelCls: string;
  teamBranchCls: string;
  teamMetricCls: string;
  collapsedBranchKeys: ReadonlySet<string>;
  onToggleBranchCollapse: (branchKey: string) => void;
  onBranchDragStart: (e: React.DragEvent, key: string) => void;
  onBranchDragOver: (e: React.DragEvent) => void;
  onBranchDrop: (e: React.DragEvent, targetKey: string) => void;
  /** 요약이 위에 있을 때 첫 채널(B2C) 블록 AUTO 셀 상단 */
  autoColJoinAbove?: boolean;
  /** 요약이 아래에 있을 때 마지막 채널 블록 AUTO 셀 하단 */
  autoColJoinBelow?: boolean;
  b2cBlockCollapsed: boolean;
  onToggleB2cBlock: () => void;
}) {
  const sectionSortable = useSortable({ id: sortableSectionTeamsId });

  const allTeamSortableIds = useMemo(
    () => orderedTeams.map((t) => overviewTeamSortableId(groupId, teamRowStableId(t))),
    [groupId, orderedTeams]
  );

  const sortableTeamIds = useMemo(() => {
    if (b2cBlockCollapsed) {
      return orderedTeams
        .filter((t) => t.channel !== "b2c")
        .map((t) => overviewTeamSortableId(groupId, teamRowStableId(t)));
    }
    return allTeamSortableIds;
  }, [b2cBlockCollapsed, orderedTeams, groupId, allTeamSortableIds]);

  /** 채널이 바뀌는 지점마다 AUTO 열 블록을 나눔 (팀 순서 드래그 유지) */
  const channelBlocks = useMemo(() => {
    const blocks: { channel: TeamSalesBreakdownRow["channel"]; rows: TeamSalesBreakdownRow[] }[] =
      [];
    for (const tr of orderedTeams) {
      const last = blocks[blocks.length - 1];
      if (last && last.channel === tr.channel) last.rows.push(tr);
      else blocks.push({ channel: tr.channel, rows: [tr] });
    }
    return blocks;
  }, [orderedTeams]);

  const b2cTotalLabelCls = `${thSub} bg-violet-50/80 font-semibold dark:bg-violet-950/25`;

  /**
   * `collapsedBranchKeys` stores full keys (`${groupId}\t${channel}\t${branch}`).
   * `visibleTeamRowCountInBlock` / `rowsToBranchBlocks` uses short keys (`${channel}\t${branch}`).
   * Convert here so rowSpan is calculated correctly.
   */
  const shortCollapsedBranchKeys = useMemo(() => {
    const s = new Set<string>();
    for (const k of collapsedBranchKeys) {
      const parsed = parseOverviewBranchBlockKey(k);
      s.add(parsed ? parsed.branchKey : k);
    }
    return s;
  }, [collapsedBranchKeys]);

  return (
    <tbody
      ref={sectionSortable.setNodeRef}
      style={{ opacity: sectionSortable.isDragging ? 0.55 : undefined }}
    >
      <SortableContext items={sortableTeamIds} strategy={verticalListSortingStrategy}>
        {channelBlocks.flatMap((block, bi) => {
          const nb = channelBlocks.length;
          const isFirstBlock = bi === 0;
          const isLastBlock = bi === nb - 1;
          const joinTop = isFirstBlock && autoColJoinAbove;
          const joinBot = isLastBlock && autoColJoinBelow;

          if (block.channel === "b2c" && b2cBlockCollapsed && block.rows.length > 0) {
            const merged = mergeMetricBlocks(block.rows.map((r) => r.metrics));
            if (!merged) return [];
            return [
              <tr key="ov-b2c-block-total">
                <th
                  className={`${thCatProduct}${joinTop ? ` ${autoColJoinAboveCls}` : ""}${joinBot ? ` ${autoColJoinBelowCls}` : ""}`}
                >
                  <span className="flex flex-col items-center gap-1">
                    {isFirstBlock ? (
                      <button
                        type="button"
                        className={dragHandleBtn}
                        aria-label="요약 블록과 팀 블록 순서 바꾸기"
                        {...sectionSortable.listeners}
                        {...sectionSortable.attributes}
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="h-[26px] shrink-0" aria-hidden />
                    )}
                    <span className="flex w-full min-w-0 flex-col items-center gap-0.5">
                      <button
                        type="button"
                        onClick={onToggleB2cBlock}
                        className={b2cBlockToggleBtn}
                        aria-expanded={false}
                        title="B2C 지사·팀 펼치기"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <span className="block w-full min-w-0 text-center">
                        {autoGroupLabelForChannel(groupLabel, "b2c")}
                      </span>
                    </span>
                  </span>
                </th>
                <th colSpan={2} className={b2cTotalLabelCls}>
                  B2C 합계
                </th>
                <MetricCells block={merged} tdClass={teamMetricCls} />
              </tr>,
            ];
          }

          const mergeMeta = branchMergeMeta(block.rows);
          const blockTeamCount = visibleTeamRowCountInBlock(block.rows, shortCollapsedBranchKeys);
          return block.rows.map((tr, ti) => {
            const merge = mergeMeta[ti]!;
            const sid = overviewTeamSortableId(groupId, teamRowStableId(tr));
            const bk = overviewBranchBlockKey(groupId, tr);
            const branchCollapsed = collapsedBranchKeys.has(bk);
            const rowHidden = branchCollapsed && !merge.showBranchCell;
            const branchSpan = branchCollapsed && merge.showBranchCell ? 1 : merge.branchRowSpan;
            const branchMetricsTotal =
              branchCollapsed && merge.showBranchCell
                ? mergeMetricBlocks(
                    block.rows.slice(ti, ti + merge.branchRowSpan).map((r) => r.metrics)
                  )
                : null;

            const autoColCell =
              ti === 0 ? (
                <th
                  rowSpan={blockTeamCount}
                  className={`${thCatProduct}${joinTop ? ` ${autoColJoinAboveCls}` : ""}${joinBot ? ` ${autoColJoinBelowCls}` : ""}`}
                >
                  <span className="flex flex-col items-center gap-1">
                    {isFirstBlock ? (
                      <button
                        type="button"
                        className={dragHandleBtn}
                        aria-label="요약 블록과 팀 블록 순서 바꾸기"
                        {...sectionSortable.listeners}
                        {...sectionSortable.attributes}
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="h-[26px] shrink-0" aria-hidden />
                    )}
                    <span className="flex w-full min-w-0 flex-col items-center gap-0.5">
                      {block.channel === "b2c" ? (
                        <>
                          <button
                            type="button"
                            onClick={onToggleB2cBlock}
                            className={b2cBlockToggleBtn}
                            aria-expanded
                            title="B2C 합계만 보기"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <span className="block w-full min-w-0 text-center">
                        {autoGroupLabelForChannel(groupLabel, "b2c")}
                      </span>
                        </>
                      ) : (
                        <span className="block w-full min-w-0">
                          {autoGroupLabelForChannel(groupLabel, block.channel)}
                        </span>
                      )}
                    </span>
                  </span>
                </th>
              ) : null;

            return (
              <SortableTeamRow key={sid} id={sid} rowHidden={rowHidden}>
                {({ setActivatorNodeRef, listeners }) => (
                  <>
                    {autoColCell}
                    {merge.showBranchCell ? (
                      <th
                        className={teamBranchCls}
                        rowSpan={branchSpan}
                        onDragOver={onBranchDragOver}
                        onDrop={(e) => onBranchDrop(e, bk)}
                      >
                        <span className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5">
                          <span className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleBranchCollapse(bk);
                              }}
                              className="inline-flex shrink-0 items-center rounded border border-zinc-400/60 bg-white/90 p-0.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              aria-expanded={!branchCollapsed}
                              title={branchCollapsed ? "지사 팀 펼치기" : "지사 팀 접기"}
                            >
                              {branchCollapsed ? (
                                <ChevronRight className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                            <span
                              className={`${dragHandleBtn} mb-0.5`}
                              draggable
                              onDragStart={(e) => onBranchDragStart(e, bk)}
                              aria-label={`${tr.branch} 지사 블록 이동`}
                            >
                              <GripVertical className="h-3 w-3" />
                            </span>
                          </span>
                          <span className="w-full break-words text-center text-[10px] font-medium leading-tight [overflow-wrap:anywhere]">
                            {normalizeOverviewBranchLabel(tr)}
                          </span>
                        </span>
                      </th>
                    ) : null}
                    <th className={teamLabelCls}>
                      <span className="flex items-start justify-start gap-1 pl-0.5 text-left">
                        <button
                          type="button"
                          ref={setActivatorNodeRef}
                          className={`${dragHandleBtn} mt-0.5`}
                          aria-label="팀 행 이동"
                          disabled={rowHidden}
                          {...listeners}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-0 flex-1 pt-0.5">
                          {branchCollapsed && merge.showBranchCell ? (
                            <span className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-100">
                              합계
                              {merge.branchRowSpan > 1 ? (
                                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                                  {" "}
                                  ({merge.branchRowSpan}팀)
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            teamOnlyFromLabel(tr.team)
                          )}
                        </span>
                      </span>
                    </th>
                    {rowHidden ? (
                      <MetricCells block={tr.metrics} tdClass={teamMetricCls} />
                    ) : branchCollapsed && merge.showBranchCell && branchMetricsTotal ? (
                      <MetricCells block={branchMetricsTotal} tdClass={teamMetricCls} />
                    ) : branchCollapsed && merge.showBranchCell ? (
                      <DashMetricCells tdClass={teamMetricCls} />
                    ) : (
                      <MetricCells block={tr.metrics} tdClass={teamMetricCls} />
                    )}
                  </>
                )}
              </SortableTeamRow>
            );
          });
        })}
      </SortableContext>
    </tbody>
  );
}

function parseOverviewSectionDragId(id: string):
  | { kind: "summary"; gid: OverviewProductGroupId }
  | { kind: "teams"; gid: OverviewProductGroupId }
  | null {
  const sumP = "overview-section-summary:";
  const teamP = "overview-section-teams:";
  if (id.startsWith(sumP)) return { kind: "summary", gid: id.slice(sumP.length) as OverviewProductGroupId };
  if (id.startsWith(teamP)) return { kind: "teams", gid: id.slice(teamP.length) as OverviewProductGroupId };
  return null;
}

export default function OverviewTab({ selectedMonth, onMonthsAvailable }: OverviewTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<CumulativeViewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [subHeaderTopPx, setSubHeaderTopPx] = useState(40);
  const [segmentState, setSegmentState] = useState<
    Partial<Record<OverviewProductGroupId, OverviewSegmentUiState>>
  >({});
  const [groupOrder, setGroupOrder] = useState<OverviewProductGroupId[]>(
    OVERVIEW_PRODUCT_GROUPS.map((g) => g.id)
  );
  const reportedMonths = useRef(false);
  const firstHeadRowRef = useRef<HTMLTableRowElement>(null);
  const secondHeadRowRef = useRef<HTMLTableRowElement>(null);

  const segmentBaselines = useMemo(() => {
    if (!data?.sections?.length) return null;
    const m = new Map<
      OverviewProductGroupId,
      {
        baseline: TeamSalesBreakdownRow[];
        inv: CumulativeMetricBlock | null;
        sellin: CumulativeMetricBlock | null;
        sales: CumulativeMetricBlock | null;
      }
    >();
    for (const g of OVERVIEW_PRODUCT_GROUPS) {
      const baseline = aggregateTeamSalesBreakdownAcrossCategories(data.sections, g.categories);
      m.set(g.id, {
        baseline,
        inv: aggregateSectionRowsOfKind(data.sections, g.categories, "inventory"),
        sellin: aggregateSectionRowsOfKind(data.sections, g.categories, "sellin"),
        sales: aggregateSectionRowsOfKind(data.sections, g.categories, "total"),
      });
    }
    return m;
  }, [data?.sections]);

  const segmentBaselinesFingerprint = useMemo(() => {
    if (!segmentBaselines) return "";
    return OVERVIEW_PRODUCT_GROUPS.map((g) => {
      const b = segmentBaselines.get(g.id)?.baseline ?? [];
      return `${g.id}:${b.map(teamRowStableId).join("\u0001")}`;
    }).join("\u0002");
  }, [segmentBaselines]);

  /** LS + baseline — used when `segmentState` has no override yet (avoids empty first paint). */
  const hydratedDefaults = useMemo(() => {
    if (!segmentBaselines) return null;
    const loaded = loadOverviewOrderV2(selectedMonth);
    const next: Partial<Record<OverviewProductGroupId, OverviewSegmentUiState>> = {};
    for (const g of OVERVIEW_PRODUCT_GROUPS) {
      const sd = segmentBaselines.get(g.id);
      if (!sd) continue;
      const { baseline } = sd;
      const s = getSegmentPersist(loaded, g.id);
      const validKeys = new Set(
        rowsToBranchBlocks(baseline).map((b) => overviewBranchBlockKey(g.id, b.rows[0]!))
      );
      next[g.id] = {
        orderedTeams: applySavedTeamOrder(baseline, s.teamRowIds),
        summarySectionFirst: s.summaryFirst,
        teamsSectionHidden: s.teamsSectionHidden,
        b2cBlockCollapsed: s.b2cBlockCollapsed,
        collapsedBranches: s.collapsedBranchKeys.filter((k) => validKeys.has(k)),
      };
    }
    return next;
  }, [selectedMonth, segmentBaselinesFingerprint, segmentBaselines]);

  useEffect(() => {
    const loaded = loadOverviewOrderV2(selectedMonth);
    setGroupOrder(normalizeGroupOrder(loaded?.groupOrder));
  }, [selectedMonth, segmentBaselinesFingerprint]);

  useEffect(() => {
    setSegmentState({});
  }, [selectedMonth, segmentBaselinesFingerprint]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = withIncludeVat(
          `/api/dashboard/closing-meeting?tab=cumulative-view${selectedMonth ? `&month=${encodeURIComponent(selectedMonth)}` : ""}`,
          includeVat
        );
        const res = await apiFetch(url);
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data?.sections) {
          setData(json.data);
          if (onMonthsAvailable && json.data.availableMonths && !reportedMonths.current) {
            reportedMonths.current = true;
            onMonthsAvailable(json.data.availableMonths, json.data.currentMonth);
          }
        } else {
          setData(null);
        }
      } catch (e) {
        console.error("Overview cumulative fetch failed", e);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, includeVat, onMonthsAvailable]);

  const mergedForPersist = useMemo(() => {
    if (!segmentBaselines || !hydratedDefaults) return null;
    const segments: OverviewOrderPersistV2["segments"] = {};
    for (const g of OVERVIEW_PRODUCT_GROUPS) {
      const st = segmentState[g.id] ?? hydratedDefaults[g.id];
      if (!st) continue;
      const base = segmentBaselines.get(g.id)?.baseline ?? [];
      const rows = st.orderedTeams.length > 0 || base.length === 0 ? st.orderedTeams : base;
      segments[g.id] = {
        summaryFirst: st.summarySectionFirst,
        teamRowIds: rows.map(teamRowStableId),
        teamsSectionHidden: st.teamsSectionHidden,
        b2cBlockCollapsed: st.b2cBlockCollapsed,
        collapsedBranchKeys: st.collapsedBranches,
      };
    }
    return segments;
  }, [segmentBaselines, hydratedDefaults, segmentState]);

  useEffect(() => {
    if (!selectedMonth || !mergedForPersist) return;
    saveOverviewOrderV2(selectedMonth, { segments: mergedForPersist, groupOrder });
  }, [selectedMonth, mergedForPersist, groupOrder]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const aid = String(active.id);
      const oid = String(over.id);

      const sa = parseOverviewSectionDragId(aid);
      const so = parseOverviewSectionDragId(oid);
      if (sa && so && sa.kind === "summary" && so.kind === "summary" && sa.gid !== so.gid) {
        setGroupOrder((prev) => {
          const fromIdx = prev.indexOf(sa.gid);
          const toIdx = prev.indexOf(so.gid);
          if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
          return arrayMove(prev, fromIdx, toIdx);
        });
        return;
      }
      if (sa && so && sa.gid === so.gid && sa.kind !== so.kind) {
        const gid = sa.gid;
        setSegmentState((prev) => {
          const cur = prev[gid] ?? hydratedDefaults?.[gid];
          if (!cur) return prev;
          return {
            ...prev,
            [gid]: { ...cur, summarySectionFirst: !cur.summarySectionFirst },
          };
        });
        return;
      }

      const pa = parseOverviewTeamSortableId(aid);
      const po = parseOverviewTeamSortableId(oid);
      if (pa && po && pa.gid === po.gid) {
        const gid = pa.gid;
        setSegmentState((prev) => {
          const cur = prev[gid] ?? hydratedDefaults?.[gid];
          const baseB = segmentBaselines?.get(gid)?.baseline ?? [];
          const base = cur?.orderedTeams?.length ? cur.orderedTeams : baseB;
          const oldIndex = base.findIndex((t) => teamRowStableId(t) === pa.stableTeamId);
          const newIndex = base.findIndex((t) => teamRowStableId(t) === po.stableTeamId);
          if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
          if (base[oldIndex]?.channel !== base[newIndex]?.channel) return prev;
          if (!cur) return prev;
          return {
            ...prev,
            [gid]: { ...cur, orderedTeams: arrayMove(base, oldIndex, newIndex) },
          };
        });
      }
    },
    [segmentBaselines, hydratedDefaults]
  );

  const onBranchDragStart = useCallback((e: React.DragEvent, gid: OverviewProductGroupId, branchKey: string) => {
    e.stopPropagation();
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ g: gid, k: branchKey })
    );
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onBranchDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onBranchDrop = useCallback(
    (e: React.DragEvent, gid: OverviewProductGroupId, targetKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      let parsed: { g: OverviewProductGroupId; k: string };
      try {
        parsed = JSON.parse(e.dataTransfer.getData("application/json")) as {
          g: OverviewProductGroupId;
          k: string;
        };
      } catch {
        return;
      }
      if (parsed.g !== gid) return;
      const fromFull = parsed.k;
      if (fromFull === targetKey) return;
      const fromInner =
        parseOverviewBranchBlockKey(fromFull)?.branchKey ?? fromFull;
      const toInner =
        parseOverviewBranchBlockKey(targetKey)?.branchKey ?? targetKey;
      if (fromInner === toInner) return;
      const fromCh = channelFromBranchBlockKey(fromInner);
      const toCh = channelFromBranchBlockKey(toInner);
      if (fromCh && toCh && fromCh !== toCh) return;
      setSegmentState((prev) => {
        const cur = prev[gid] ?? hydratedDefaults?.[gid];
        const baseB = segmentBaselines?.get(gid)?.baseline ?? [];
        const base = cur?.orderedTeams?.length ? cur.orderedTeams : baseB;
        if (!cur) return prev;
        return {
          ...prev,
          [gid]: { ...cur, orderedTeams: reorderBranchBlocks(base, fromInner, toInner) },
        };
      });
    },
    [segmentBaselines, hydratedDefaults]
  );

  useLayoutEffect(() => {
    const r1 = firstHeadRowRef.current;
    const r2 = secondHeadRowRef.current;
    if (!r1 || !r2) return;
    const measure = () => {
      const b1 = r1.getBoundingClientRect();
      const b2 = r2.getBoundingClientRect();
      const subTop = b2.top - b1.top;
      if (subTop > 0) setSubHeaderTopPx(subTop);
    };
    measure();
    requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(r1);
    ro.observe(r2);
    return () => ro.disconnect();
  }, [data, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!data?.sections?.length || !segmentBaselines) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400 p-8">
        <p>개요 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const { yPast3, yPast2, yPast1, yCurrent } = data.yearLabels;
  const salesMetricCls = `${tdNum} bg-violet-100 dark:bg-violet-950/35 font-bold text-zinc-900 dark:text-zinc-100`;
  const salesLabelCls = `${thSub} bg-violet-100 dark:bg-violet-950/35 font-bold`;
  const teamLabelCls = `${thSub} font-normal`;
  const teamBranchCls = `${teamLabelCls} align-middle text-center px-0.5 min-w-0`;
  const teamMetricCls = `${tdNum} bg-zinc-50/90 dark:bg-zinc-900/40`;

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        구분 열의 <GripVertical className="inline h-3 w-3 align-text-bottom" /> 를 드래그해 요약·팀 블록 순서, 지사
        블록, 팀 행 순서를 바꿀 수 있습니다. 품목군별로 동일합니다.
      </p>
      <div className="max-h-[min(75vh,920px)] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full min-w-[1100px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[4.25rem]" />
              <col className="w-[3.35rem]" />
              <col className="min-w-0" />
              <col span={15} />
            </colgroup>
            <thead className="[&_th]:box-border">
              <tr ref={firstHeadRowRef}>
                <th rowSpan={2} colSpan={3} className={thStickyR1}>
                  구분
                </th>
                <th rowSpan={2} className={thStickyR1}>
                  {String(yPast3).slice(2)}년 실적
                </th>
                <th rowSpan={2} className={thStickyR1}>
                  {String(yPast2).slice(2)}년 실적
                </th>
                <th rowSpan={2} className={thStickyR1}>
                  {String(yPast1).slice(2)}년 실적
                </th>
                <th rowSpan={2} className={thStickyR1}>
                  {String(yCurrent).slice(2)}년 계획
                </th>
                <th rowSpan={2} className={thStickyR1}>
                  증감율
                </th>
                <th colSpan={5} className={thStickyR1}>
                  누적
                </th>
                <th colSpan={5} className={thStickyR1}>
                  {data.monthLabel}
                </th>
              </tr>
              <tr ref={secondHeadRowRef}>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  {yPast1}년
                </th>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  목표
                </th>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  {yCurrent}년
                </th>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  달성율
                </th>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  전년대비
                </th>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  {yPast1}년
                </th>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  목표
                </th>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  {yCurrent}년
                </th>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  달성율
                </th>
                <th className={thStickyR2} style={{ top: subHeaderTopPx }}>
                  전년대비
                </th>
              </tr>
            </thead>
            {groupOrder.map((gid) => {
              const g = OVERVIEW_PRODUCT_GROUPS.find((x) => x.id === gid);
              if (!g) return null;
              const sd = segmentBaselines.get(g.id);
              const st = segmentState[g.id] ?? hydratedDefaults?.[g.id];
              if (!sd || !st) return null;
              const hasMetrics = sd.inv && sd.sellin && sd.sales;
              const hasTeams = sd.baseline.length > 0;
              if (!hasMetrics && !hasTeams) return null;

              const displayTeams =
                st.orderedTeams.length > 0 || sd.baseline.length === 0 ? st.orderedTeams : sd.baseline;
              const invRow = sd.inv;
              const sellinRow = sd.sellin;
              const salesRow = sd.sales;
              if (!invRow || !sellinRow || !salesRow) return null;

              const collapsedSet = new Set(st.collapsedBranches);
              const sumId = overviewSectionSummaryId(g.id);
              const teamId = overviewSectionTeamsId(g.id);
              const first = st.summarySectionFirst;

              return (
                <SortableContext
                  key={g.id}
                  items={first ? [sumId, teamId] : [teamId, sumId]}
                  strategy={verticalListSortingStrategy}
                >
                  {first ? (
                    <>
                      <OverviewSummarySection
                        groupLabel={g.groupLabel}
                        sortableSectionId={sumId}
                        invRow={invRow}
                        sellinRow={sellinRow}
                        salesRow={salesRow}
                        salesMetricCls={salesMetricCls}
                        salesLabelCls={salesLabelCls}
                        teamsSectionHidden={st.teamsSectionHidden}
                        onToggleTeamsSection={() =>
                          setSegmentState((p) => {
                            const c = p[g.id] ?? hydratedDefaults?.[g.id];
                            if (!c) return p;
                            return {
                              ...p,
                              [g.id]: { ...c, teamsSectionHidden: !c.teamsSectionHidden },
                            };
                          })
                        }
                        autoColJoinBelow
                      />
                      {st.teamsSectionHidden ? (
                        <OverviewTeamsHiddenPlaceholder
                          sortableSectionTeamsId={teamId}
                          autoColJoinAbove
                        />
                      ) : (
                        <OverviewTeamsSection
                          groupId={g.id}
                          groupLabel={g.groupLabel}
                          sortableSectionTeamsId={teamId}
                          orderedTeams={displayTeams}
                          teamLabelCls={teamLabelCls}
                          teamBranchCls={teamBranchCls}
                          teamMetricCls={teamMetricCls}
                          collapsedBranchKeys={collapsedSet}
                          onToggleBranchCollapse={(bk) =>
                            setSegmentState((p) => {
                              const c = p[g.id] ?? hydratedDefaults?.[g.id];
                              if (!c) return p;
                              const next = c.collapsedBranches.includes(bk)
                                ? c.collapsedBranches.filter((x) => x !== bk)
                                : [...c.collapsedBranches, bk];
                              return { ...p, [g.id]: { ...c, collapsedBranches: next } };
                            })
                          }
                          onBranchDragStart={(e, k) => onBranchDragStart(e, g.id, k)}
                          onBranchDragOver={onBranchDragOver}
                          onBranchDrop={(e, tk) => onBranchDrop(e, g.id, tk)}
                          autoColJoinAbove
                          b2cBlockCollapsed={st.b2cBlockCollapsed}
                          onToggleB2cBlock={() =>
                            setSegmentState((p) => {
                              const c = p[g.id] ?? hydratedDefaults?.[g.id];
                              if (!c) return p;
                              return {
                                ...p,
                                [g.id]: { ...c, b2cBlockCollapsed: !c.b2cBlockCollapsed },
                              };
                            })
                          }
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {st.teamsSectionHidden ? (
                        <OverviewTeamsHiddenPlaceholder
                          sortableSectionTeamsId={teamId}
                          autoColJoinBelow
                        />
                      ) : (
                        <OverviewTeamsSection
                          groupId={g.id}
                          groupLabel={g.groupLabel}
                          sortableSectionTeamsId={teamId}
                          orderedTeams={displayTeams}
                          teamLabelCls={teamLabelCls}
                          teamBranchCls={teamBranchCls}
                          teamMetricCls={teamMetricCls}
                          collapsedBranchKeys={collapsedSet}
                          onToggleBranchCollapse={(bk) =>
                            setSegmentState((p) => {
                              const c = p[g.id] ?? hydratedDefaults?.[g.id];
                              if (!c) return p;
                              const next = c.collapsedBranches.includes(bk)
                                ? c.collapsedBranches.filter((x) => x !== bk)
                                : [...c.collapsedBranches, bk];
                              return { ...p, [g.id]: { ...c, collapsedBranches: next } };
                            })
                          }
                          onBranchDragStart={(e, k) => onBranchDragStart(e, g.id, k)}
                          onBranchDragOver={onBranchDragOver}
                          onBranchDrop={(e, tk) => onBranchDrop(e, g.id, tk)}
                          autoColJoinBelow
                          b2cBlockCollapsed={st.b2cBlockCollapsed}
                          onToggleB2cBlock={() =>
                            setSegmentState((p) => {
                              const c = p[g.id] ?? hydratedDefaults?.[g.id];
                              if (!c) return p;
                              return {
                                ...p,
                                [g.id]: { ...c, b2cBlockCollapsed: !c.b2cBlockCollapsed },
                              };
                            })
                          }
                        />
                      )}
                      <OverviewSummarySection
                        groupLabel={g.groupLabel}
                        sortableSectionId={sumId}
                        invRow={invRow}
                        sellinRow={sellinRow}
                        salesRow={salesRow}
                        salesMetricCls={salesMetricCls}
                        salesLabelCls={salesLabelCls}
                        teamsSectionHidden={st.teamsSectionHidden}
                        onToggleTeamsSection={() =>
                          setSegmentState((p) => {
                            const c = p[g.id] ?? hydratedDefaults?.[g.id];
                            if (!c) return p;
                            return {
                              ...p,
                              [g.id]: { ...c, teamsSectionHidden: !c.teamsSectionHidden },
                            };
                          })
                        }
                        autoColJoinAbove
                      />
                    </>
                  )}
                </SortableContext>
              );
            })}
          </table>
        </DndContext>
      </div>
    </div>
  );
}
