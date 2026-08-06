"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Package, Calendar, Loader2, ArrowLeftRight, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight, Calculator,
  Printer, AlertTriangle
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";
import { exportToExcel } from "@/lib/excel-export";

// ── Types ──

interface InventoryStats {
  beginning: number;
  beginning_weight: number;
  purchase: number;
  purchase_weight: number;
  sales: number;
  sales_weight: number;
  transfer: number;
  transfer_weight: number;
  inventory: number;
  inventory_weight: number;
}

interface BranchStats {
  [category_tier: string]: InventoryStats;
}

interface DailyInventoryData {
  branches: string[];
  stats: { [branch: string]: BranchStats };
  date: string;
}

const CATEGORIES = [
  { id: "Auto_Flagship", label: "Auto", subLabel: "Flagship" },
  { id: "Auto_Others", label: "Auto", subLabel: "Others" },
  { id: "IL_Flagship", label: "IL", subLabel: "Flagship" },
  { id: "IL_Others", label: "IL", subLabel: "Others" },
  { id: "MB_All", label: "MB", subLabel: "" },
  { id: "Others_Flagship", label: "Others", subLabel: "Flagship" },
  { id: "Others_Others", label: "Others", subLabel: "Others" },
];

const METRICS = [
  { id: "beginning", label: "기초재고", icon: Package },
  { id: "purchase", label: "매입", icon: TrendingUp },
  { id: "sales", label: "매출", icon: TrendingDown },
  { id: "transfer", label: "이동", icon: ArrowLeftRight },
  { id: "inventory", label: "재고", icon: Calculator },
  { id: "inventoryDM", label: "재고 D/M계", icon: Calculator, formula: (val: number) => val / 200 },
];

// ── Helpers ──

function fmt(val: number): string {
  if (val === 0) return "-";
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ── Page ──

export default function DailyInventorySheet() {
  const [data, setData] = useState<DailyInventoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'division' | 'office'>('division');

  useEffect(() => {
    fetchData();
  }, [date, viewMode]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/inventory-sheet?date=${date}&viewMode=${viewMode}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        if (selectedBranches.length === 0 && result.data.branches.length > 0) {
          // Default to first few branches
          setSelectedBranches(result.data.branches.slice(0, 5));
        }
      } else {
        setError(result.error || "데이터를 불러오지 못했습니다.");
      }
    } catch (error: any) {
      console.error("Failed to fetch daily inventory:", error);
      setError(error.message || "서버 통신 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const branchesToShow = useMemo(() => {
    if (!data) return [];
    if (viewMode === 'division') {
      return ["합계", "본사", "동부", "서부"];
    }
    // Office detailed view: Show Grand Total, 3 Main Branches (본사, 동부, 서부), plus filtered HQ offices
    const hqOffices = data.branches.filter(b => b !== '동부' && b !== '서부' && selectedBranches.includes(b));
    return ["합계", "본사", "동부", "서부", ...hqOffices];
  }, [data, viewMode, selectedBranches]);

  const toggleBranch = (branch: string) => {
    if (branch === "합계") return; // Cannot toggle total
    setSelectedBranches(prev =>
      prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
    );
  };

  const handleExcelDownload = () => {
    if (!data || branchesToShow.length === 0) {
      alert('다운로드할 데이터가 없습니다. 부서를 선택해주세요.');
      return;
    }

    // Create flattened rows for Excel export
    const exportData: any[] = [];

    METRICS.forEach(metric => {
      CATEGORIES.forEach(cat => {
        const row: Record<string, any> = {
          '분류': metric.label,
          '산업군': cat.label,
          '티어': cat.subLabel,
        };

        // Add columns for each selected branch (including "합계")
        branchesToShow.forEach(col => {
          let qty = 0;
          let weight = 0;

          if (data?.stats) {
            Object.entries(data.stats).forEach(([branchName, bStats]) => {
              const isEast = branchName === '동부' || branchName.includes('동부');
              const isWest = branchName === '서부' || branchName.includes('서부');
              const isHQ = !isEast && !isWest;

              let match = false;
              if (col === '합계') match = true;
              else if (col === '본사') match = isHQ;
              else if (col === '동부') match = isEast;
              else if (col === '서부') match = isWest;
              else match = branchName === col;

              if (match) {
                const catStats = bStats[cat.id];
                if (catStats) {
                  if (metric.id === 'inventoryDM') {
                    qty += (catStats.inventory || 0) / 200;
                  } else {
                    qty += (catStats as any)?.[metric.id] || 0;
                    weight += (catStats as any)?.[`${metric.id}_weight`] || 0;
                  }
                }
              }
            });
          }

          if (metric.id === 'inventoryDM') {
            row[`${col}`] = qty;
          } else {
            row[`${col} (Qty)`] = qty;
            row[`${col} (Liters)`] = weight;
          }
        });

        exportData.push(row);
      });
    });

    const filename = `daily-inventory-sheet-${date}.xlsx`;
    exportToExcel(exportData, filename, { referenceDate: date });
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-blue-600" />
            일일재고파악
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            부서별/카테고리별 실시간 재고 및 수불 현황 (단위: Liter / DM)
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          {/* View Mode Toggle: 3대 지사별 vs 사업소 상세 */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setViewMode('division')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === 'division'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              3대 지사별 (본사/동부/서부)
            </button>
            <button
              onClick={() => setViewMode('office')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === 'office'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              사업소 상세 보기
            </button>
          </div>

          <ExcelDownloadButton
            onClick={handleExcelDownload}
            disabled={!data || isLoading || branchesToShow.length === 0}
          />

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all print:hidden"
          >
            <Printer className="w-4 h-4" /> 인쇄
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={fetchData} className="ml-auto text-xs font-bold underline hover:no-underline">다시 시도</button>
        </div>
      )}

      {/* Branch Selection (only visible in office detailed view mode) */}
      {data && viewMode === 'office' && (
        <div className="flex flex-wrap items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto print:hidden">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2">사업소 필터:</span>
          <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            합계 (고정)
          </div>
          {data.branches.map(branch => (
            <button
              key={branch}
              onClick={() => toggleBranch(branch)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedBranches.includes(branch)
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              {branch}
            </button>
          ))}
          <button
            onClick={() => setSelectedBranches(data.branches)}
            className="text-xs text-blue-600 font-medium px-2 hover:underline"
          >
            전체 선택
          </button>
        </div>
      )}

      {/* Daily Table */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/80 backdrop-blur-md">
                <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 p-4 border-b border-r border-zinc-200 dark:border-zinc-800 text-left w-[120px]">분류</th>
                <th className="sticky left-[120px] z-20 bg-zinc-50 dark:bg-zinc-900 p-4 border-b border-r border-zinc-200 dark:border-zinc-800 text-left w-[100px]">산업군</th>
                <th className="sticky left-[220px] z-20 bg-zinc-50 dark:bg-zinc-900 p-4 border-b border-r border-zinc-200 dark:border-zinc-800 text-left w-[100px]">티어</th>
                {branchesToShow.map(col => (
                  <th 
                    key={col} 
                    className={`p-4 border-b border-zinc-200 dark:border-zinc-800 text-center min-w-[140px] ${
                      col === '합계' 
                        ? 'sticky left-[320px] z-30 bg-blue-600 text-white border-x border-blue-500 shadow-[2px_0_5px_rgba(0,0,0,0.1)]' 
                        : col === '본사' || col === '동부' || col === '서부'
                        ? 'bg-blue-50/70 dark:bg-zinc-900/90 font-bold text-zinc-900 dark:text-zinc-100 border-x border-blue-100 dark:border-zinc-800'
                        : 'bg-zinc-50 dark:bg-zinc-900/80'
                    }`}
                  >
                    <span className={`block text-[10px] uppercase tracking-widest mb-1 ${
                      col === '합계' ? 'text-blue-100 font-bold' : col === '본사' || col === '동부' || col === '서부' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-zinc-400'
                    }`}>
                      {col === '합계' ? '전체' : (col === '본사' || col === '동부' || col === '서부') ? '3대 지사' : '본사 사업소'}
                    </span>
                    <span className="text-sm font-bold">{col}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric) => (
                <React.Fragment key={metric.id}>
                  {CATEGORIES.map((cat, catIdx) => (
                    <tr 
                      key={`${metric.id}-${cat.id}`}
                      className={`group hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors ${
                        catIdx === CATEGORIES.length - 1 ? "border-b border-zinc-200 dark:border-zinc-800" : "border-b border-zinc-100 dark:border-zinc-900"
                      }`}
                    >
                      {/* Metric Header (Row Spanning) */}
                      {catIdx === 0 && (
                        <td 
                          rowSpan={CATEGORIES.length + 1} 
                          className="sticky left-0 z-10 bg-white dark:bg-zinc-950 p-4 border-r border-zinc-200 dark:border-zinc-800 font-bold text-zinc-900 dark:text-zinc-100 align-middle"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <metric.icon className={`w-5 h-5 ${
                              metric.id === 'beginning' ? 'text-zinc-400' :
                              metric.id === 'purchase' ? 'text-emerald-500' :
                              metric.id === 'sales' ? 'text-blue-500' :
                              metric.id === 'transfer' ? 'text-amber-500' :
                              'text-indigo-500'
                            }`} />
                            <span className="text-center leading-tight">{metric.label}</span>
                          </div>
                        </td>
                      )}

                      {/* Category Headers */}
                      <td className="sticky left-[120px] z-10 bg-white dark:bg-zinc-950 p-4 border-r border-zinc-200 dark:border-zinc-800 font-medium text-zinc-700 dark:text-zinc-300">
                        {cat.label}
                      </td>
                      <td className="sticky left-[220px] z-10 bg-white dark:bg-zinc-950 p-4 border-r border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-500">
                        {cat.subLabel}
                      </td>

                      {/* Branch Data */}
                      {branchesToShow.map(col => {
                        let qty = 0;
                        let weight = 0;

                        if (data?.stats) {
                          Object.entries(data.stats).forEach(([branchName, bStats]) => {
                            const isEast = branchName === '동부' || branchName.includes('동부');
                            const isWest = branchName === '서부' || branchName.includes('서부');
                            const isHQ = !isEast && !isWest;

                            let match = false;
                            if (col === '합계') match = true;
                            else if (col === '본사') match = isHQ;
                            else if (col === '동부') match = isEast;
                            else if (col === '서부') match = isWest;
                            else match = branchName === col;

                            if (match) {
                              const catStats = bStats[cat.id];
                              if (catStats) {
                                if (metric.id === 'inventoryDM') {
                                  qty += (catStats.inventory || 0) / 200;
                                } else {
                                  qty += (catStats as any)?.[metric.id] || 0;
                                  weight += (catStats as any)?.[`${metric.id}_weight`] || 0;
                                }
                              }
                            }
                          });
                        }

                        return (
                          <td 
                            key={col} 
                            className={`p-4 border-r border-zinc-100 dark:border-zinc-900/50 align-middle ${
                              col === '합계' 
                                ? 'sticky left-[320px] z-20 bg-blue-50 dark:bg-zinc-900 border-x-2 border-blue-200 dark:border-blue-900/50 font-bold shadow-[2px_0_5px_rgba(0,0,0,0.05)]' 
                                : col === '본사' || col === '동부' || col === '서부'
                                ? 'bg-zinc-50/50 dark:bg-zinc-900/30 font-semibold'
                                : ''
                            }`}
                          >
                            <div className="flex flex-col items-end gap-1">
                              <span className={`font-mono text-sm ${
                                qty > 0 ? "text-zinc-900 dark:text-zinc-100 font-semibold" : "text-zinc-300 dark:text-zinc-800"
                              } ${col === '합계' ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                                {fmt(qty)}
                                {metric.id === 'inventoryDM' ? ' D/M' : ''}
                              </span>
                              {metric.id !== 'inventoryDM' && weight > 0 && (
                                <span className={`text-[10px] font-mono ${col === '합계' ? 'text-blue-600/60 dark:text-blue-400/60' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                  {fmt(weight)} L
                                </span>
                              )}
                              {metric.id !== 'inventoryDM' && qty > 0 && weight > 0 && (
                                <span className={`text-[9px] transition-opacity ${col === '합계' ? 'opacity-100 text-blue-500/40' : 'opacity-0 group-hover:opacity-100 text-zinc-400'}`}>
                                  ({fmt(weight / qty)} L/ea)
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Metric Subtotal Row (소계 / 합계) */}
                  <tr className="bg-zinc-100/90 dark:bg-zinc-900/90 font-bold border-b-2 border-zinc-300 dark:border-zinc-700">
                    <td colSpan={2} className="sticky left-[120px] z-10 bg-zinc-100 dark:bg-zinc-900 p-3.5 border-r border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {metric.label} 합계 (소계)
                    </td>
                    {branchesToShow.map(col => {
                      let totQty = 0;
                      let totWeight = 0;

                      if (data?.stats) {
                        Object.entries(data.stats).forEach(([branchName, bStats]) => {
                          const isEast = branchName === '동부' || branchName.includes('동부');
                          const isWest = branchName === '서부' || branchName.includes('서부');
                          const isHQ = !isEast && !isWest;

                          let match = false;
                          if (col === '합계') match = true;
                          else if (col === '본사') match = isHQ;
                          else if (col === '동부') match = isEast;
                          else if (col === '서부') match = isWest;
                          else match = branchName === col;

                          if (match) {
                            Object.values(bStats).forEach(cStats => {
                              if (metric.id === 'inventoryDM') {
                                totQty += (cStats.inventory || 0) / 200;
                              } else {
                                totQty += (cStats as any)?.[metric.id] || 0;
                                totWeight += (cStats as any)?.[`${metric.id}_weight`] || 0;
                              }
                            });
                          }
                        });
                      }

                      return (
                        <td
                          key={col}
                          className={`p-3.5 border-r border-zinc-200 dark:border-zinc-800 align-middle ${
                            col === '합계'
                              ? 'sticky left-[320px] z-20 bg-blue-100/80 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-x-2 border-blue-300 dark:border-blue-800'
                              : ''
                          }`}
                        >
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-mono text-sm font-bold">
                              {fmt(totQty)} {metric.id === 'inventoryDM' ? ' D/M' : ''}
                            </span>
                            {metric.id !== 'inventoryDM' && totWeight > 0 && (
                              <span className="text-xs font-mono font-semibold opacity-90">
                                {fmt(totWeight)} L
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>

            {/* Table Footer with Summary Breakdown (매입, 매출, 현재고) */}
            {data && (() => {
              const getMetricSummaryStats = (metricId: 'purchase' | 'sales' | 'inventory', col: string) => {
                let weight = 0;
                let qty = 0;
                if (!data?.stats) return { weight, qty, pct: 0 };

                let grandTotalWeight = 0;
                Object.values(data.stats).forEach(bStats => {
                  Object.values(bStats).forEach(cStats => {
                    grandTotalWeight += (cStats as any)?.[`${metricId}_weight`] || 0;
                  });
                });

                Object.entries(data.stats).forEach(([branchName, bStats]) => {
                  const isEast = branchName === '동부' || branchName.includes('동부');
                  const isWest = branchName === '서부' || branchName.includes('서부');
                  const isHQ = !isEast && !isWest;

                  let match = false;
                  if (col === '합계') match = true;
                  else if (col === '본사') match = isHQ;
                  else if (col === '동부') match = isEast;
                  else if (col === '서부') match = isWest;
                  else match = branchName === col;

                  if (match) {
                    Object.values(bStats).forEach(cStats => {
                      qty += (cStats as any)?.[metricId] || 0;
                      weight += (cStats as any)?.[`${metricId}_weight`] || 0;
                    });
                  }
                });

                const pct = grandTotalWeight > 0 ? (weight / grandTotalWeight) * 100 : 0;
                return { weight, qty, pct };
              };

              return (
                <tfoot className="bg-zinc-100/80 dark:bg-zinc-900/80 border-t-4 border-zinc-300 dark:border-zinc-700 font-bold">
                  {/* 1. 오늘의 총 매입 */}
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <td colSpan={3} className="sticky left-0 z-20 bg-emerald-100/90 dark:bg-emerald-950/90 p-4 border-r border-zinc-300 dark:border-zinc-700 text-left">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span>오늘의 총 매입</span>
                      </div>
                    </td>
                    {branchesToShow.map(col => {
                      const stats = getMetricSummaryStats('purchase', col);
                      return (
                        <td
                          key={col}
                          className={`p-4 border-r border-zinc-200 dark:border-zinc-800 align-middle ${
                            col === '합계'
                              ? 'sticky left-[320px] z-30 bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 border-x-2 border-emerald-300 dark:border-emerald-700 font-extrabold shadow-[2px_0_5px_rgba(0,0,0,0.05)]'
                              : 'bg-emerald-50/50 dark:bg-emerald-950/40'
                          }`}
                        >
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-mono text-sm font-extrabold text-emerald-900 dark:text-emerald-100">
                              {fmt(stats.weight)} L
                            </span>
                            <span className="text-xs font-mono font-semibold text-emerald-700/80 dark:text-emerald-300/80">
                              ({fmt(stats.qty)} ea)
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ({stats.pct.toFixed(1)}%)
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* 2. 오늘의 총 매출 */}
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <td colSpan={3} className="sticky left-0 z-20 bg-blue-100/90 dark:bg-blue-950/90 p-4 border-r border-zinc-300 dark:border-zinc-700 text-left">
                      <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-extrabold text-sm">
                        <TrendingDown className="w-4 h-4 text-blue-600" />
                        <span>오늘의 총 매출</span>
                      </div>
                    </td>
                    {branchesToShow.map(col => {
                      const stats = getMetricSummaryStats('sales', col);
                      return (
                        <td
                          key={col}
                          className={`p-4 border-r border-zinc-200 dark:border-zinc-800 align-middle ${
                            col === '합계'
                              ? 'sticky left-[320px] z-30 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-x-2 border-blue-300 dark:border-blue-700 font-extrabold shadow-[2px_0_5px_rgba(0,0,0,0.05)]'
                              : 'bg-blue-50/50 dark:bg-blue-950/40'
                          }`}
                        >
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-mono text-sm font-extrabold text-blue-900 dark:text-blue-100">
                              {fmt(stats.weight)} L
                            </span>
                            <span className="text-xs font-mono font-semibold text-blue-700/80 dark:text-blue-300/80">
                              ({fmt(stats.qty)} ea)
                            </span>
                            <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                              ({stats.pct.toFixed(1)}%)
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* 3. 현재고 총계 */}
                  <tr className="border-b border-indigo-200 dark:border-indigo-800">
                    <td colSpan={3} className="sticky left-0 z-20 bg-indigo-100/90 dark:bg-indigo-950/90 p-4 border-r border-zinc-300 dark:border-zinc-700 text-left">
                      <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-extrabold text-sm">
                        <Calculator className="w-4 h-4 text-indigo-600" />
                        <span>현재고 총계 (전사 합계)</span>
                      </div>
                    </td>
                    {branchesToShow.map(col => {
                      const stats = getMetricSummaryStats('inventory', col);
                      return (
                        <td
                          key={col}
                          className={`p-4 border-r border-zinc-200 dark:border-zinc-800 align-middle ${
                            col === '합계'
                              ? 'sticky left-[320px] z-30 bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 border-x-2 border-indigo-300 dark:border-indigo-700 font-extrabold shadow-[2px_0_5px_rgba(0,0,0,0.05)]'
                              : 'bg-indigo-50/50 dark:bg-indigo-950/40'
                          }`}
                        >
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-mono text-sm font-extrabold text-indigo-900 dark:text-indigo-100">
                              {fmt(stats.weight)} L
                            </span>
                            <span className="text-xs font-mono font-semibold text-indigo-700/80 dark:text-indigo-300/80">
                              ({fmt(stats.qty)} ea)
                            </span>
                            <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              ({stats.pct.toFixed(1)}%)
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* 4. 3대 지사별 세부 내역 행 (본사, 동부, 서부) */}
                  {[
                    { name: '본사', label: '본사 (Main)', match: (b: string) => !b.includes('동부') && !b.includes('서부') },
                    { name: '동부', label: '동부지사 (East)', match: (b: string) => b.includes('동부') },
                    { name: '서부', label: '서부지사 (West)', match: (b: string) => b.includes('서부') }
                  ].map(div => {
                    let divWeight = 0;
                    let divQty = 0;
                    let totalWeight = 0;

                    if (data?.stats) {
                      Object.entries(data.stats).forEach(([bName, bStats]) => {
                        Object.values(bStats).forEach((cStats: any) => {
                          const w = cStats.inventory_weight || 0;
                          const q = cStats.inventory || 0;
                          totalWeight += w;
                          if (div.match(bName)) {
                            divWeight += w;
                            divQty += q;
                          }
                        });
                      });
                    }

                    const pct = totalWeight > 0 ? (divWeight / totalWeight) * 100 : 0;

                    return (
                      <tr key={`div-row-${div.name}`} className="bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 text-xs">
                        <td className="sticky left-0 z-20 bg-indigo-50 dark:bg-indigo-950 p-3 border-r border-indigo-200 dark:border-indigo-800 font-bold text-indigo-950 dark:text-indigo-100">
                          └ {div.name}
                        </td>
                        <td className="sticky left-[120px] z-10 bg-indigo-50 dark:bg-indigo-950 p-3 border-r border-indigo-200 dark:border-indigo-800 font-medium text-indigo-700 dark:text-indigo-300">
                          {div.label}
                        </td>
                        <td className="sticky left-[220px] z-10 bg-indigo-50 dark:bg-indigo-950 p-3 border-r border-indigo-200 dark:border-indigo-800 text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                          ({pct.toFixed(1)}%)
                        </td>
                        {branchesToShow.map(col => {
                          let weight = 0;
                          let qty = 0;

                          if (data?.stats) {
                            Object.entries(data.stats).forEach(([bName, bStats]) => {
                              const isEast = bName === '동부' || bName.includes('동부');
                              const isWest = bName === '서부' || bName.includes('서부');
                              const isHQ = !isEast && !isWest;

                              let matchCol = false;
                              if (col === '합계') matchCol = true;
                              else if (col === '동부') matchCol = isEast;
                              else if (col === '서부') matchCol = isWest;
                              else matchCol = bName === col;

                              if (matchCol && div.match(bName)) {
                                Object.values(bStats).forEach((cStats: any) => {
                                  weight += cStats.inventory_weight || 0;
                                  qty += cStats.inventory || 0;
                                });
                              }
                            });
                          }

                          return (
                            <td
                              key={col}
                              className={`p-3 border-r border-indigo-100 dark:border-indigo-900/40 align-middle ${
                                col === '합계'
                                  ? 'sticky left-[320px] z-30 bg-indigo-100/90 dark:bg-indigo-900/90 font-bold text-indigo-950 dark:text-indigo-100 border-x-2 border-indigo-200 dark:border-indigo-800'
                                  : ''
                              }`}
                            >
                              {weight > 0 || qty > 0 ? (
                                <div className="flex flex-col items-end gap-0.5 font-mono">
                                  <span className="font-bold text-indigo-950 dark:text-indigo-100">{fmt(weight)} L</span>
                                  <span className="text-[11px] opacity-80">({fmt(qty)} ea)</span>
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">({pct.toFixed(1)}%)</span>
                                </div>
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-700 text-right block">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tfoot>
              );
            })()}
          </table>
        </div>

        {(!data || branchesToShow.length === 0) && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Package className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg">표시할 데이터가 없습니다.</p>
            <p className="text-sm">부서 필터에서 지사를 선택하거나 날짜를 변경해 보세요.</p>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-[1px] flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">재고 파악 시트 생성 중...</p>
            </div>
          </div>
        )}
      </div>

      {/* Summary Footer with Branch Total Breakdown */}
      {data && (() => {
        const getBranchBreakdown = (metricId: 'purchase' | 'sales' | 'inventory') => {
          const qtyKey = metricId;
          const weightKey = `${metricId}_weight`;
          const totalWeight = Object.values(data.stats).reduce((acc, b) => 
            acc + Object.values(b).reduce((acc2, c) => acc2 + ((c as any)?.[weightKey] || 0), 0), 0);

          const list = Object.entries(data.stats).map(([branch, bStats]) => {
            let weight = 0;
            let qty = 0;
            Object.values(bStats).forEach((catStats: any) => {
              weight += catStats[weightKey] || 0;
              qty += catStats[qtyKey] || 0;
            });
            const pct = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
            return { branch, weight, qty, pct };
          }).filter(b => b.weight > 0 || b.qty > 0);

          list.sort((a, b) => b.weight - a.weight);
          return { list, totalWeight };
        };

        const purchaseInfo = getBranchBreakdown('purchase');
        const salesInfo = getBranchBreakdown('sales');
        const inventoryInfo = getBranchBreakdown('inventory');

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            {/* 1. 오늘의 총 매입 */}
            <div className="p-5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">오늘의 총 매입 (전사 합계)</p>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-200">
                    {fmt(purchaseInfo.totalWeight)} L
                  </span>
                  <span className="text-sm font-semibold text-emerald-600/70 dark:text-emerald-400/70">
                    ({fmt(Object.values(data.stats).reduce((acc, b) => 
                      acc + Object.values(b).reduce((acc2, c) => acc2 + (c.purchase || 0), 0), 0))} ea)
                  </span>
                </div>

                {/* Branch Breakdown */}
                <div className="pt-3 border-t border-emerald-200/80 dark:border-emerald-900/50 space-y-2">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">지사별 세부 내역 (Branch Breakdown)</p>
                  {purchaseInfo.list.length === 0 ? (
                    <p className="text-xs text-emerald-600/60 dark:text-emerald-500/60">당일 매입 내역 없음</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {purchaseInfo.list.map(b => (
                        <div key={b.branch} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/30 text-xs">
                          <span className="font-bold text-emerald-900 dark:text-emerald-100">{b.branch}</span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-emerald-800 dark:text-emerald-200">{fmt(b.weight)} L</span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">({b.pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. 오늘의 총 매출 */}
            <div className="p-5 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">오늘의 총 매출 (전사 합계)</p>
                  <TrendingDown className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-extrabold text-blue-800 dark:text-blue-200">
                    {fmt(salesInfo.totalWeight)} L
                  </span>
                  <span className="text-sm font-semibold text-blue-600/70 dark:text-blue-400/70">
                    ({fmt(Object.values(data.stats).reduce((acc, b) => 
                      acc + Object.values(b).reduce((acc2, c) => acc2 + (c.sales || 0), 0), 0))} ea)
                  </span>
                </div>

                {/* Branch Breakdown */}
                <div className="pt-3 border-t border-blue-200/80 dark:border-blue-900/50 space-y-2">
                  <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase">지사별 세부 내역 (Branch Breakdown)</p>
                  {salesInfo.list.length === 0 ? (
                    <p className="text-xs text-blue-600/60 dark:text-blue-500/60">당일 매출 내역 없음</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {salesInfo.list.map(b => (
                        <div key={b.branch} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-blue-100/60 dark:bg-blue-900/30 text-xs">
                          <span className="font-bold text-blue-900 dark:text-blue-100">{b.branch}</span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-blue-800 dark:text-blue-200">{fmt(b.weight)} L</span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">({b.pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. 현재고 총계 */}
            <div className="p-5 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">현재고 총계 (전사 합계)</p>
                  <Calculator className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-extrabold text-indigo-800 dark:text-indigo-200">
                    {fmt(inventoryInfo.totalWeight)} L
                  </span>
                  <span className="text-sm font-semibold text-indigo-600/70 dark:text-indigo-400/70">
                    ({fmt(Object.values(data.stats).reduce((acc, b) => 
                      acc + Object.values(b).reduce((acc2, c) => acc2 + (c.inventory || 0), 0), 0))} ea)
                  </span>
                </div>

                {/* Branch Breakdown */}
                <div className="pt-3 border-t border-indigo-200/80 dark:border-indigo-900/50 space-y-2">
                  <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">지사별 세부 내역 (Branch Breakdown)</p>
                  {inventoryInfo.list.length === 0 ? (
                    <p className="text-xs text-indigo-600/60 dark:text-indigo-500/60">재고 내역 없음</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {inventoryInfo.list.map(b => (
                        <div key={b.branch} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-indigo-100/60 dark:bg-indigo-900/30 text-xs">
                          <span className="font-bold text-indigo-900 dark:text-indigo-100">{b.branch}</span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-indigo-800 dark:text-indigo-200">{fmt(b.weight)} L</span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">({b.pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #e5e7eb !important;
            padding: 4px 8px !important;
            font-size: 10px !important;
          }
          .sticky {
            position: relative !important;
            left: 0 !important;
          }
          .bg-zinc-50, .bg-white {
            background-color: transparent !important;
          }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

