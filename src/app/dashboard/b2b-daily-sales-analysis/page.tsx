"use client";

import { useState, useEffect } from 'react';
import { Calendar, Filter, Loader2, TrendingUp, Building2, ChevronDown, ChevronRight } from 'lucide-react';
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

export default function B2BDailySalesAnalysisPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [branch, setBranch] = useState('all');
  const [data, setData] = useState<PurchaseItem[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [date, branch]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ date, branch });
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

  const handleExcelDownload = () => {
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
    exportToExcel(exportData, filename);
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
            사업소별 매출 분석 (사업소 → 담당자 → 구매처 → 품목)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={data.length === 0 || isLoading} />
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

            {/* Branch */}
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
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">총 구매수량</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {totals.quantity.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">총 공급가액</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            ₩{totals.supply_amount.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">구매 항목수</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {data.length.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            구매 현황 ({data.length.toLocaleString()}개 항목)
          </h3>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-zinc-500">데이터를 불러오는 중...</p>
          </div>
        ) : Object.keys(groupedData).length === 0 ? (
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
        )}
      </div>
    </div>
  );
}
