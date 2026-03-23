"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Package, Loader2, Plus, Trash2, Search,
  AlertTriangle, Filter, Building2, Calculator, Edit2, Check, X
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";
import { exportToExcel } from "@/lib/excel-export";

// ── Types ──

interface SavedItem {
  id: string;
  itemCode: string;
  itemName: string;
  warehouse: string;
  quantity: number;
  unit: string;
  category: string;
  spec: string;
  remarks: string;
  actionPlan: string;
  targetMonth: string; // YYYY-MM
  createdAt: string;
}

interface ItemOption {
  품목코드: string;
  item_name: string;
  category: string;
  spec: string;
}

interface RecommendedItem {
  itemCode: string;
  itemName: string;
  warehouse: string;
  quantity: number;
  sales_qty_6m: number;
  lastSoldDate: string | null;
  turnoverRatio: number;
}

interface ApiData {
  savedItems: SavedItem[];
  items: ItemOption[];
  warehouses: string[];
  units: string[];
  recommendations: RecommendedItem[];
}

// ── Helpers ──

function fmt(val: number): string {
  return Number(val).toLocaleString();
}

function EditableCell({ 
  value, 
  onSave, 
  isLoading 
}: { 
  value: string; 
  onSave: (val: string) => Promise<void>;
  isLoading?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  const handleSave = async () => {
    if (currentValue === value) {
      setIsEditing(false);
      return;
    }
    await onSave(currentValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          autoFocus
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          onBlur={handleSave}
          className="w-full text-xs bg-white dark:bg-zinc-800 border border-blue-500 rounded px-1.5 py-1 outline-none"
        />
      </div>
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)}
      className="group/cell relative cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded px-1 -mx-1 py-1"
    >
      <span className={!value ? "text-zinc-400 italic" : ""}>
        {value || "입력하세요..."}
      </span>
      <Edit2 className="w-3 h-3 absolute -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 text-zinc-400" />
    </div>
  );
}

// ── Page ──

export default function LongTermInventoryPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [selectedItemCode, setSelectedItemCode] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [remarks, setRemarks] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  
  // Search for item selection in form
  const [itemSearch, setItemSearch] = useState("");
  const [isItemSelectOpen, setIsItemSelectOpen] = useState(false);
  
  // Search state
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("전체");
  const [activeTab, setActiveTab] = useState<'managed' | 'recommended'>('managed');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const categories = ["전체", "IL", "AL", "기타"];

  const groupedItems = useMemo(() => {
    if (!data?.items) return {};
    const groups: Record<string, ItemOption[]> = { IL: [], AL: [], 기타: [] };
    data.items.forEach(it => {
      const cat = it.category || '기타';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(it);
    });
    return groups;
  }, [data?.items]);

  const filteredItemOptions = useMemo(() => {
    if (!data?.items) return [];
    if (!itemSearch) return data.items;
    const q = itemSearch.toLowerCase();
    return data.items.filter(it => 
      it.item_name.toLowerCase().includes(q) || 
      it.품목코드.toLowerCase().includes(q)
    );
  }, [data?.items, itemSearch]);

  const selectedItem = useMemo(() => {
    return data?.items.find(it => it.품목코드 === selectedItemCode);
  }, [data?.items, selectedItemCode]);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/long-term-inventory?month=${selectedMonth}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch long-term inventory data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCarryOver = async () => {
    // Get previous month
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    if (!confirm(`${prevMonthStr}의 장기재고 목록을 ${selectedMonth}로 복사하시겠습니까?`)) return;

    try {
      setIsSaving(true);
      const response = await apiFetch(`/api/dashboard/long-term-inventory`, {
        method: "POST",
        body: JSON.stringify({
          action: 'carry-over',
          fromMonth: prevMonthStr,
          toMonth: selectedMonth,
        }),
      });
      const result = await response.json();
      if (result.success) {
        fetchData();
        alert(`${result.count}개의 항목이 복사되었습니다.`);
      }
    } catch (error) {
      console.error("Failed to carry over:", error);
      alert("복사에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemCode || !selectedWarehouse || quantity <= 0 || !selectedUnit) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    setIsSaving(true);
    try {
      const selectedItem = data?.items.find(it => it.품목코드 === selectedItemCode);
      const newItem = {
        itemCode: selectedItemCode,
        itemName: selectedItem?.item_name || "",
        warehouse: selectedWarehouse,
        quantity,
        unit: selectedUnit,
        spec: selectedItem?.spec || "",
        remarks,
        actionPlan,
        targetMonth: selectedMonth,
      };

      const response = await apiFetch(`/api/dashboard/long-term-inventory`, {
        method: "POST",
        body: JSON.stringify(newItem),
      });

      const result = await response.json();
      if (result.success) {
        // Reset form
        setSelectedItemCode("");
        setSelectedWarehouse("");
        setQuantity(0);
        setSelectedUnit("");
        setRemarks("");
        setActionPlan("");
        // Refresh list
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<SavedItem>) => {
    try {
      const response = await apiFetch(`/api/dashboard/long-term-inventory`, {
        method: "PATCH",
        body: JSON.stringify({ id, ...updates }),
      });
      const result = await response.json();
      if (result.success) {
        // Optimistic UI update or refresh
        setData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            savedItems: prev.savedItems.map(item => 
              item.id === id ? { ...item, ...updates } : item
            )
          };
        });
      }
    } catch (error) {
      console.error("Failed to update:", error);
      alert("수정에 실패했습니다.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const response = await apiFetch(`/api/dashboard/long-term-inventory?id=${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("삭제에 실패했습니다.");
    }
  };

  const handleRegisterRecommended = async (item: RecommendedItem) => {
    setIsSaving(true);
    try {
      const itemOption = data?.items.find(it => it.품목코드 === item.itemCode);
      const newItem = {
        itemCode: item.itemCode,
        itemName: item.itemName,
        warehouse: item.warehouse,
        quantity: item.quantity,
        unit: 'EA', // Default
        spec: itemOption?.spec || "",
        remarks: `자동분석 추천 (마지막 판매: ${item.lastSoldDate || '없음'})`,
        actionPlan: "",
        targetMonth: selectedMonth,
      };

      const response = await apiFetch(`/api/dashboard/long-term-inventory`, {
        method: "POST",
        body: JSON.stringify(newItem),
      });

      const result = await response.json();
      if (result.success) {
        fetchData();
        setActiveTab('managed');
      }
    } catch (error) {
      console.error("Failed to register recommended item:", error);
      alert("등록에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!data?.savedItems) return [];

    let filtered = data.savedItems;

    if (activeCategory !== "전체") {
      filtered = filtered.filter(item => item.category === activeCategory);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(item =>
        item.itemCode.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        item.warehouse.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [data?.savedItems, search, activeCategory]);

  const handleExcelDownload = () => {
    if (filteredItems.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    // Convert saved items to export format
    const exportData = filteredItems.map(item => ({
      '품목코드': item.itemCode,
      '품목명': item.itemName,
      '분류': item.category,
      '규격': item.spec,
      '사업소': item.warehouse,
      '수량': item.quantity,
      '단위': item.unit,
      '비고': item.remarks,
      '조치계획': item.actionPlan,
      '대상월': item.targetMonth,
    }));

    const filename = `long-term-inventory-${selectedMonth}.xlsx`;
    exportToExcel(exportData, filename);
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            사업소별 장기재고 현황
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            사업소별로 과다 적치된 장기재고 품목을 입력하고 관리합니다
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 shadow-sm">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">조회 월:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 font-bold cursor-pointer"
            />
          </div>

          <ExcelDownloadButton
            onClick={handleExcelDownload}
            disabled={filteredItems.length === 0}
          />
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-500" /> 신규 장기재고 등록
        </h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-1.5 relative">
              <label className="text-xs font-medium text-zinc-500">품목 선택</label>
              <div className="relative">
                <div 
                  onClick={() => setIsItemSelectOpen(!isItemSelectOpen)}
                  className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 cursor-pointer flex justify-between items-center"
                >
                  <span className={selectedItem ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}>
                    {selectedItem ? `[${selectedItem.category}] ${selectedItem.item_name}` : "품목을 검색하여 선택하세요"}
                  </span>
                  <Search className="w-3.5 h-3.5 text-zinc-400" />
                </div>

                {isItemSelectOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 max-h-[300px] flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                      <input
                        type="text"
                        autoFocus
                        placeholder="품목명 또는 코드 검색..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="overflow-y-auto py-1">
                      {itemSearch ? (
                        filteredItemOptions.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-zinc-400 text-center">검색 결과가 없습니다</div>
                        ) : (
                          filteredItemOptions.map(it => (
                            <div
                              key={it.품목코드}
                              onClick={() => {
                                setSelectedItemCode(it.품목코드);
                                setItemSearch("");
                                setIsItemSelectOpen(false);
                              }}
                              className="px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer flex flex-col"
                            >
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">{it.item_name}</span>
                              <span className="text-[10px] text-zinc-400">[{it.category}] {it.품목코드} / {it.spec}</span>
                            </div>
                          ))
                        )
                      ) : (
                        Object.entries(groupedItems).map(([cat, items]) => (
                          <div key={cat}>
                            <div className="px-3 py-1 bg-zinc-50 dark:bg-zinc-800/50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{cat}</div>
                            {items.slice(0, 50).map(it => (
                              <div
                                key={it.품목코드}
                                onClick={() => {
                                  setSelectedItemCode(it.품목코드);
                                  setIsItemSelectOpen(false);
                                }}
                                className="px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer flex flex-col"
                              >
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">{it.item_name}</span>
                                <span className="text-[10px] text-zinc-400">{it.품목코드} / {it.spec}</span>
                              </div>
                            ))}
                            {items.length > 50 && (
                              <div className="px-3 py-1 text-[9px] text-zinc-400 italic">검색하여 더 많은 항목을 찾으세요...</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {isItemSelectOpen && (
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => {
                    setIsItemSelectOpen(false);
                    setItemSearch("");
                  }}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">사업소(창고)</label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">사업소를 선택하세요</option>
                {data?.warehouses.map(wh => (
                  <option key={wh} value={wh}>{wh}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">수량</label>
              <input
                type="number"
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value))}
                placeholder="수량 입력"
                className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">단위</label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">단위 선택</option>
                {data?.units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
                <option value="D/M">D/M</option>
                <option value="EA">EA</option>
                <option value="CAN">CAN</option>
              </select>
            </div>

            <div className="hidden lg:block"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2 lg:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">비고</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="비고 입력"
                className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">{selectedMonth.split('-')[1]}월 처리방안</label>
              <input
                type="text"
                value={actionPlan}
                onChange={(e) => setActionPlan(e.target.value)}
                placeholder="처리방안 입력"
                className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="h-[38px] flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              등록하기
            </button>
          </div>
        </form>
      </div>

      {/* List section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
              <button
                onClick={() => setActiveTab('managed')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'managed'
                    ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <Package className="w-4 h-4" />
                관리 목록 ({filteredItems.length})
              </button>
              <button
                onClick={() => setActiveTab('recommended')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'recommended'
                    ? "bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <Calculator className="w-4 h-4" />
                분석 추천 ({data?.recommendations?.length || 0})
              </button>
            </div>

            {activeTab === 'managed' && (
              <>
                <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-2" />
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        activeCategory === cat
                          ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={handleCarryOver}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-semibold rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700"
                  title="지난달 목록 불러오기"
                >
                  <Plus className="w-3 h-3" /> 지난달 복사
                </button>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 shadow-sm min-w-[300px]">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="품목, 사업소 검색..."
              className="text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 w-full"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {activeTab === 'managed' ? (
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80">
                  <tr>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">구분</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">제품명</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">규격</th>
                    <th className="py-3 px-4 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">전재고</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">비고</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{selectedMonth.split('-')[1]}월 처리방안</th>
                    <th className="py-3 px-4 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-400">
                        {activeCategory === "전체" 
                          ? "등록된 장기재고가 없습니다." 
                          : `${activeCategory} 카테고리에 등록된 장기재고가 없습니다.`}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                        <td className="py-3 px-4">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.category === 'IL' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                            item.category === 'AL' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                            'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.itemName}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">{item.itemCode}</p>
                          <p className="text-[10px] text-blue-500 font-medium mt-0.5">{item.warehouse}</p>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 text-xs">
                          {item.spec}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {fmt(item.quantity)} <span className="text-[10px] text-zinc-400 font-normal ml-0.5">{item.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 text-xs min-w-[150px]">
                          <EditableCell 
                            value={item.remarks} 
                            onSave={(val) => handleUpdate(item.id, { remarks: val })}
                          />
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 text-xs min-w-[200px]">
                          <EditableCell 
                            value={item.actionPlan} 
                            onSave={(val) => handleUpdate(item.id, { actionPlan: val })}
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80">
                  <tr>
                    <th className="py-3 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">제품명</th>
                    <th className="py-3 px-4 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">현재 재고</th>
                    <th className="py-3 px-4 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">마지막 판매일</th>
                    <th className="py-3 px-4 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">회전율 (6개월)</th>
                    <th className="py-3 px-4 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">상태</th>
                    <th className="py-3 px-4 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data?.recommendations?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-400">
                        자동분석된 장기재고 추천 항목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    data?.recommendations.map((item) => (
                      <tr key={`${item.itemCode}-${item.warehouse}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                        <td className="py-3 px-4">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.itemName}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">{item.itemCode}</p>
                          <p className="text-[10px] text-blue-500 font-medium mt-0.5">{item.warehouse}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {fmt(item.quantity)}
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400 text-xs">
                          {item.lastSoldDate || <span className="text-red-500 font-semibold">판매기록 없음</span>}
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-600 dark:text-zinc-400 text-xs font-mono">
                          {item.turnoverRatio.toFixed(3)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            !item.lastSoldDate || item.turnoverRatio === 0 
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40' 
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40'
                          }`}>
                            {!item.lastSoldDate || item.turnoverRatio === 0 ? '데드스탁' : '저회전'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRegisterRecommended(item)}
                            disabled={isSaving}
                            className="px-2 py-1 bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 rounded text-[10px] font-bold transition-colors"
                          >
                            관리목록 등록
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
