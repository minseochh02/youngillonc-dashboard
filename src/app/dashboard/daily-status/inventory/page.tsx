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

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/inventory-sheet?date=${date}`);
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
    const filtered = data.branches.filter(b => selectedBranches.includes(b));
    return ["합계", ...filtered];
  }, [data, selectedBranches]);

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
        branchesToShow.forEach(branch => {
          let qty = 0;
          let weight = 0;

          if (branch === "합계") {
            Object.values(data.stats).forEach(bStats => {
              const catStats = bStats[cat.id];
              if (catStats) {
                if (metric.id === 'inventoryDM') {
                  qty += (catStats.inventory || 0) / 200;
                } else {
                  qty += (catStats as any)?.[metric.id] || 0;
                  weight += (catStats as any)?.[`${metric.id}_weight`] || 0;
                }
              }
            });
          } else {
            const stats = data.stats[branch]?.[cat.id];
            if (stats) {
              if (metric.id === 'inventoryDM') {
                qty = (stats.inventory || 0) / 200;
              } else {
                qty = (stats as any)?.[metric.id] || 0;
                weight = (stats as any)?.[`${metric.id}_weight`] || 0;
              }
            }
          }

          if (metric.id === 'inventoryDM') {
            row[`${branch}`] = qty;
          } else {
            row[`${branch} (Qty)`] = qty;
            row[`${branch} (Liters)`] = weight;
          }
        });

        exportData.push(row);
      });
    });

    const filename = `daily-inventory-sheet-${date}.xlsx`;
    exportToExcel(exportData, filename);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-blue-600" />
            일일재고파악시트
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

          <ExcelDownloadButton
            onClick={handleExcelDownload}
            disabled={!data || branchesToShow.length === 0}
          />

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all"
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
          <button onClick={() => fetchData()} className="ml-auto text-xs font-bold underline hover:no-underline">다시 시도</button>
        </div>
      )}

      {/* Branch Selection Bar */}
      {data && (
        <div className="flex flex-wrap items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2">부서 필터:</span>
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

      {/* Main Table Content */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/80 backdrop-blur-md">
                <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 p-4 border-b border-r border-zinc-200 dark:border-zinc-800 text-left w-[120px]">분류</th>
                <th className="sticky left-[120px] z-20 bg-zinc-50 dark:bg-zinc-900 p-4 border-b border-r border-zinc-200 dark:border-zinc-800 text-left w-[100px]">산업군</th>
                <th className="sticky left-[220px] z-20 bg-zinc-50 dark:bg-zinc-900 p-4 border-b border-r border-zinc-200 dark:border-zinc-800 text-left w-[100px]">티어</th>
                {branchesToShow.map(branch => (
                  <th 
                    key={branch} 
                    className={`p-4 border-b border-zinc-200 dark:border-zinc-800 text-center min-w-[140px] ${
                      branch === '합계' 
                        ? 'sticky left-[320px] z-30 bg-blue-600 text-white border-x border-blue-500 shadow-[2px_0_5px_rgba(0,0,0,0.1)]' 
                        : 'bg-zinc-50 dark:bg-zinc-900/80'
                    }`}
                  >
                    <span className={`block text-[10px] uppercase tracking-widest mb-1 ${branch === '합계' ? 'text-blue-100' : 'text-zinc-400'}`}>
                      {branch === '합계' ? '전체' : '지사/사업소'}
                    </span>
                    <span className="text-sm font-bold">{branch}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric, metricIdx) => (
                <React.Fragment key={metric.id}>
                  {CATEGORIES.map((cat, catIdx) => (
                    <tr 
                      key={`${metric.id}-${cat.id}`}
                      className={`group hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors ${
                        catIdx === CATEGORIES.length - 1 ? "border-b-2 border-zinc-200 dark:border-zinc-800" : "border-b border-zinc-100 dark:border-zinc-900"
                      }`}
                    >
                      {/* Metric Header (Row Spanning) */}
                      {catIdx === 0 && (
                        <td 
                          rowSpan={CATEGORIES.length} 
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
                      {branchesToShow.map(branch => {
                        let qty = 0;
                        let weight = 0;

                        if (branch === "합계") {
                          // Aggregate across all branches
                          Object.values(data?.stats || {}).forEach(bStats => {
                            const catStats = bStats[cat.id];
                            if (catStats) {
                              if (metric.id === 'inventoryDM') {
                                qty += (catStats.inventory || 0) / 200;
                              } else {
                                qty += (catStats as any)?.[metric.id] || 0;
                                weight += (catStats as any)?.[`${metric.id}_weight`] || 0;
                              }
                            }
                          });
                        } else {
                          const branchData = data?.stats[branch]?.[cat.id];
                          if (metric.id === 'inventoryDM') {
                            qty = (branchData?.inventory || 0) / 200;
                          } else {
                            qty = (branchData as any)?.[metric.id] || 0;
                            weight = (branchData as any)?.[`${metric.id}_weight`] || 0;
                          }
                        }

                        return (
                          <td 
                            key={branch} 
                            className={`p-4 border-r border-zinc-100 dark:border-zinc-900/50 align-middle ${
                              branch === '합계' 
                                ? 'sticky left-[320px] z-20 bg-blue-50 dark:bg-zinc-900 border-x-2 border-blue-200 dark:border-blue-900/50 font-bold shadow-[2px_0_5px_rgba(0,0,0,0.05)]' 
                                : ''
                            }`}
                          >
                            <div className="flex flex-col items-end gap-1">
                              <span className={`font-mono text-sm ${
                                qty > 0 ? "text-zinc-900 dark:text-zinc-100 font-semibold" : "text-zinc-300 dark:text-zinc-800"
                              } ${branch === '합계' ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                                {fmt(qty)}
                                {metric.id === 'inventoryDM' ? ' D/M' : ''}
                              </span>
                              {metric.id !== 'inventoryDM' && weight > 0 && (
                                <span className={`text-[10px] font-mono ${branch === '합계' ? 'text-blue-600/60 dark:text-blue-400/60' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                  {fmt(weight)} L
                                </span>
                              )}
                              {metric.id !== 'inventoryDM' && qty > 0 && weight > 0 && (
                                <span className={`text-[9px] transition-opacity ${branch === '합계' ? 'opacity-100 text-blue-500/40' : 'opacity-0 group-hover:opacity-100 text-zinc-400'}`}>
                                  ({fmt(weight / qty)} L/ea)
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
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

      {/* Summary Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">오늘의 총 매입</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {fmt(data ? Object.values(data.stats).reduce((acc, b) => 
                acc + Object.values(b).reduce((acc2, c) => acc2 + (c.purchase_weight || 0), 0), 0) : 0)} L
            </span>
            <span className="text-xs text-emerald-600/60 dark:text-emerald-400/60">
              ({fmt(data ? Object.values(data.stats).reduce((acc, b) => 
                acc + Object.values(b).reduce((acc2, c) => acc2 + (c.purchase || 0), 0), 0) : 0)} ea)
            </span>
          </div>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/50">
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">오늘의 총 매출</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {fmt(data ? Object.values(data.stats).reduce((acc, b) => 
                acc + Object.values(b).reduce((acc2, c) => acc2 + (c.sales_weight || 0), 0), 0) : 0)} L
            </span>
            <span className="text-xs text-blue-600/60 dark:text-blue-400/60">
              ({fmt(data ? Object.values(data.stats).reduce((acc, b) => 
                acc + Object.values(b).reduce((acc2, c) => acc2 + (c.sales || 0), 0), 0) : 0)} ea)
            </span>
          </div>
        </div>
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">현재고 총계</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
              {fmt(data ? Object.values(data.stats).reduce((acc, b) => 
                acc + Object.values(b).reduce((acc2, c) => acc2 + (c.inventory_weight || 0), 0), 0) : 0)} L
            </span>
            <span className="text-xs text-indigo-600/60 dark:text-indigo-400/60">
              ({fmt(data ? Object.values(data.stats).reduce((acc, b) => 
                acc + Object.values(b).reduce((acc2, c) => acc2 + (c.inventory || 0), 0), 0) : 0)} ea)
            </span>
          </div>
        </div>
      </div>

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

