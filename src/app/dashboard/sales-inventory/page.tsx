"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Package, ShoppingCart, Truck, Loader2, Search,
  AlertTriangle, CheckCircle2, Clock, Filter,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ── Types ──

interface SalesRow {
  품목코드: string;
  item_name: string;
  division: string;
  sold_qty: number;
  sold_amount: number;
}

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
  salesByDiv: Record<string, { qty: number; amount: number }>;
  totalSalesQty: number;
  totalSalesAmount: number;
  stockByWarehouse: Record<string, number>;
  totalStock: number;
  pendingSales: PendingSaleRow[];
  pendingPurchases: PendingPurchaseRow[];
  totalPendingSalesQty: number;
  totalPendingPurchasesQty: number;
}

// ── Helpers ──

function fmt(val: number): string {
  return val.toLocaleString();
}

function fmtCurrency(val: number): string {
  if (val === 0) return "-";
  return "₩" + val.toLocaleString();
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

// ── Page ──

export default function SalesInventoryPage() {
  const [salesByItem, setSalesByItem] = useState<SalesRow[]>([]);
  const [inventoryByItem, setInventoryByItem] = useState<InventoryRow[]>([]);
  const [pendingSales, setPendingSales] = useState<PendingSaleRow[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchaseRow[]>([]);
  const [warehouseList, setWarehouseList] = useState<string[]>([]);
  const [divisionList, setDivisionList] = useState<string[]>([]);
  const [monthList, setMonthList] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [showOnlyWithPending, setShowOnlyWithPending] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedDivision, selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDivision !== "all") params.set("division", selectedDivision);
      if (selectedMonth) params.set("month", selectedMonth);
      const response = await apiFetch(`/api/dashboard/sales-inventory?${params}`);
      const result = await response.json();
      if (result.success) {
        setSalesByItem(result.data.salesByItem || []);
        setInventoryByItem(result.data.inventoryByItem || []);
        setPendingSales(result.data.pendingSales || []);
        setPendingPurchases(result.data.pendingPurchases || []);
        setWarehouseList(result.data.warehouses || []);
        setDivisionList(result.data.divisions || []);
        setMonthList(result.data.months || []);
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Merge everything by 품목코드
  const mergedItems = useMemo(() => {
    const map = new Map<string, MergedItem>();

    const getOrCreate = (code: string, name: string): MergedItem => {
      if (!map.has(code)) {
        map.set(code, {
          code, name,
          salesByDiv: {}, totalSalesQty: 0, totalSalesAmount: 0,
          stockByWarehouse: {}, totalStock: 0,
          pendingSales: [], pendingPurchases: [],
          totalPendingSalesQty: 0, totalPendingPurchasesQty: 0,
        });
      }
      const item = map.get(code)!;
      if (!item.name && name) item.name = name;
      return item;
    };

    for (const row of salesByItem) {
      const item = getOrCreate(row.품목코드, row.item_name);
      const qty = Number(row.sold_qty) || 0;
      const amt = Number(row.sold_amount) || 0;
      if (!item.salesByDiv[row.division]) {
        item.salesByDiv[row.division] = { qty: 0, amount: 0 };
      }
      item.salesByDiv[row.division].qty += qty;
      item.salesByDiv[row.division].amount += amt;
      item.totalSalesQty += qty;
      item.totalSalesAmount += amt;
    }

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
  }, [salesByItem, inventoryByItem, pendingSales, pendingPurchases]);

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

    items.sort((a, b) => b.totalSalesQty - a.totalSalesQty);

    return items;
  }, [mergedItems, search, showOnlyWithPending]);

  // Active divisions for column headers (from the current filtered data)
  const activeDivisions = useMemo(() => {
    const set = new Set<string>();
    for (const item of filtered) {
      for (const div of Object.keys(item.salesByDiv)) set.add(div);
    }
    const order = ["MB", "화성", "창원", "남부", "중부", "서부", "동부", "제주", "부산"];
    return [...set].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [filtered]);

  // Summary stats
  const stats = useMemo(() => {
    const totalSales = mergedItems.reduce((s, it) => s + it.totalSalesQty, 0);
    const totalStock = mergedItems.reduce((s, it) => s + it.totalStock, 0);
    const totalPendingOut = mergedItems.reduce((s, it) => s + it.totalPendingSalesQty, 0);
    const totalPendingIn = mergedItems.reduce((s, it) => s + it.totalPendingPurchasesQty, 0);
    const itemsWithPending = mergedItems.filter(
      (it) => it.pendingSales.length > 0 || it.pendingPurchases.length > 0
    ).length;
    return { totalSales, totalStock, totalPendingOut, totalPendingIn, itemsWithPending };
  }, [mergedItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            판매현황
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            부서별 판매와 창고 재고를 품목 단위로 매칭합니다
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniCard label="품목 수" value={fmt(mergedItems.length)} />
        <MiniCard label="총 판매수량" value={fmt(stats.totalSales)} color="blue" />
        <MiniCard label="현재고 합계" value={fmt(stats.totalStock)} color="indigo" />
        <MiniCard label="미판매 잔량" value={fmt(stats.totalPendingOut)} color="amber" />
        <MiniCard label="미구매 잔량" value={fmt(stats.totalPendingIn)} color="emerald" />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 shadow-sm">
        {/* Search */}
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

        {/* Division */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="text-xs bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 cursor-pointer"
          >
            <option value="all">전체 부서</option>
            {divisionList.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Month */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="text-xs bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 outline-none text-zinc-700 dark:text-zinc-300 cursor-pointer"
        >
          <option value="">전체 기간</option>
          {monthList.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Pending toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showOnlyWithPending}
            onChange={(e) => setShowOnlyWithPending(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">미판매/미구매만</span>
        </label>

        {isLoading && <Loader2 className="w-4 h-4 text-blue-500 animate-spin ml-auto" />}
      </div>

      {/* ── Main Table ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800/80 backdrop-blur">
              <tr>
                {/* Item info */}
                <th className="text-left py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 min-w-[240px]">
                  품목
                </th>

                {/* Sales by division */}
                {activeDivisions.map((div) => (
                  <th
                    key={div}
                    className="text-right py-3 px-3 text-[10px] font-bold text-blue-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 whitespace-nowrap"
                  >
                    {div}
                  </th>
                ))}

                {/* Total sales */}
                <th className="text-right py-3 px-3 text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 bg-blue-50/50 dark:bg-blue-900/10 whitespace-nowrap">
                  판매 합계
                </th>

                {/* Inventory */}
                <th className="text-left py-3 px-4 text-[10px] font-bold text-indigo-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 min-w-[180px]">
                  창고별 재고
                </th>

                {/* Pending / Status */}
                <th className="text-center py-3 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 min-w-[120px]">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={activeDivisions.length + 4} className="py-16 text-center text-zinc-400">
                    {search ? "검색 결과가 없습니다" : "데이터가 없습니다"}
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 200).map((item) => (
                  <tr
                    key={item.code}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group"
                  >
                    {/* Item */}
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

                    {/* Sales by division */}
                    {activeDivisions.map((div) => {
                      const data = item.salesByDiv[div];
                      return (
                        <td key={div} className="py-3 px-3 text-right font-mono">
                          {data ? (
                            <div>
                              <span className="text-zinc-900 dark:text-zinc-100 text-xs">{fmt(data.qty)}</span>
                              <p className="text-[10px] text-zinc-400">{fmtCurrency(data.amount)}</p>
                            </div>
                          ) : (
                            <span className="text-zinc-200 dark:text-zinc-700">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total sales */}
                    <td className="py-3 px-3 text-right font-mono bg-blue-50/30 dark:bg-blue-900/5">
                      {item.totalSalesQty > 0 ? (
                        <div>
                          <span className="font-bold text-blue-700 dark:text-blue-300 text-xs">{fmt(item.totalSalesQty)}</span>
                          <p className="text-[10px] text-blue-400">{fmtCurrency(item.totalSalesAmount)}</p>
                        </div>
                      ) : (
                        <span className="text-zinc-200 dark:text-zinc-700">-</span>
                      )}
                    </td>

                    {/* Inventory pills */}
                    <td className="py-3 px-4">
                      <WarehousePills stockByWarehouse={item.stockByWarehouse} />
                    </td>

                    {/* Status */}
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

      {/* Loading overlay */}
      {isLoading && mergedItems.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>데이터를 불러오는 중...</p>
        </div>
      )}
    </div>
  );
}

// ── Mini stat card ──

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
