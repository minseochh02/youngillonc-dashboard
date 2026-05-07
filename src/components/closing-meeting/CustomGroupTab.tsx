"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronRight, GripVertical, Loader2, RotateCw } from "lucide-react";
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
  applySavedTeamOrder,
  channelFromBranchBlockKey,
  normalizeOverviewBranchLabel,
  overviewBranchBlockKey,
  parseOverviewBranchBlockKey,
  reorderBranchBlocks,
  rowsToBranchBlocks,
  teamRowStableId,
} from "@/lib/overview-team-order";

interface CustomGroupTabProps {
  selectedMonth: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}


const SEGMENT_ID = "custom";
const SUM_ID = "custom:section:summary";
const b2cTeamsId = "custom:section:teams-b2c";
const b2bTeamsId = "custom:section:teams-b2b";

function teamsId(ch: "b2c" | "b2b"): string {
  return ch === "b2c" ? b2cTeamsId : b2bTeamsId;
}

function parseSectionId(
  id: string
): { kind: "summary" } | { kind: "teams"; channel: "b2c" | "b2b" } | null {
  if (id === SUM_ID) return { kind: "summary" };
  if (id === b2cTeamsId) return { kind: "teams", channel: "b2c" };
  if (id === b2bTeamsId) return { kind: "teams", channel: "b2b" };
  return null;
}

function customTeamSortableId(stableId: string): string {
  return JSON.stringify(["cv", stableId]);
}

function parseCustomTeamSortableId(id: string): string | null {
  try {
    const j = JSON.parse(id) as unknown;
    if (!Array.isArray(j) || j.length !== 2 || j[0] !== "cv" || typeof j[1] !== "string")
      return null;
    return j[1];
  } catch {
    return null;
  }
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
const thCatProduct = `${thCat} w-[4.25rem] max-w-[4.25rem] min-w-0 px-1 py-2 text-[10px] leading-snug whitespace-normal break-words [overflow-wrap:anywhere] align-middle`;
const autoColJoinAboveCls = "border-t-0";
const autoColJoinBelowCls = "border-b-0";
const rowInvCell = `${tdNum} bg-[#fce4d6] dark:bg-amber-950/35`;
const rowInvSub = `${thSub} bg-[#fce4d6] dark:bg-amber-950/35`;
const dragHandleBtn =
  "inline-flex shrink-0 cursor-grab touch-none rounded border border-zinc-300 bg-zinc-100/90 p-0.5 text-zinc-500 hover:bg-zinc-200 active:cursor-grabbing dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700";
const b2cBlockToggleBtn =
  "inline-flex shrink-0 items-center rounded border border-violet-400/50 bg-white/80 p-0.5 text-violet-700 hover:bg-violet-50 dark:border-violet-600 dark:bg-zinc-900/80 dark:text-violet-300 dark:hover:bg-zinc-800";

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

function CustomSummarySection({
  groupLabel,
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
  invRow: CumulativeMetricBlock;
  sellinRow: CumulativeMetricBlock;
  salesRow: CumulativeMetricBlock;
  salesMetricCls: string;
  salesLabelCls: string;
  teamsSectionHidden: boolean;
  onToggleTeamsSection: () => void;
  autoColJoinAbove?: boolean;
  autoColJoinBelow?: boolean;
}) {
  const sortable = useSortable({ id: SUM_ID });

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
              title="드래그: 요약/팀 순서 이동"
              {...sortable.listeners}
              {...sortable.attributes}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <span className="block w-full min-w-0">{groupLabel}</span>
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
              <strong>판매량</strong>
            </span>
          </span>
        </th>
        <MetricCells block={salesRow} tdClass={salesMetricCls} />
      </tr>
    </tbody>
  );
}

function CustomTeamsHiddenPlaceholder({
  channel,
  autoColJoinAbove,
  autoColJoinBelow,
}: {
  channel: "b2c" | "b2b";
  autoColJoinAbove?: boolean;
  autoColJoinBelow?: boolean;
}) {
  const sectionSortable = useSortable({ id: teamsId(channel) });
  const label = channel === "b2c" ? "B2C 지사·팀 표 숨김" : "B2B 지사·팀 표 숨김";
  return (
    <tbody
      ref={sectionSortable.setNodeRef}
      style={{ opacity: sectionSortable.isDragging ? 0.55 : undefined }}
    >
      <tr>
        <th
          className={`${thCatProduct}${autoColJoinAbove ? ` ${autoColJoinAboveCls}` : ""}${autoColJoinBelow ? ` ${autoColJoinBelowCls}` : ""}`}
          aria-hidden
        >
          <span className="flex flex-col items-center gap-1">
            <button
              type="button"
              className={dragHandleBtn}
              aria-label="요약 블록과 팀 블록 순서 바꾸기"
              {...sectionSortable.listeners}
              {...sectionSortable.attributes}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </span>
        </th>
        <th colSpan={2} className={`${thSub} text-left text-zinc-500 dark:text-zinc-400`}>
          <span className="px-1 text-[10px]">{label}</span>
        </th>
        <td colSpan={15} className={`${tdNum} text-center text-zinc-500 dark:text-zinc-400`}>
          위 &ldquo;판매량&rdquo; 줄의 ◀ 버튼으로 다시 표시할 수 있습니다.
        </td>
      </tr>
    </tbody>
  );
}

function CustomChannelTeamsSection({
  channel,
  orderedTeams,
  viewMode,
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
  channelCollapsed,
  onToggleChannelCollapsed,
}: {
  channel: "b2c" | "b2b";
  orderedTeams: TeamSalesBreakdownRow[];
  viewMode: 'weight' | 'amount';
  teamLabelCls: string;
  teamBranchCls: string;
  teamMetricCls: string;
  collapsedBranchKeys: ReadonlySet<string>;
  onToggleBranchCollapse: (branchKey: string) => void;
  onBranchDragStart: (e: React.DragEvent, key: string) => void;
  onBranchDragOver: (e: React.DragEvent) => void;
  onBranchDrop: (e: React.DragEvent, targetKey: string) => void;
  autoColJoinAbove?: boolean;
  autoColJoinBelow?: boolean;
  channelCollapsed: boolean;
  onToggleChannelCollapsed: () => void;
}) {
  const sectionSortable = useSortable({ id: teamsId(channel) });

  const channelRows = useMemo(
    () => orderedTeams.filter((t) => t.channel === channel),
    [orderedTeams, channel]
  );

  const channelBranchBlocks = useMemo(() => {
    const blocks = rowsToBranchBlocks(channelRows);
    return blocks.map((b) => ({
      ...b,
      fullKey: overviewBranchBlockKey(SEGMENT_ID, b.rows[0]!),
      metrics: mergeMetricBlocks(b.rows.map((r) => r.metrics))!,
      amountMetrics: mergeMetricBlocks(b.rows.map((r) => r.amountMetrics ?? r.metrics)),
    }));
  }, [channelRows]);

  const channelTotalVisibleRows = useMemo(() => {
    let count = 0;
    for (const bb of channelBranchBlocks) {
      const hasMultipleTeams = bb.rows.length > 1;
      if (hasMultipleTeams && collapsedBranchKeys.has(bb.fullKey)) {
        count += 1;
      } else {
        count += bb.rows.length + (hasMultipleTeams ? 1 : 0);
      }
    }
    return Math.max(1, count);
  }, [channelBranchBlocks, collapsedBranchKeys]);

  const sortableTeamIds = useMemo(() => {
    if (channelCollapsed) return [];
    return channelRows.map((t) => customTeamSortableId(teamRowStableId(t)));
  }, [channelCollapsed, channelRows]);

  const b2cTotalLabelCls = `${thSub} bg-violet-50/80 font-semibold dark:bg-violet-950/25`;

  if (channelRows.length === 0) return null;

  return (
    <tbody
      ref={sectionSortable.setNodeRef}
      style={{ opacity: sectionSortable.isDragging ? 0.55 : undefined }}
    >
      <SortableContext items={sortableTeamIds} strategy={verticalListSortingStrategy}>
        {(() => {
          const joinTop = autoColJoinAbove;
          const joinBot = autoColJoinBelow;

          if (channelCollapsed && channelRows.length > 0) {
            const merged = viewMode === 'amount'
              ? mergeMetricBlocks(channelRows.map((r) => r.amountMetrics ?? r.metrics))
              : mergeMetricBlocks(channelRows.map((r) => r.metrics));
            if (!merged) return null;
            const totalLabel = channel === "b2c" ? "B2C 합계" : "B2B 합계";
            return (
              <tr key={`cv-${channel}-block-total`}>
                <th
                  className={`${thCatProduct}${joinTop ? ` ${autoColJoinAboveCls}` : ""}${joinBot ? ` ${autoColJoinBelowCls}` : ""}`}
                >
                  <span className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      className={dragHandleBtn}
                      aria-label="요약 블록과 팀 블록 순서 바꾸기"
                      {...sectionSortable.listeners}
                      {...sectionSortable.attributes}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <span className="flex w-full min-w-0 flex-col items-center gap-0.5">
                      <button
                        type="button"
                        onClick={onToggleChannelCollapsed}
                        className={b2cBlockToggleBtn}
                        aria-expanded={false}
                        title={`${channel.toUpperCase()} 지사·팀 펼치기`}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </span>
                </th>
                <th colSpan={2} className={b2cTotalLabelCls}>
                  {totalLabel}
                </th>
                <MetricCells block={merged} tdClass={teamMetricCls} />
              </tr>
            );
          }

          let renderedRowCount = 0;
          return channelBranchBlocks.flatMap((bb, bbi) => {
            const hasMultipleTeams = bb.rows.length > 1;
            const branchCollapsed = hasMultipleTeams && collapsedBranchKeys.has(bb.fullKey);
            const branchSpan = branchCollapsed ? 1 : bb.rows.length + (hasMultipleTeams ? 1 : 0);
            const isFirstBlockInChannel = bbi === 0;

            const rows: ReactNode[] = [];

            if (!branchCollapsed) {
              bb.rows.forEach((tr, tri) => {
                const sid = customTeamSortableId(teamRowStableId(tr));
                const isFirstRowInBranch = tri === 0;
                const isFirstRowInChannel = isFirstBlockInChannel && isFirstRowInBranch;

                const autoColCell = isFirstRowInChannel ? (
                  <th
                    rowSpan={channelTotalVisibleRows}
                    className={`${thCatProduct}${joinTop ? ` ${autoColJoinAboveCls}` : ""}${joinBot ? ` ${autoColJoinBelowCls}` : ""}`}
                  >
                    <span className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        className={dragHandleBtn}
                        aria-label="요약 블록과 팀 블록 순서 바꾸기"
                        {...sectionSortable.listeners}
                        {...sectionSortable.attributes}
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex w-full min-w-0 flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={onToggleChannelCollapsed}
                          className={b2cBlockToggleBtn}
                          aria-expanded
                          title={`${channel.toUpperCase()} 합계만 보기`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </span>
                  </th>
                ) : null;

                const branchCell = isFirstRowInBranch ? (
                  <th
                    className={
                      hasMultipleTeams
                        ? `${teamBranchCls} bg-orange-100/60 dark:bg-orange-900/30`
                        : teamBranchCls
                    }
                    rowSpan={branchSpan}
                    onDragOver={onBranchDragOver}
                    onDrop={(e) => onBranchDrop(e, bb.fullKey)}
                  >
                    <span className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5">
                      <span className="flex items-center gap-0.5">
                        {hasMultipleTeams && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleBranchCollapse(bb.fullKey);
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
                        )}
                        <span
                          className={`${dragHandleBtn} mb-0.5`}
                          draggable
                          onDragStart={(e) => onBranchDragStart(e, bb.fullKey)}
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
                ) : null;

                rows.push(
                  <SortableTeamRow key={sid} id={sid}>
                    {({ setActivatorNodeRef, listeners }) => (
                      <>
                        {autoColCell}
                        {branchCell}
                        <th className={teamLabelCls}>
                          <span className="flex items-start justify-start gap-1 pl-0.5 text-left">
                            <button
                              type="button"
                              ref={setActivatorNodeRef}
                              className={`${dragHandleBtn} mt-0.5`}
                              aria-label="팀 행 이동"
                              {...listeners}
                            >
                              <GripVertical className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-0 flex-1 pt-0.5">
                              {teamOnlyFromLabel(tr.team)}
                            </span>
                          </span>
                        </th>
                        <MetricCells block={viewMode === 'amount' ? (tr.amountMetrics ?? tr.metrics) : tr.metrics} tdClass={teamMetricCls} />
                      </>
                    )}
                  </SortableTeamRow>
                );
                renderedRowCount++;
              });
            }

            if (hasMultipleTeams) {
              const subtotalSid = `subtotal:${bb.fullKey}:${bbi}`;
              const isFirstRowInChannel = isFirstBlockInChannel && branchCollapsed;

              const subtotalBg = "bg-orange-100/60 dark:bg-orange-900/30";
              const subtotalLabelCls = `${teamLabelCls} bg-orange-100/60 dark:bg-orange-900/30 font-bold`;
              const subtotalMetricCls = `${tdNum} bg-orange-100/40 dark:bg-orange-950/20 font-bold`;
              const subtotalBranchCls = `${teamBranchCls} bg-orange-100/60 dark:bg-orange-900/30`;

              const autoColCell = isFirstRowInChannel ? (
                <th
                  rowSpan={channelTotalVisibleRows}
                  className={`${thCatProduct}${joinTop ? ` ${autoColJoinAboveCls}` : ""}${joinBot ? ` ${autoColJoinBelowCls}` : ""}`}
                >
                  <span className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      className={dragHandleBtn}
                      aria-label="요약 블록과 팀 블록 순서 바꾸기"
                      {...sectionSortable.listeners}
                      {...sectionSortable.attributes}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <span className="flex w-full min-w-0 flex-col items-center gap-0.5">
                      <button
                        type="button"
                        onClick={onToggleChannelCollapsed}
                        className={b2cBlockToggleBtn}
                        aria-expanded
                        title={`${channel.toUpperCase()} 합계만 보기`}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </span>
                </th>
              ) : null;

              const branchCell = branchCollapsed ? (
                <th
                  className={subtotalBranchCls}
                  rowSpan={1}
                  onDragOver={onBranchDragOver}
                  onDrop={(e) => onBranchDrop(e, bb.fullKey)}
                >
                  <span className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5">
                    <span className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBranchCollapse(bb.fullKey);
                        }}
                        className="inline-flex shrink-0 items-center rounded border border-zinc-400/60 bg-white/90 p-0.5 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        aria-expanded={false}
                        title="지사 팀 펼치기"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      <span
                        className={`${dragHandleBtn} mb-0.5`}
                        draggable
                        onDragStart={(e) => onBranchDragStart(e, bb.fullKey)}
                        aria-label={`${normalizeOverviewBranchLabel(bb.rows[0]!)} 지사 블록 이동`}
                      >
                        <GripVertical className="h-3 w-3" />
                      </span>
                    </span>
                    <span className="w-full break-words text-center text-[10px] font-medium leading-tight [overflow-wrap:anywhere]">
                      {normalizeOverviewBranchLabel(bb.rows[0]!)}
                    </span>
                  </span>
                </th>
              ) : null;

              rows.push(
                <tr key={subtotalSid} className={subtotalBg}>
                  {autoColCell}
                  {branchCell}
                  <th className={subtotalLabelCls}>
                    <span className="flex items-center justify-start gap-1 pl-1.5 text-left h-full min-h-[32px]">
                      소계
                      {bb.rows.length > 1 && !branchCollapsed && (
                        <span className="font-normal text-[10px] text-zinc-500">
                          ({bb.rows.length}팀)
                        </span>
                      )}
                    </span>
                  </th>
                  <MetricCells block={viewMode === 'amount' ? (bb.amountMetrics ?? bb.metrics) : bb.metrics} tdClass={subtotalMetricCls} />
                </tr>
              );
            }

            return rows;
          });
        })()}
      </SortableContext>
    </tbody>
  );
}

// ── Per-filter order persistence ──────────────────────────────────────────
const CG_LS_PREFIX = "closing-custom-group-v1";

type CustomGroupOrderEntry = {
  teamRowIds: string[];
  collapsedBranches: string[];
};

function buildFilterKey(month: string): string {
  return `${CG_LS_PREFIX}:${month}`;
}

function loadCustomGroupOrder(key: string): CustomGroupOrderEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CustomGroupOrderEntry;
  } catch {
    return null;
  }
}

function saveCustomGroupOrder(key: string, entry: CustomGroupOrderEntry): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch { /* ignore quota */ }
}

const G3_LABELS: Record<string, string> = { STA: "Standard", PRE: "Premium", FLA: "Flagship", ALL: "Alliance" };
function g3DisplayLabel(v: string): string {
  return G3_LABELS[v] ?? v;
}

export default function CustomGroupTab({ selectedMonth, onMonthsAvailable }: CustomGroupTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<CumulativeViewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedGroup3, setSelectedGroup3] = useState<Set<string>>(new Set());
  const [selectedClientGroup2, setSelectedClientGroup2] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'weight' | 'amount'>('weight');
  const [orderedTeams, setOrderedTeams] = useState<TeamSalesBreakdownRow[]>([]);
  const [sectionOrder, setSectionOrder] = useState<("summary" | "b2c" | "b2b")[]>([
    "summary",
    "b2c",
    "b2b",
  ]);
  const [teamsSectionHidden, setTeamsSectionHidden] = useState(false);
  const [b2cCollapsed, setB2cCollapsed] = useState(false);
  const [b2bCollapsed, setB2bCollapsed] = useState(false);
  const [collapsedBranches, setCollapsedBranches] = useState<string[]>([]);
  const [subHeaderTopPx, setSubHeaderTopPx] = useState(40);
  const cacheRef = useRef<Map<string, CumulativeViewPayload>>(new Map());
  const reportedMonths = useRef(false);
  const firstHeadRowRef = useRef<HTMLTableRowElement>(null);
  const secondHeadRowRef = useRef<HTMLTableRowElement>(null);

  // Single global key for this tab — persists across months and filter combos
  const filterKey = useMemo(() => buildFilterKey("global"), []);
  // Refs so drag callbacks (memoized with []) can always read current values
  const filterKeyRef = useRef(filterKey);
  const orderedTeamsRef = useRef<TeamSalesBreakdownRow[]>([]);
  const collapsedBranchesRef = useRef<string[]>([]);
  useEffect(() => { filterKeyRef.current = filterKey; }, [filterKey]);
  useEffect(() => { orderedTeamsRef.current = orderedTeams; }, [orderedTeams]);
  useEffect(() => { collapsedBranchesRef.current = collapsedBranches; }, [collapsedBranches]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      try {
        const cacheKey = `${selectedMonth}:${includeVat}`;
        if (!forceRefresh && cacheRef.current.has(cacheKey)) {
          setData(cacheRef.current.get(cacheKey)!);
          setLoading(false);
          return;
        }
        const url = withIncludeVat(
          `/api/dashboard/closing-meeting?tab=custom-group${selectedMonth ? `&month=${encodeURIComponent(selectedMonth)}` : ""}`,
          includeVat
        );
        const res = await apiFetch(url);
        const json = await res.json();
        if (json.success && json.data?.sections) {
          setData(json.data);
          cacheRef.current.set(cacheKey, json.data);
          if (onMonthsAvailable && json.data.availableMonths && !reportedMonths.current) {
            reportedMonths.current = true;
            onMonthsAvailable(json.data.availableMonths, json.data.currentMonth);
          }
        } else {
          setData(null);
        }
      } catch (e) {
        console.error("CustomGroup cumulative fetch failed", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [selectedMonth, includeVat, onMonthsAvailable]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Use the distinct codes fetched directly from the items table (raw, no '기타' mapping)
  const availableCategories = useMemo(
    () => data?.availableGroup1Codes ?? [],
    [data?.availableGroup1Codes]
  );

  // Use the distinct codes fetched directly from the items table
  const availableGroup3Values = useMemo(
    () => data?.availableGroup3Codes ?? [],
    [data?.availableGroup3Codes]
  );

  const availableClientGroup2Values = useMemo(
    () => data?.availableClientGroup2Codes ?? [],
    [data?.availableClientGroup2Codes]
  );

  // Auto-select all categories when data first loads (or month changes)
  const initializedRef = useRef<string>("");
  useEffect(() => {
    if (availableCategories.length === 0) return;
    const key = availableCategories.join(",");
    if (initializedRef.current === key) return;
    initializedRef.current = key;
    setSelectedCats(new Set(availableCategories));
  }, [availableCategories]);

  // Auto-select all group3 values when data first loads
  const initializedG3Ref = useRef<string | null>(null);
  useEffect(() => {
    if (availableGroup3Values.length === 0) return;
    const key = availableGroup3Values.join("\0");
    if (initializedG3Ref.current === key) return;
    initializedG3Ref.current = key;
    setSelectedGroup3(new Set(availableGroup3Values));
  }, [availableGroup3Values]);

  // Auto-select all clientGroup2 values when data first loads
  const initializedCg2Ref = useRef<string | null>(null);
  useEffect(() => {
    if (availableClientGroup2Values.length === 0) return;
    const key = availableClientGroup2Values.join("\0");
    if (initializedCg2Ref.current === key) return;
    initializedCg2Ref.current = key;
    setSelectedClientGroup2(new Set(availableClientGroup2Values));
  }, [availableClientGroup2Values]);

  // Filter sections by selectedCats AND selectedGroup3 AND selectedClientGroup2 (AND logic)
  // Sections with no code for a dimension are included only when ALL codes for that dimension are selected
  const filteredSections = useMemo(() => {
    if (!data?.sections) return [];
    return data.sections.filter((s) => {
      if (selectedGroup3.size > 0) {
        const code = s.group3 ?? "";
        if (code === "") {
          if (selectedGroup3.size !== availableGroup3Values.length) return false;
        } else if (!selectedGroup3.has(code)) return false;
      }
      if (selectedClientGroup2.size > 0) {
        const code = s.clientGroup2 ?? "";
        if (code === "") {
          if (selectedClientGroup2.size !== availableClientGroup2Values.length) return false;
        } else if (!selectedClientGroup2.has(code)) return false;
      }
      return true;
    });
  }, [data?.sections, selectedGroup3, availableGroup3Values.length, selectedClientGroup2, availableClientGroup2Values.length]);

  // Recompute baseline teams when data or selectedCats or selectedGroup3 or selectedClientGroup2 change
  const baseline = useMemo(() => {
    if (!filteredSections.length || selectedCats.size === 0) return [];
    return aggregateTeamSalesBreakdownAcrossCategories(
      filteredSections,
      new Set<string>(selectedCats)
    );
  }, [filteredSections, selectedCats]);

  // When filter changes, apply saved order if available; otherwise use baseline as-is
  useEffect(() => {
    const saved = loadCustomGroupOrder(filterKeyRef.current);
    setOrderedTeams(applySavedTeamOrder(baseline, saved?.teamRowIds ?? null));
    setCollapsedBranches(saved?.collapsedBranches ?? []);
  }, [baseline]);

  const aggMetrics = useMemo(() => {
    if (!filteredSections.length || selectedCats.size === 0) return null;
    const cats = new Set<string>(selectedCats);
    return {
      inv: aggregateSectionRowsOfKind(filteredSections, cats, "inventory"),
      sellin: aggregateSectionRowsOfKind(filteredSections, cats, "sellin"),
      sales: aggregateSectionRowsOfKind(filteredSections, cats, "total"),
    };
  }, [filteredSections, selectedCats]);

  const aggAmountMetrics = useMemo(() => {
    if (!filteredSections.length || selectedCats.size === 0) return null;
    const aggregate = (rowKind: "inventory" | "sellin" | "total") => {
      const blocks: CumulativeMetricBlock[] = [];
      for (const sec of filteredSections) {
        if (!selectedCats.has(sec.category)) continue;
        for (const row of sec.rows) {
          if (row.rowKind === rowKind && row.amountMetrics) blocks.push(row.amountMetrics);
        }
      }
      return mergeMetricBlocks(blocks);
    };
    return { inv: aggregate("inventory"), sellin: aggregate("sellin"), sales: aggregate("total") };
  }, [filteredSections, selectedCats]);

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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const aid = String(active.id);
      const oid = String(over.id);
      if (aid === oid) return;

      // Section reorder (summary ↔ b2c ↔ b2b)
      const sa = parseSectionId(aid);
      const so = parseSectionId(oid);
      if (sa && so) {
        const getKey = (s: typeof sa): "summary" | "b2c" | "b2b" =>
          s.kind === "summary" ? "summary" : s.channel;
        const fromKey = getKey(sa);
        const toKey = getKey(so);
        if (fromKey !== toKey) {
          setSectionOrder((prev) => {
            const fromIdx = prev.indexOf(fromKey);
            const toIdx = prev.indexOf(toKey);
            if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
            return arrayMove(prev, fromIdx, toIdx);
          });
        }
        return;
      }

      // Team row reorder
      const pa = parseCustomTeamSortableId(aid);
      const po = parseCustomTeamSortableId(oid);
      if (pa && po && pa !== po) {
        setOrderedTeams((prev) => {
          const oldIndex = prev.findIndex((t) => teamRowStableId(t) === pa);
          const newIndex = prev.findIndex((t) => teamRowStableId(t) === po);
          if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
          if (prev[oldIndex]?.channel !== prev[newIndex]?.channel) return prev;
          const next = arrayMove(prev, oldIndex, newIndex);
          saveCustomGroupOrder(filterKeyRef.current, {
            teamRowIds: next.map(teamRowStableId),
            collapsedBranches: collapsedBranchesRef.current,
          });
          return next;
        });
      }
    },
    []
  );

  const onBranchDragStart = useCallback((e: React.DragEvent, branchKey: string) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/json", JSON.stringify({ k: branchKey }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onBranchDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onBranchDrop = useCallback((e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    let parsed: { k: string };
    try {
      parsed = JSON.parse(e.dataTransfer.getData("application/json")) as { k: string };
    } catch {
      return;
    }
    const fromFull = parsed.k;
    if (fromFull === targetKey) return;
    const fromInner = parseOverviewBranchBlockKey(fromFull)?.branchKey ?? fromFull;
    const toInner = parseOverviewBranchBlockKey(targetKey)?.branchKey ?? targetKey;
    if (fromInner === toInner) return;
    const fromCh = channelFromBranchBlockKey(fromInner);
    const toCh = channelFromBranchBlockKey(toInner);
    if (fromCh && toCh && fromCh !== toCh) return;
    setOrderedTeams((prev) => {
      const next = reorderBranchBlocks(prev, fromInner, toInner);
      if (next !== prev) {
        saveCustomGroupOrder(filterKeyRef.current, {
          teamRowIds: next.map(teamRowStableId),
          collapsedBranches: collapsedBranchesRef.current,
        });
      }
      return next;
    });
  }, []);

  const toggleBranchCollapse = useCallback((bk: string) => {
    setCollapsedBranches((prev) => {
      const next = prev.includes(bk) ? prev.filter((x) => x !== bk) : [...prev, bk];
      saveCustomGroupOrder(filterKeyRef.current, {
        teamRowIds: orderedTeamsRef.current.map(teamRowStableId),
        collapsedBranches: next,
      });
      return next;
    });
  }, []);

  const toggleCat = useCallback((cat: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const groupLabel = useMemo(() => {
    if (selectedCats.size === 0) return "없음";
    if (availableCategories.length > 0 && selectedCats.size === availableCategories.length) return "전체";
    return availableCategories.filter((c) => selectedCats.has(c)).join(" + ");
  }, [selectedCats, availableCategories]);

  const collapsedSet = useMemo(() => new Set(collapsedBranches), [collapsedBranches]);

  const sectionItems = sectionOrder.map((s) =>
    s === "summary" ? SUM_ID : teamsId(s)
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!data?.sections?.length) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400 p-8">
        <p>데이터를 불러올 수 없습니다.</p>
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
      {/* Category selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium shrink-0">품목 선택:</span>
        {availableCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCat(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              selectedCats.has(cat)
                ? "bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500"
                : "bg-white border-zinc-300 text-zinc-500 hover:border-zinc-400 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
            }`}
          >
            {cat}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={() => setSelectedCats(new Set(availableCategories))}
            className="px-2 py-1 rounded text-xs border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={() => setSelectedCats(new Set())}
            className="px-2 py-1 rounded text-xs border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
          >
            전체 해제
          </button>
        </div>
      </div>

      {/* 품목그룹3 selector */}
      {availableGroup3Values.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium shrink-0">등급 선택:</span>
          {availableGroup3Values.map((g3) => (
            <button
              key={g3 || "__empty__"}
              type="button"
              onClick={() => {
                setSelectedGroup3((prev) => {
                  const next = new Set(prev);
                  if (next.has(g3)) next.delete(g3);
                  else next.add(g3);
                  return next;
                });
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedGroup3.has(g3)
                  ? "bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-500 dark:border-emerald-500"
                  : "bg-white border-zinc-300 text-zinc-500 hover:border-zinc-400 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}
            >
              {g3DisplayLabel(g3)}
            </button>
          ))}
          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => setSelectedGroup3(new Set(availableGroup3Values))}
              className="px-2 py-1 rounded text-xs border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup3(new Set())}
              className="px-2 py-1 rounded text-xs border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
            >
              전체 해제
            </button>
          </div>
        </div>
      )}

      {/* 거래처그룹2 selector */}
      {availableClientGroup2Values.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium shrink-0">거래처그룹2 선택:</span>
          {availableClientGroup2Values.map((cg2) => (
            <button
              key={cg2 || "__empty__"}
              type="button"
              onClick={() => {
                setSelectedClientGroup2((prev) => {
                  const next = new Set(prev);
                  if (next.has(cg2)) next.delete(cg2);
                  else next.add(cg2);
                  return next;
                });
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedClientGroup2.has(cg2)
                  ? "bg-sky-600 border-sky-600 text-white dark:bg-sky-500 dark:border-sky-500"
                  : "bg-white border-zinc-300 text-zinc-500 hover:border-zinc-400 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}
            >
              {cg2 || "(없음)"}
            </button>
          ))}
          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => setSelectedClientGroup2(new Set(availableClientGroup2Values))}
              className="px-2 py-1 rounded text-xs border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={() => setSelectedClientGroup2(new Set())}
              className="px-2 py-1 rounded text-xs border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
            >
              전체 해제
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          구분 열의 <GripVertical className="inline h-3 w-3 align-text-bottom" /> 를 드래그해 요약·팀
          블록 순서, 지사 블록, 팀 행 순서를 바꿀 수 있습니다.
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('weight')}
              className={`px-3 py-1.5 transition-colors ${
                viewMode === 'weight'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              중량
            </button>
            <button
              type="button"
              onClick={() => setViewMode('amount')}
              className={`px-3 py-1.5 transition-colors border-l border-zinc-200 dark:border-zinc-700 ${
                viewMode === 'amount'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              공급가
            </button>
          </div>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            데이터 새로고침
          </button>
        </div>
      </div>

      {selectedCats.size === 0 ? (
        <div className="text-center text-zinc-500 dark:text-zinc-400 p-8 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <p>품목을 하나 이상 선택해 주세요.</p>
        </div>
      ) : selectedGroup3.size === 0 ? (
        <div className="text-center text-zinc-500 dark:text-zinc-400 p-8 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <p>등급을 하나 이상 선택해 주세요.</p>
        </div>
      ) : selectedClientGroup2.size === 0 && availableClientGroup2Values.length > 0 ? (
        <div className="text-center text-zinc-500 dark:text-zinc-400 p-8 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <p>거래처그룹2를 하나 이상 선택해 주세요.</p>
        </div>
      ) : !aggMetrics?.inv || !aggMetrics?.sellin || !aggMetrics?.sales ? (
        <div className="text-center text-zinc-500 dark:text-zinc-400 p-8 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <p>선택한 품목의 데이터가 없습니다.</p>
        </div>
      ) : (
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
              <SortableContext items={sectionItems} strategy={verticalListSortingStrategy}>
                {sectionOrder.map((sectionType, sIdx) => {
                  const isFirst = sIdx === 0;
                  const isLast = sIdx === sectionOrder.length - 1;
                  const autoJoinAbove = !isFirst;
                  const autoJoinBelow = !isLast;

                  if (sectionType === "summary") {
                    const displayMetrics = viewMode === 'amount' && aggAmountMetrics ? aggAmountMetrics : aggMetrics;
                    return (
                      <CustomSummarySection
                        key={SUM_ID}
                        groupLabel={groupLabel}
                        invRow={displayMetrics.inv!}
                        sellinRow={displayMetrics.sellin!}
                        salesRow={displayMetrics.sales!}
                        salesMetricCls={salesMetricCls}
                        salesLabelCls={salesLabelCls}
                        teamsSectionHidden={teamsSectionHidden}
                        onToggleTeamsSection={() => setTeamsSectionHidden((v) => !v)}
                        autoColJoinAbove={autoJoinAbove}
                        autoColJoinBelow={autoJoinBelow}
                      />
                    );
                  }

                  const channel = sectionType as "b2c" | "b2b";
                  const tid = teamsId(channel);

                  if (teamsSectionHidden) {
                    return (
                      <CustomTeamsHiddenPlaceholder
                        key={tid}
                        channel={channel}
                        autoColJoinAbove={autoJoinAbove}
                        autoColJoinBelow={autoJoinBelow}
                      />
                    );
                  }

                  return (
                    <CustomChannelTeamsSection
                      key={tid}
                      channel={channel}
                      orderedTeams={orderedTeams}
                      viewMode={viewMode}
                      teamLabelCls={teamLabelCls}
                      teamBranchCls={teamBranchCls}
                      teamMetricCls={teamMetricCls}
                      collapsedBranchKeys={collapsedSet}
                      onToggleBranchCollapse={toggleBranchCollapse}
                      onBranchDragStart={onBranchDragStart}
                      onBranchDragOver={onBranchDragOver}
                      onBranchDrop={onBranchDrop}
                      autoColJoinAbove={autoJoinAbove}
                      autoColJoinBelow={autoJoinBelow}
                      channelCollapsed={channel === "b2c" ? b2cCollapsed : b2bCollapsed}
                      onToggleChannelCollapsed={() => {
                        if (channel === "b2c") setB2cCollapsed((v) => !v);
                        else setB2bCollapsed((v) => !v);
                      }}
                    />
                  );
                })}
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}
    </div>
  );
}
