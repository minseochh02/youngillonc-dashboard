"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Package, ShoppingCart, Truck, Loader2, Search,
  AlertTriangle, CheckCircle2, Clock, Filter, Calendar,
  ArrowLeftRight, TrendingUp, TrendingDown, Calculator, Printer
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";
import { exportToExcel, generateFilename, flattenObject } from "@/lib/excel-export";
import React from "react";

// ── Types ──

interface InventoryRow {
  품목코드: string;
  item_name: string;
  warehouse: string;
  stock_qty: number;
}

interface PendingSaleRow {
  품목코드: string;
  item_name: string;
  customer: string;
  remaining_qty: number;
  supply_amount: number;
  due_date: string;
  memo: string;
}

interface PendingPurchaseRow {
  품목코드: string;
  item_name: string;
  supplier: string;
  remaining_qty: number;
  outstanding_total: number;
  due_date: string;
  warehouse: string;
}

interface MergedItem {
  code: string;
  name: string;
  stockByWarehouse: Record<string, number>;
  totalStock: number;
  pendingSales: PendingSaleRow[];
  pendingPurchases: PendingPurchaseRow[];
  totalPendingSalesQty: number;
  totalPendingPurchasesQty: number;
}

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

function StatusBadge({ stock, pendingOut }: { stock: number; pendingOut: number }) {
  if (stock === 0 && pendingOut === 0) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">-</span>;
  }
  if (stock === 0 && pendingOut > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-2.5 h-2.5" /> 재고없음
      </span>
    );
  }
  if (stock < pendingOut) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-2.5 h-2.5" /> 부족
      </span>
    );
  }
  if (pendingOut > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-2.5 h-2.5" /> 충족
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
      <Package className="w-2.5 h-2.5" /> 재고
    </span>
  );
}

function WarehousePills({ stockByWarehouse }: { stockByWarehouse: Record<string, number> }) {
  const entries = Object.entries(stockByWarehouse).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    return <span className="text-xs text-zinc-300 dark:text-zinc-600">재고없음</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([wh, qty]) => (
        <span
          key={wh}
          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50"
        >
          {wh} <span className="font-bold">{fmt(qty)}</span>
        </span>
      ))}
    </div>
  );
}

function PendingTags({ pendingSales, pendingPurchases }: { pendingSales: PendingSaleRow[]; pendingPurchases: PendingPurchaseRow[] }) {
  if (pendingSales.length === 0 && pendingPurchases.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {pendingSales.map((ps, i) => (
        <span
          key={`ps-${i}`}
          className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800/50"
          title={`미판매: ${ps.customer} / 납기 ${ps.due_date}`}
        >
          <ShoppingCart className="w-2.5 h-2.5" /> 미판매 {fmt(ps.remaining_qty)}
        </span>
      ))}
      {pendingPurchases.map((pp, i) => (
        <span
          key={`pp-${i}`}
          className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50"
          title={`미구매: ${pp.supplier} / 납기 ${pp.due_date}`}
        >
          <Truck className="w-2.5 h-2.5" /> 미구매 {fmt(pp.remaining_qty)}
        </span>
      ))}
    </div>
  );
}

function MiniCard({
  label, value, color,
}: {
  label: string;
  value: string;
  color?: "blue" | "indigo" | "amber" | "emerald";
}) {
  const valueColor = color === "blue"
    ? "text-blue-600 dark:text-blue-400"
    : color === "indigo"
      ? "text-indigo-600 dark:text-indigo-400"
      : color === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : color === "emerald"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-zinc-900 dark:text-zinc-100";

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${valueColor}`}>{value}</p>
    </div>
  );
}

// ── Page ──

export default function InventoryStatusPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'daily'>('items');

  // Item view state
  const [inventoryByItem, setInventoryByItem] = useState<InventoryRow[]>([]);
  const [pendingSales, setPendingSales] = useState<PendingSaleRow[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchaseRow[]>([]);
  const [warehouseList, setWarehouseList] = useState<string[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [search, setSearch] = useState("");
  const [showOnlyWithPending, setShowOnlyWithPending] = useState(false);

  // Daily view state
  const [dailyData, setDailyData] = useState<DailyInventoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  useEffect(() => {
    if (activeTab === 'items') {
      fetchItemsData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyData();
    }
  }, [activeTab, date]);

  const fetchItemsData = async () => {
    setIsLoadingItems(true);
    try {
      const response = await apiFetch(`/api/dashboard/inventory`);
      const result = await response.json();
      if (result.success) {
        setInventoryByItem(result.data.inventoryByItem || []);
        setPendingSales(result.data.pendingSales || []);
        setPendingPurchases(result.data.pendingPurchases || []);
        setWarehouseList(result.data.warehouses || []);
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const fetchDailyData = async () => {
    setIsLoadingDaily(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/inventory-sheet?date=${date}`);
      const result = await response.json();
      if (result.success) {
        setDailyData(result.data);
        if (selectedBranches.length === 0 && result.data.branches.length > 0) {
          setSelectedBranches(result.data.branches.slice(0, 5));
        }
      } else {
        setError(result.error || "데이터를 불러오지 못했습니다.");
      }
    } catch (error: any) {
      console.error("Failed to fetch daily inventory:", error);
      setError(error.message || "서버 통신 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingDaily(false);
    }
  };

  // Merge everything by 품목코드
  const mergedItems = useMemo(() => {
    const map = new Map<string, MergedItem>();

    const getOrCreate = (code: string, name: string): MergedItem => {
      if (!map.has(code)) {
        map.set(code, {
          code, name,
          stockByWarehouse: {}, totalStock: 0,
          pendingSales: [], pendingPurchases: [],
          totalPendingSalesQty: 0, totalPendingPurchasesQty: 0,
        });
      }
      const item = map.get(code)!;
      if (!item.name && name) item.name = name;
      return item;
    };

    for (const row of inventoryByItem) {
      const item = getOrCreate(row.품목코드, row.item_name);
      const qty = Number(row.stock_qty) || 0;
      item.stockByWarehouse[row.warehouse] = (item.stockByWarehouse[row.warehouse] || 0) + qty;
      item.totalStock += qty;
    }

    for (const row of pendingSales) {
      const item = getOrCreate(row.품목코드, row.item_name);
      item.pendingSales.push(row);
      item.totalPendingSalesQty += Number(row.remaining_qty) || 0;
    }

    for (const row of pendingPurchases) {
      const item = getOrCreate(row.품목코드, row.item_name);
      item.pendingPurchases.push(row);
      item.totalPendingPurchasesQty += Number(row.remaining_qty) || 0;
    }

    return Array.from(map.values());
  }, [inventoryByItem, pendingSales, pendingPurchases]);

  // Filter & sort
  const filtered = useMemo(() => {
    let items = mergedItems;

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (it) => it.code.toLowerCase().includes(q) || it.name.toLowerCase().includes(q)
      );
    }

    if (showOnlyWithPending) {
      items = items.filter(
        (it) => it.pendingSales.length > 0 || it.pendingPurchases.length > 0
      );
    }

    items.sort((a, b) => b.totalStock - a.totalStock);

    return items;
  }, [mergedItems, search, showOnlyWithPending]);

  // Summary stats
  const stats = useMemo(() => {
    const totalStock = mergedItems.reduce((s, it) => s + it.totalStock, 0);
    const totalPendingOut = mergedItems.reduce((s, it) => s + it.totalPendingSalesQty, 0);
    const totalPendingIn = mergedItems.reduce((s, it) => s + it.totalPendingPurchasesQty, 0);
    const itemsWithPending = mergedItems.filter(
      (it) => it.pendingSales.length > 0 || it.pendingPurchases.length > 0
    ).length;
    return { totalStock, totalPendingOut, totalPendingIn, itemsWithPending };
  }, [mergedItems]);

  const branchesToShow = useMemo(() => {
    if (!dailyData) return [];
    const filtered = dailyData.branches.filter(b => selectedBranches.includes(b));
    return ["합계", ...filtered];
  }, [dailyData, selectedBranches]);

  const toggleBranch = (branch: string) => {
    if (branch === "합계") return;
    setSelectedBranches(prev =>
      prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
    );
  };

  const handleItemsExcelDownload = () => {
    if (filtered.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData = filtered.map(item => {
      const row: Record<string, any> = {
        '품목코드': item.code,
        '품목명': item.name,
        '총재고': item.totalStock,
        '미판매 잔량': item.totalPendingSalesQty,
        '미구매 잔량': item.totalPendingPurchasesQty,
      };

      warehouseList.forEach(warehouse => {
        row[`${warehouse} 재고`] = item.stockByWarehouse[warehouse] || 0;
      });

      if (item.pendingSales.length > 0) {
        row['미판매 내역'] = item.pendingSales
          .map(ps => `${ps.customer}(${ps.remaining_qty}, 납기:${ps.due_date})`)
          .join('; ');
      }

      if (item.pendingPurchases.length > 0) {
        row['미구매 내역'] = item.pendingPurchases
          .map(pp => `${pp.supplier}(${pp.remaining_qty}, 납기:${pp.due_date})`)
          .join('; ');
      }

      return row;
    });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const filename = `inventory-${dateStr}.xlsx`;

    exportToExcel(exportData, filename);
  };

  const handleDailyExcelDownload = () => {
    if (!dailyData || branchesToShow.length === 0) {
      alert('다운로드할 데이터가 없습니다. 부서를 선택해주세요.');
      return;
    }

    const exportData: any[] = [];

    METRICS.forEach(metric => {
      CATEGORIES.forEach(cat => {
        const row: Record<string, any> = {
          '분류': metric.label,
          '산업군': cat.label,
          '티어': cat.subLabel,
        };

        branchesToShow.forEach(branch => {
          let qty = 0;
          let weight = 0;

          if (branch === "합계") {
            Object.values(dailyData.stats).forEach(bStats => {
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
            const stats = dailyData.stats[branch]?.[cat.id];
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            재고현황
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            {activeTab === 'items'
              ? '창고별 실시간 재고와 미판매/미구매 잔량을 품목 단위로 확인합니다'
              : '부서별/카테고리별 실시간 재고 및 수불 현황 (단위: Liter / DM)'}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'items'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          품목별 재고
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'daily'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          일일재고파악
        </button>
      </div>

      {/* Items Tab */}
      {activeTab === 'items' && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniCard label="품목 수" value={fmt(mergedItems.length)} />
            <MiniCard label="현재고 합계" value={fmt(stats.totalStock)} color="indigo" />
            <MiniCard label="미판매 잔량" value={fmt(stats.totalPendingOut)} color="amber" />
            <MiniCard label="미구매 잔량" value={fmt(stats.totalPendingIn)} color="emerald" />
          </div>

          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="품목코드 또는 품목명 검색..."
                className="text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 w-full"
              />
            </div>

            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyWithPending}
                onChange={(e) => setShowOnlyWithPending(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">미판매/미구매만</span>
            </label>

            <div className="ml-auto" />

            <ExcelDownloadButton
              onClick={handleItemsExcelDownload}
              disabled={filtered.length === 0}
            />

            {isLoadingItems && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
          </div>

          {/* Main Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800/80 backdrop-blur">
                  <tr>
                    <th className="text-left py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 min-w-[240px]">
                      품목
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold text-indigo-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 min-w-[180px]">
                      창고별 재고
                    </th>
                    <th className="text-right py-3 px-4 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 bg-indigo-50/50 dark:bg-indigo-900/10 whitespace-nowrap">
                      재고 합계
                    </th>
                    <th className="text-center py-3 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 min-w-[120px]">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && !isLoadingItems ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-zinc-400">
                        {search ? "검색 결과가 없습니다" : "데이터가 없습니다"}
                      </td>
                    </tr>
                  ) : (
                    filtered.slice(0, 200).map((item) => (
                      <tr
                        key={item.code}
                        className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[240px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono">{item.code}</p>
                          <PendingTags
                            pendingSales={item.pendingSales}
                            pendingPurchases={item.pendingPurchases}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <WarehousePills stockByWarehouse={item.stockByWarehouse} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono bg-indigo-50/30 dark:bg-indigo-900/5">
                          <span className="font-bold text-indigo-700 dark:text-indigo-300 text-xs">{fmt(item.totalStock)}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <StatusBadge stock={item.totalStock} pendingOut={item.totalPendingSalesQty} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filtered.length > 200 && (
              <div className="px-4 py-3 text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 text-center">
                {filtered.length}개 중 200개만 표시됩니다. 검색으로 범위를 좁혀주세요.
              </div>
            )}
          </div>

          {isLoadingItems && mergedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>데이터를 불러오는 중...</p>
            </div>
          )}
        </>
      )}

      {/* Daily Tab */}
      {activeTab === 'daily' && (
        <>
          {/* Controls */}
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
              onClick={handleDailyExcelDownload}
              disabled={!dailyData || branchesToShow.length === 0}
            />

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all"
            >
              <Printer className="w-4 h-4" /> 인쇄
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
              <button onClick={() => fetchDailyData()} className="ml-auto text-xs font-bold underline hover:no-underline">다시 시도</button>
            </div>
          )}

          {/* Branch Selection */}
          {dailyData && (
            <div className="flex flex-wrap items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2">부서 필터:</span>
              <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                합계 (고정)
              </div>
              {dailyData.branches.map(branch => (
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
                onClick={() => setSelectedBranches(dailyData.branches)}
                className="text-xs text-blue-600 font-medium px-2 hover:underline"
              >
                전체 선택
              </button>
            </div>
          )}

          {/* Daily Table */}
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
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
                          <td className="sticky left-[120px] z-10 bg-white dark:bg-zinc-950 p-4 border-r border-zinc-200 dark:border-zinc-800 font-medium text-zinc-700 dark:text-zinc-300">
                            {cat.label}
                          </td>
                          <td className="sticky left-[220px] z-10 bg-white dark:bg-zinc-950 p-4 border-r border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-500">
                            {cat.subLabel}
                          </td>
                          {branchesToShow.map(branch => {
                            let qty = 0;
                            let weight = 0;

                            if (branch === "합계") {
                              Object.values(dailyData?.stats || {}).forEach(bStats => {
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
                              const branchData = dailyData?.stats[branch]?.[cat.id];
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
                                  } ${branch === '합계' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
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

            {(!dailyData || branchesToShow.length === 0) && !isLoadingDaily && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-lg">표시할 데이터가 없습니다.</p>
                <p className="text-sm">부서 필터에서 지사를 선택하거나 날짜를 변경해 보세요.</p>
              </div>
            )}

            {isLoadingDaily && (
              <div className="absolute inset-0 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-[1px] flex items-center justify-center z-50">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">재고 파악 시트 생성 중...</p>
                </div>
              </div>
            )}
          </div>

          {/* Summary Footer */}
          {dailyData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">오늘의 총 매입</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    {fmt(Object.values(dailyData.stats).reduce((acc, b) => 
                      acc + Object.values(b).reduce((acc2, c) => acc2 + (c.purchase_weight || 0), 0), 0))} L
                  </span>
                  <span className="text-xs text-emerald-600/60 dark:text-emerald-400/60">
                    ({fmt(Object.values(dailyData.stats).reduce((acc, b) => 
                      acc + Object.values(b).reduce((acc2, c) => acc2 + (c.purchase || 0), 0), 0))} ea)
                  </span>
                </div>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/50">
                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">오늘의 총 매출</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {fmt(Object.values(dailyData.stats).reduce((acc, b) => 
                      acc + Object.values(b).reduce((acc2, c) => acc2 + (c.sales_weight || 0), 0), 0))} L
                  </span>
                  <span className="text-xs text-blue-600/60 dark:text-blue-400/60">
                    ({fmt(Object.values(dailyData.stats).reduce((acc, b) => 
                      acc + Object.values(b).reduce((acc2, c) => acc2 + (c.sales || 0), 0), 0))} ea)
                  </span>
                </div>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">현재고 총계</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                    {fmt(Object.values(dailyData.stats).reduce((acc, b) => 
                      acc + Object.values(b).reduce((acc2, c) => acc2 + (c.inventory_weight || 0), 0), 0))} L
                  </span>
                  <span className="text-xs text-indigo-600/60 dark:text-indigo-400/60">
                    ({fmt(Object.values(dailyData.stats).reduce((acc, b) => 
                      acc + Object.values(b).reduce((acc2, c) => acc2 + (c.inventory || 0), 0), 0))} ea)
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
