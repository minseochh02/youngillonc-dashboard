"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart, Archive, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface CategoryBreakdown {
  category: string;
  purchase_weight: number;
  sales_weight: number;
  inventory_weight: number;
}

interface MonthlyData {
  month: string;
  purchase_weight: number;
  purchase_amount: number;
  sales_weight: number;
  sales_amount: number;
  inventory_weight: number;
  inventory_amount: number;
  target_weight: number;
  achievement_rate: number;
  yoy_growth_rate: number;
  breakdown: CategoryBreakdown[];
}

interface MonthlySummary {
  currentYear: string;
  monthlyData: MonthlyData[];
  currentMonthData: MonthlyData;
  yearToDate: {
    purchase_weight: number;
    purchase_amount: number;
    sales_weight: number;
    sales_amount: number;
    inventory_weight: number;
    inventory_amount: number;
    target_weight: number;
    achievement_rate: number;
  };
}

interface MonthlySummaryProps {
  selectedMonth?: string;
}

export default function MonthlySummaryTab({ selectedMonth }: MonthlySummaryProps) {
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [editingTargets, setEditingTargets] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = `/api/dashboard/closing-meeting?tab=monthly-summary${selectedMonth ? `&month=${selectedMonth}` : ''}`;
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch monthly summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString();
  };

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(month)) {
      newExpanded.delete(month);
    } else {
      newExpanded.add(month);
    }
    setExpandedMonths(newExpanded);
  };

  const expandAll = () => {
    const allMonths = new Set(data?.monthlyData.map(m => m.month));
    setExpandedMonths(allMonths);
  };

  const collapseAll = () => {
    setExpandedMonths(new Set());
  };

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    data.monthlyData.forEach(month => {
      // Add main month row
      exportData.push({
        '월': month.month,
        '구분': '합계',
        '구매용량(L)': month.purchase_weight,
        '판매용량(L)': month.sales_weight,
        '재고용량(L)': month.inventory_weight,
        '목표용량(L)': month.target_weight,
        '달성율(%)': (month.achievement_rate ?? 0).toFixed(1),
        '전년대비(%)': (month.yoy_growth_rate ?? 0).toFixed(1),
      });

      // Add category breakdown
      month.breakdown.forEach(cat => {
        exportData.push({
          '월': '',
          '구분': cat.category,
          '구매용량(L)': cat.purchase_weight,
          '판매용량(L)': cat.sales_weight,
          '재고용량(L)': cat.inventory_weight,
          '목표용량(L)': cat.target_weight,
          '달성율(%)': (cat.achievement_rate ?? 0).toFixed(1),
          '전년대비(%)': '',
        });
      });
    });

    // Add year-to-date summary
    exportData.push({
      '월': '연누계',
      '구분': '합계',
      '구매용량(L)': data.yearToDate.purchase_weight,
      '판매용량(L)': data.yearToDate.sales_weight,
      '재고용량(L)': data.yearToDate.inventory_weight,
      '목표용량(L)': data.yearToDate.target_weight,
      '달성율(%)': (data.yearToDate.achievement_rate ?? 0).toFixed(1),
      '전년대비(%)': '-',
    });

    const filename = generateFilename('마감회의_월간총괄');
    exportToExcel(exportData, filename);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400 p-8">
        <p>데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  const currentMonth = data.currentMonthData;

  return (
    <div className="space-y-6">
      {/* Current Month Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Purchase */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              구매 ({currentMonth.month})
            </h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">용량</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatNumber(currentMonth.purchase_weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">금액</p>
              <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                {formatNumber(currentMonth.purchase_amount)} 원
              </p>
            </div>
          </div>
        </div>

        {/* Sales */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              판매 ({currentMonth.month})
            </h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">용량</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatNumber(currentMonth.sales_weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">금액</p>
              <p className="text-lg font-semibold text-green-700 dark:text-blue-300">
                {formatNumber(currentMonth.sales_amount)} 원
              </p>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              재고 (구매-판매)
            </h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">용량</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatNumber(currentMonth.inventory_weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">금액</p>
              <p className="text-lg font-semibold text-purple-700 dark:text-blue-300">
                {formatNumber(currentMonth.inventory_amount)} 원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">목표 달성율</p>
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                {(currentMonth.achievement_rate ?? 0).toFixed(1)}%
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                목표: {formatNumber(currentMonth.target_weight)} L
              </p>
            </div>
            <div className={`p-4 rounded-full ${
              (currentMonth.achievement_rate ?? 0) >= 100
                ? 'bg-green-100 dark:bg-green-900/30'
                : (currentMonth.achievement_rate ?? 0) >= 80
                ? 'bg-yellow-100 dark:bg-yellow-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              <Package className={`w-8 h-8 ${
                (currentMonth.achievement_rate ?? 0) >= 100
                  ? 'text-green-600 dark:text-green-400'
                  : (currentMonth.achievement_rate ?? 0) >= 80
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">전년 대비</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {(currentMonth.yoy_growth_rate ?? 0) >= 0 ? '+' : ''}{(currentMonth.yoy_growth_rate ?? 0).toFixed(1)}%
                </p>
              </div>
            </div>
            <div className={`p-4 rounded-full ${
              (currentMonth.yoy_growth_rate ?? 0) >= 0
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              {(currentMonth.yoy_growth_rate ?? 0) >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Table with Breakdown */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">월별 실적 ({data.currentYear}년)</h4>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            >
              모두 펼치기
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              모두 접기
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-24">월</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32">구분</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-500 uppercase tracking-wider">구매(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-green-500 uppercase tracking-wider">판매(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-purple-500 uppercase tracking-wider">재고(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">목표(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">달성율</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전년대비</th>
              </tr>
            </thead>
            <tbody>
              {/* Year to Date Summary Row - First */}
              <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold border-b-2 border-blue-300 dark:border-blue-700">
                <td className="py-3 px-4 text-blue-900 dark:text-blue-100">합계</td>
                <td className="py-3 px-4 text-blue-900 dark:text-blue-100">연누계</td>
                <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300">
                  {formatNumber(data.yearToDate.purchase_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-green-700 dark:text-green-300">
                  {formatNumber(data.yearToDate.sales_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-purple-700 dark:text-purple-300">
                  {formatNumber(data.yearToDate.inventory_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                  {formatNumber(data.yearToDate.target_weight)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`font-bold ${
                    (data.yearToDate.achievement_rate ?? 0) >= 100
                      ? 'text-green-600'
                      : (data.yearToDate.achievement_rate ?? 0) >= 80
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}>
                    {(data.yearToDate.achievement_rate ?? 0).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-zinc-500">-</td>
              </tr>

              {/* Monthly Data - Reverse order (current month first, January last) */}
              {[...data.monthlyData]
                .reverse()
                .map((month) => {
                const isExpanded = expandedMonths.has(month.month);
                return (
                  <Fragment key={month.month}>
                    {/* Main month row */}
                    <tr
                      className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => toggleMonth(month.month)}
                    >
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          )}
                          {month.month}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                        합계
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                        {formatNumber(month.purchase_weight)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-green-700 dark:text-green-300 font-semibold">
                        {formatNumber(month.sales_weight)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-purple-700 dark:text-purple-300 font-semibold">
                        {formatNumber(month.inventory_weight)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(month.target_weight)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${
                          (month.achievement_rate ?? 0) >= 100
                            ? 'text-green-600'
                            : (month.achievement_rate ?? 0) >= 80
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {(month.achievement_rate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium ${
                          (month.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(month.yoy_growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {(month.yoy_growth_rate ?? 0) >= 0 ? '+' : ''}{(month.yoy_growth_rate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                    </tr>

                    {/* Category breakdown rows */}
                    {isExpanded && month.breakdown.map((cat) => (
                      <tr
                        key={`${month.month}-${cat.category}`}
                        className="border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/20"
                      >
                        <td className="py-2 px-4"></td>
                        <td className="py-2 px-4 pl-8 text-zinc-700 dark:text-zinc-300 text-xs">
                          {cat.category}
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-blue-600 dark:text-blue-400 text-xs">
                          {formatNumber(cat.purchase_weight)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-green-600 dark:text-green-400 text-xs">
                          {formatNumber(cat.sales_weight)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-purple-600 dark:text-purple-400 text-xs">
                          {formatNumber(cat.inventory_weight)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-zinc-500 dark:text-zinc-400 text-xs">
                          {formatNumber(cat.target_weight)}
                        </td>
                        <td className="py-2 px-4 text-right text-zinc-500 dark:text-zinc-400 text-xs">
                          {(cat.achievement_rate ?? 0).toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 text-right text-zinc-400 text-xs">-</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formula Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">계산 공식:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>재고 = 구매 - 판매</li>
          <li>달성율 = (판매 / 목표) × 100</li>
          <li>전년대비 = ((당년 판매 - 전년 판매) / 전년 판매) × 100</li>
        </ul>
        <p className="font-semibold mt-3 mb-1">분류:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>MB: 메르세데스 벤츠</li>
          <li>AVI + MAR: 항공 + 해양</li>
          <li>AUTO: 자동차</li>
          <li>IL: 산업용 윤활유</li>
        </ul>
      </div>
    </div>
  );
}
