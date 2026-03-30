"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Filter, Loader2, TrendingUp, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import VatToggle from '@/components/VatToggle';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface PurchaseItem {
  branch: string;
  person_in_charge: string;
  vendor: string;
  item_name: string;
  item_code: string;
  quantity: number;
  unit_price: number;
  supply_amount: number;
}

interface GroupedData {
  [branch: string]: {
    [person: string]: {
      [vendor: string]: PurchaseItem[];
    };
  };
}

const BRANCHES = ['all', 'MB', '화성', '창원', '남부', '중부', '서부', '동부', '제주', '부산'];

interface SalesProfitItem {
  id: number;
  branch: string;
  품목코드: string;
  품목명: string;
  판매수량: number;
  판매단가: number;
  판매금액: number;
  원가단가: number;
  원가금액: number;
  이익단가: number;
  이익금액: number;
  이익율: number;
}

// ── Helpers ──

function parseNumeric(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function fmt(val: number): string {
  return val.toLocaleString();
}

function fmtCurrency(val: number): string {
  if (val === 0) return "-";
  return "₩" + val.toLocaleString();
}

// ── Page ──

export default function B2BDailySalesAnalysisPage() {
  const { includeVat } = useVatInclude();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [branch, setBranch] = useState('all');
  const [data, setData] = useState<PurchaseItem[]>([]);
  const [profitData, setProfitData] = useState<SalesProfitItem[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfit, setIsLoadingLoadingProfit] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [activeView, setActiveTab] = useState<'hierarchy' | 'profit'>('profit');
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [expandedProfitBranches, setExpandedProfitBranches] = useState<Set<string>>(new Set());

  const groupedProfitData = useMemo(() => {
    const grouped: { [branch: string]: SalesProfitItem[] } = {};
    profitData.forEach(item => {
      const b = item.branch || '기타';
      if (!grouped[b]) grouped[b] = [];
      grouped[b].push(item);
    });
    return grouped;
  }, [profitData]);

  const profitTotals = useMemo(() => {
    return profitData.reduce((acc, row) => ({
      quantity: acc.quantity + parseNumeric(row.판매수량),
      amount: acc.amount + parseNumeric(row.판매금액),
      profit: acc.profit + parseNumeric(row.이익금액),
    }), { quantity: 0, amount: 0, profit: 0 });
  }, [profitData]);

  const avgProfitRate = useMemo(() => {
    if (profitTotals.amount === 0) return 0;
    return (profitTotals.profit / profitTotals.amount) * 100;
  }, [profitTotals]);

  useEffect(() => {
    if (activeView === 'hierarchy') {
      fetchData();
    } else {
      fetchProfitData();
    }
  }, [date, branch, activeView, includeVat]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ date, branch });
      params.set('includeVat', String(includeVat));
      const response = await apiFetch(`/api/dashboard/b2b-daily-sales?${params}`);
      const result = await response.json();

      if (result.success) {
        const items = result.data || [];
        setData(items);

        // Group data hierarchically
        const grouped: GroupedData = {};
        items.forEach((item: PurchaseItem) => {
          if (!grouped[item.branch]) grouped[item.branch] = {};
          if (!grouped[item.branch][item.person_in_charge]) grouped[item.branch][item.person_in_charge] = {};
          if (!grouped[item.branch][item.person_in_charge][item.vendor]) {
            grouped[item.branch][item.person_in_charge][item.vendor] = [];
          }
          grouped[item.branch][item.person_in_charge][item.vendor].push(item);
        });
        setGroupedData(grouped);
      } else {
        setData([]);
        setGroupedData({});
      }
    } catch (error) {
      console.error('Failed to fetch B2B daily purchase data:', error);
      setData([]);
      setGroupedData({});
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfitData = async () => {
    setIsLoadingLoadingProfit(true);
    try {
      const params = new URLSearchParams({ date });
      params.set('includeVat', String(includeVat));
      const response = await apiFetch(`/api/dashboard/b2b-daily-sales/profit?${params}`);
      const result = await response.json();

      if (result.success) {
        setProfitData(result.data || []);
      } else {
        setProfitData([]);
      }
    } catch (error) {
      console.error('Failed to fetch sales profit data:', error);
      setProfitData([]);
    } finally {
      setIsLoadingLoadingProfit(false);
    }
  };

  const toggleBranch = (branch: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branch)) {
      newExpanded.delete(branch);
    } else {
      newExpanded.add(branch);
    }
    setExpandedBranches(newExpanded);
  };

  const togglePerson = (key: string) => {
    const newExpanded = new Set(expandedPersons);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedPersons(newExpanded);
  };

  const toggleVendor = (key: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedVendors(newExpanded);
  };

  const toggleProfitBranch = (branch: string) => {
    const newExpanded = new Set(expandedProfitBranches);
    if (newExpanded.has(branch)) {
      newExpanded.delete(branch);
    } else {
      newExpanded.add(branch);
    }
    setExpandedProfitBranches(newExpanded);
  };

  const expandAllHierarchy = () => {
    const branches = new Set(Object.keys(groupedData));
    const persons = new Set<string>();
    const vendors = new Set<string>();

    Object.entries(groupedData).forEach(([b, pData]) => {
      Object.entries(pData).forEach(([p, vData]) => {
        persons.add(`${b}-${p}`);
        Object.keys(vData).forEach(v => {
          vendors.add(`${b}-${p}-${v}`);
        });
      });
    });

    setExpandedBranches(branches);
    setExpandedPersons(persons);
    setExpandedVendors(vendors);
  };

  const collapseAllHierarchy = () => {
    setExpandedBranches(new Set());
    setExpandedPersons(new Set());
    setExpandedVendors(new Set());
  };

  const expandAllProfit = () => {
    setExpandedProfitBranches(new Set(Object.keys(groupedProfitData)));
  };

  const collapseAllProfit = () => {
    setExpandedProfitBranches(new Set());
  };

  const handleExcelDownload = () => {
    if (activeView === 'hierarchy') {
      if (data.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
      }

      const exportData = data.map(row => ({
        '사업소': row.branch,
        '담당자': row.person_in_charge,
        '구매처': row.vendor,
        '품목명': row.item_name,
        '품목코드': row.item_code,
        '수량': row.quantity,
        '단가': row.unit_price,
        '공급가': row.supply_amount,
      }));

      const filename = generateFilename(`B2B사업소일일구매현황_${date}_${branch}`);
      
      const { exportIslandTables } = require('@/lib/excel-export');
      const headers = Object.keys(exportData[0]);
      const rows = exportData.map(row => headers.map(h => (row as any)[h]));
      
      exportIslandTables(
        [{ title: 'B2B 사업소 일일 구매 현황', headers, data: rows }],
        filename,
        date
      );
    } else {
      if (profitData.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
      }

      const exportData = profitData.map(row => ({
        '사업소': row.branch,
        '품목코드': row.품목코드,
        '품목명': row.품목명,
        '판매수량': parseNumeric(row.판매수량),
        '판매단가': parseNumeric(row.판매단가),
        '판매금액': parseNumeric(row.판매금액),
        '원가단가': parseNumeric(row.원가단가),
        '원가금액': parseNumeric(row.원가금액),
        '이익단가': parseNumeric(row.이익단가),
        '이익금액': parseNumeric(row.이익금액),
        '이익율': parseNumeric(row.이익율),
      }));

      const filename = generateFilename(`B2B사업소일일이익현황_${date}`);
      const { exportIslandTables } = require('@/lib/excel-export');
      const headers = Object.keys(exportData[0]);
      const rows = exportData.map(row => headers.map(h => (row as any)[h]));
      
      exportIslandTables(
        [{ title: 'B2B 사업소 일일 이익 현황 (sales_profit)', headers, data: rows }],
        filename,
        date
      );
    }
  };

  // Calculate totals
  const totals = data.reduce((acc, row) => ({
    quantity: acc.quantity + row.quantity,
    supply_amount: acc.supply_amount + row.supply_amount,
  }), {
    quantity: 0,
    supply_amount: 0,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            B2B사업소 일일매출 분석
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            사업소별 매출 분석 
          </p>
        </div>

        <div className="flex items-center gap-3">
          <VatToggle id="vat-b2b-daily-sales" />
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl mr-2">
            <button
              onClick={() => setActiveTab('profit')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeView === 'profit'
                  ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              이익 분석 (sales_profit)
            </button>
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeView === 'hierarchy'
                  ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              계층별 구매
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={(activeView === 'hierarchy' ? data.length === 0 : profitData.length === 0) || isLoading || isLoadingProfit} />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                일자
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Branch - Hide if in Profit Analysis mode as it's not in the schema */}
            {activeView === 'hierarchy' && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  <Building2 className="w-4 h-4 inline mr-2" />
                  사업소
                </label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  {BRANCHES.map(b => (
                    <option key={b} value={b}>
                      {b === 'all' ? '전체' : b}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            {activeView === 'hierarchy' ? '총 구매수량' : '총 판매수량'}
          </p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {activeView === 'hierarchy' 
              ? totals.quantity.toLocaleString() 
              : profitTotals.quantity.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            {activeView === 'hierarchy' ? '총 공급가액' : '총 판매금액'}
          </p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            ₩{activeView === 'hierarchy' 
              ? totals.supply_amount.toLocaleString() 
              : profitTotals.amount.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            {activeView === 'hierarchy' ? '구매 항목수' : '총 이익금액'}
          </p>
          <p className={`text-xl font-bold ${activeView === 'hierarchy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {activeView === 'hierarchy' 
              ? data.length.toLocaleString() + '개'
              : '₩' + profitTotals.profit.toLocaleString()}
          </p>
        </div>
        {activeView === 'profit' && (
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">평균 이익율</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {avgProfitRate.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {activeView === 'hierarchy' 
              ? `구매 현황 (${data.length.toLocaleString()}개 항목)`
              : `이익 분석 (sales_profit table - ${profitData.length.toLocaleString()}개 항목)`}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={activeView === 'hierarchy' ? expandAllHierarchy : expandAllProfit}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            >
              모두 펼치기
            </button>
            <button
              onClick={activeView === 'hierarchy' ? collapseAllHierarchy : collapseAllProfit}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              모두 접기
            </button>
          </div>
        </div>

        {isLoading || isLoadingProfit ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-zinc-500">데이터를 불러오는 중...</p>
          </div>
        ) : activeView === 'hierarchy' ? (
          Object.keys(groupedData).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <TrendingUp className="w-12 h-12 mb-3 opacity-50" />
              <p>조회된 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {Object.entries(groupedData).map(([branchName, personsData]) => (
                <div key={branchName}>
                  {/* Branch Level */}
                  <div
                    className="px-6 py-3 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 cursor-pointer flex items-center justify-between transition-colors"
                    onClick={() => toggleBranch(branchName)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedBranches.has(branchName) ? (
                        <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                      <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="font-bold text-blue-900 dark:text-blue-100">{branchName}</span>
                    </div>
                  </div>

                  {/* Persons under Branch */}
                  {expandedBranches.has(branchName) && Object.entries(personsData).map(([personName, vendorsData]) => (
                    <div key={`${branchName}-${personName}`}>
                      <div
                        className="px-12 py-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/30 cursor-pointer flex items-center gap-3 transition-colors"
                        onClick={() => togglePerson(`${branchName}-${personName}`)}
                      >
                        {expandedPersons.has(`${branchName}-${personName}`) ? (
                          <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span className="font-semibold text-emerald-900 dark:text-emerald-100">{personName}</span>
                      </div>

                      {/* Vendors under Person */}
                      {expandedPersons.has(`${branchName}-${personName}`) && Object.entries(vendorsData).map(([vendorName, items]) => {
                        const vendorTotal = items.reduce((acc, item) => ({
                          quantity: acc.quantity + item.quantity,
                          supply_amount: acc.supply_amount + item.supply_amount
                        }), { quantity: 0, supply_amount: 0 });

                        return (
                          <div key={`${branchName}-${personName}-${vendorName}`}>
                            <div
                              className="px-20 py-2 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30 cursor-pointer flex items-center justify-between transition-colors"
                              onClick={() => toggleVendor(`${branchName}-${personName}-${vendorName}`)}
                            >
                              <div className="flex items-center gap-3">
                                {expandedVendors.has(`${branchName}-${personName}-${vendorName}`) ? (
                                  <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                )}
                                <span className="font-medium text-amber-900 dark:text-amber-100">{vendorName}</span>
                              </div>
                              <div className="flex gap-6 text-xs">
                                <span className="text-zinc-600 dark:text-zinc-400">
                                  수량: <span className="font-semibold">{vendorTotal.quantity.toLocaleString()}</span>
                                </span>
                                <span className="text-zinc-600 dark:text-zinc-400">
                                  공급가: <span className="font-semibold">₩{vendorTotal.supply_amount.toLocaleString()}</span>
                                </span>
                              </div>
                            </div>

                            {/* Items under Vendor */}
                            {expandedVendors.has(`${branchName}-${personName}-${vendorName}`) && (
                              <div className="bg-zinc-50 dark:bg-zinc-900/50">
                                <table className="w-full text-sm">
                                  <thead className="bg-zinc-100 dark:bg-zinc-800/50">
                                    <tr>
                                      <th className="px-28 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300">품목명</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">수량</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">단가</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">공급가</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                    {items.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                        <td className="px-28 py-2 text-zinc-900 dark:text-zinc-100">{item.item_name}</td>
                                        <td className="px-4 py-2 text-right text-zinc-700 dark:text-zinc-300">{item.quantity.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right text-zinc-700 dark:text-zinc-300">₩{item.unit_price.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">₩{item.supply_amount.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300">사업소 / 품목</th>
                  <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300 text-right">판매수량</th>
                  <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300 text-right">판매단가</th>
                  <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300 text-right">판매금액</th>
                  <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300 text-right">원가단가</th>
                  <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300 text-right">원가금액</th>
                  <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300 text-right font-bold text-rose-600">이익금액</th>
                  <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-bold text-zinc-600 dark:text-zinc-300 text-right">이익율(%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {Object.keys(groupedProfitData).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-zinc-400">조회된 이익 분석 데이터가 없습니다</td>
                  </tr>
                ) : (
                  Object.entries(groupedProfitData).map(([branchName, items]) => {
                    const branchTotal = items.reduce((acc, item) => ({
                      quantity: acc.quantity + parseNumeric(item.판매수량),
                      amount: acc.amount + parseNumeric(item.판매금액),
                      cost: acc.cost + parseNumeric(item.원가금액),
                      profit: acc.profit + parseNumeric(item.이익금액)
                    }), { quantity: 0, amount: 0, cost: 0, profit: 0 });
                    
                    const branchProfitRate = branchTotal.amount > 0 ? (branchTotal.profit / branchTotal.amount) * 100 : 0;

                    return (
                      <React.Fragment key={branchName}>
                        {/* Branch Row */}
                        <tr 
                          className="bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                          onClick={() => toggleProfitBranch(branchName)}
                        >
                          <td className="px-3 py-2 font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                            {expandedProfitBranches.has(branchName) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            <Building2 className="w-4 h-4" />
                            {branchName}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">{fmt(branchTotal.quantity)}</td>
                          <td className="px-3 py-2 text-right"></td>
                          <td className="px-3 py-2 text-right font-bold text-blue-600">{fmtCurrency(branchTotal.amount)}</td>
                          <td className="px-3 py-2 text-right"></td>
                          <td className="px-3 py-2 text-right font-bold">{fmtCurrency(branchTotal.cost)}</td>
                          <td className="px-3 py-2 text-right font-bold text-rose-600">{fmtCurrency(branchTotal.profit)}</td>
                          <td className="px-3 py-2 text-right font-bold">
                            <span className={`px-1.5 py-0.5 rounded ${branchProfitRate >= 20 ? 'bg-green-100 text-green-700' : branchProfitRate <= 5 ? 'bg-red-100 text-red-700' : ''}`}>
                              {branchProfitRate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>

                        {/* Item Rows under Branch */}
                        {expandedProfitBranches.has(branchName) && items.map((row) => (
                          <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-l-4 border-blue-200 dark:border-blue-800">
                            <td className="px-6 py-2">
                              <div className="flex flex-col">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">{row.품목명}</span>
                                <span className="text-[10px] text-zinc-500">{row.품목코드}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{fmt(parseNumeric(row.판매수량))}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmtCurrency(parseNumeric(row.판매단가))}</td>
                            <td className="px-3 py-2 text-right font-mono text-blue-600">{fmtCurrency(parseNumeric(row.판매금액))}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmtCurrency(parseNumeric(row.원가단가))}</td>
                            <td className="px-3 py-2 text-right font-mono">{fmtCurrency(parseNumeric(row.원가금액))}</td>
                            <td className="px-3 py-2 text-right font-mono text-rose-600 font-semibold">{fmtCurrency(parseNumeric(row.이익금액))}</td>
                            <td className="px-3 py-2 text-right font-mono font-medium">
                              <span className={`px-1.5 py-0.5 rounded ${parseNumeric(row.이익율) >= 0.2 ? 'bg-green-100/50 text-green-700' : parseNumeric(row.이익율) <= 0.05 ? 'bg-red-100/50 text-red-700' : ''}`}>
                                {(parseNumeric(row.이익율) * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
