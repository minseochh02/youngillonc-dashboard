"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { useVatInclude } from "@/contexts/VatIncludeContext";
import { apiFetch } from "@/lib/api";
import { withIncludeVat } from "@/lib/vat-query";
import type { CumulativeMetricBlock, CumulativeViewPayload } from "@/lib/closing-meeting-cumulative";

interface Props {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

function formatInt(n: number) {
  if (Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("ko-KR");
}

function formatRate(r: number) {
  if (Number.isNaN(r) || !Number.isFinite(r)) return "—";
  return `${(r * 100).toFixed(1)}%`;
}

const thBase =
  "border border-zinc-900 dark:border-zinc-600 px-2 py-2 text-center text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-[#d9e1f2] dark:bg-zinc-700 align-middle";
/** Sticky: first header row (구분·연도·누적/월 상위) */
const thStickyR1 = `${thBase} sticky top-0 z-[32]`;
/** Second header row: `style.top` = measured height of first row (px) */
const thStickyR2 = `${thBase} sticky z-[28]`;
const tdNum =
  "border border-zinc-900 dark:border-zinc-600 px-2 py-1.5 text-right text-xs tabular-nums text-zinc-800 dark:text-zinc-200";
const thSub =
  "border border-zinc-900 dark:border-zinc-600 px-2 py-1.5 text-center text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900";
const thCat =
  "border border-zinc-900 dark:border-zinc-600 px-2 py-1.5 text-center text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800";

/** Sum B2C + B2B “합계” rows per category, then recompute rates (전체 매출 요약). */
function aggregateB2cB2bTotals(sections: CumulativeViewPayload["sections"]): CumulativeMetricBlock | null {
  const blocks: CumulativeMetricBlock[] = [];
  for (const sec of sections) {
    for (const row of sec.rows) {
      if (row.rowKind === "total" || row.rowKind === "b2b_total") blocks.push(row.metrics);
    }
  }
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

export default function CumulativeViewTab({ selectedMonth, onMonthsAvailable }: Props) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<CumulativeViewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [subHeaderTopPx, setSubHeaderTopPx] = useState(40);
  const [grandStickyTopPx, setGrandStickyTopPx] = useState(80);
  const reportedMonths = useRef(false);
  const firstHeadRowRef = useRef<HTMLTableRowElement>(null);
  const secondHeadRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = withIncludeVat(
          `/api/dashboard/closing-meeting?tab=cumulative-view${selectedMonth ? `&month=${selectedMonth}` : ""}`,
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
        console.error("Cumulative view fetch failed", e);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, includeVat, onMonthsAvailable]);

  useLayoutEffect(() => {
    const r1 = firstHeadRowRef.current;
    const r2 = secondHeadRowRef.current;
    if (!r1 || !r2) return;
    const measure = () => {
      const b1 = r1.getBoundingClientRect();
      const b2 = r2.getBoundingClientRect();
      const subTop = b2.top - b1.top;
      const grandTop = b2.bottom - b1.top;
      if (subTop > 0) setSubHeaderTopPx(subTop);
      if (grandTop > 0) setGrandStickyTopPx(grandTop);
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

  if (!data?.sections?.length) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400 p-8">
        <p>누적 보기 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const { yPast3, yPast2, yPast1, yCurrent } = data.yearLabels;

  const rowInvCell = `${tdNum} bg-[#fce4d6] dark:bg-amber-950/35`;
  const rowInvSub = `${thSub} bg-[#fce4d6] dark:bg-amber-950/35`;
  const rowB2bCell = `${tdNum} bg-sky-100 dark:bg-sky-950/35`;
  const rowB2bSub = `${thSub} bg-sky-100 dark:bg-sky-950/35 font-medium`;

  const grand = aggregateB2cB2bTotals(data.sections);
  const grandStickyStyle: CSSProperties = { top: grandStickyTopPx };
  const thGrand =
    "border border-zinc-900 dark:border-zinc-600 px-2 py-1.5 text-center text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-[#b4c6e7] dark:bg-zinc-600 align-middle sticky z-[22]";
  const tdGrand =
    "border border-zinc-900 dark:border-zinc-600 px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 bg-[#b4c6e7] dark:bg-zinc-600 align-middle sticky z-[22]";

  return (
    <div className="max-h-[min(75vh,920px)] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
      <table className="w-full min-w-[1100px] border-collapse">
        <thead className="[&_th]:box-border">
          <tr ref={firstHeadRowRef}>
            <th rowSpan={2} colSpan={2} className={thStickyR1}>
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
          {grand ? (
            <tr>
              <th colSpan={2} className={thGrand} style={grandStickyStyle}>
                전체 합계
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.yPast3)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.yPast2)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.yPast1)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.yCurrent)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatRate(grand.growthRate)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.cum.priorYear)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.cum.target)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.cum.currentYear)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatRate(grand.cum.achievementRate)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatRate(grand.cum.yoyRate)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.mo.priorYear)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.mo.target)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatInt(grand.mo.currentYear)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatRate(grand.mo.achievementRate)}
              </th>
              <th scope="col" className={tdGrand} style={grandStickyStyle}>
                {formatRate(grand.mo.yoyRate)}
              </th>
            </tr>
          ) : null}
        </thead>
        <tbody>
          {data.sections.map((sec) =>
            sec.rows.map((row, ri) => {
              const isInv = row.rowKind === "inventory";
              const isB2b = row.rowKind.startsWith("b2b_");
              const isBranchSub = row.rowKind === "branch_subtotal";
              const isTeam = row.rowKind === "team";
              const isB2bBranchSub = row.rowKind === "b2b_branch_subtotal";
              const isB2bTeamRow = row.rowKind === "b2b_team";
              const numCls = isInv
                ? rowInvCell
                : isB2b
                  ? rowB2bCell
                  : isBranchSub
                    ? `${tdNum} bg-zinc-100 dark:bg-zinc-800/90 font-medium`
                    : tdNum;
              let subCls = isInv ? rowInvSub : thSub;
              if (isB2bBranchSub)
                subCls = `${thSub} bg-sky-100 dark:bg-sky-950/35 font-semibold`;
              else if (isB2bTeamRow)
                subCls = `${thSub} bg-sky-100 dark:bg-sky-950/35 font-normal`;
              else if (isB2b) subCls = rowB2bSub;
              else if (isBranchSub) subCls = `${thSub} bg-zinc-100 dark:bg-zinc-800/90 font-semibold`;
              else if (isTeam) subCls = `${thSub} font-normal`;
              const block = (
                <>
                  <td className={numCls}>{formatInt(row.metrics.yPast3)}</td>
                  <td className={numCls}>{formatInt(row.metrics.yPast2)}</td>
                  <td className={numCls}>{formatInt(row.metrics.yPast1)}</td>
                  <td className={numCls}>{formatInt(row.metrics.yCurrent)}</td>
                  <td className={numCls}>{formatRate(row.metrics.growthRate)}</td>
                  <td className={numCls}>{formatInt(row.metrics.cum.priorYear)}</td>
                  <td className={numCls}>{formatInt(row.metrics.cum.target)}</td>
                  <td className={numCls}>{formatInt(row.metrics.cum.currentYear)}</td>
                  <td className={numCls}>{formatRate(row.metrics.cum.achievementRate)}</td>
                  <td className={numCls}>{formatRate(row.metrics.cum.yoyRate)}</td>
                  <td className={numCls}>{formatInt(row.metrics.mo.priorYear)}</td>
                  <td className={numCls}>{formatInt(row.metrics.mo.target)}</td>
                  <td className={numCls}>{formatInt(row.metrics.mo.currentYear)}</td>
                  <td className={numCls}>{formatRate(row.metrics.mo.achievementRate)}</td>
                  <td className={numCls}>{formatRate(row.metrics.mo.yoyRate)}</td>
                </>
              );
              return (
                <tr key={`${sec.category}-${row.label}-${ri}`}>
                  {ri === 0 ? (
                    <th className={thCat} rowSpan={sec.rows.length}>
                      {sec.category}
                    </th>
                  ) : null}
                  <th className={subCls}>
                    {row.rowKind === "sellin" ? (
                      <strong>{row.label}</strong>
                    ) : row.rowKind === "team" || row.rowKind === "b2b_team" ? (
                      <span className="block pl-5 text-left">{row.label}</span>
                    ) : (
                      row.label
                    )}
                  </th>
                  {block}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
