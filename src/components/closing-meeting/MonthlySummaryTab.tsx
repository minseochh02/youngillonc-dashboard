"use client";

import { useState, useEffect, useRef, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';

interface CategoryBreakdown {
  category: string;
  purchase_weight: number;
  sales_weight: number;
  inventory_weight: number;
  target_weight?: number;
  achievement_rate?: number;
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
  lastYear: string;
  currentMonth: string;
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
    categoryBreakdown?: CategoryBreakdown[];
    autoBreakdown?: {
      PVL: { sales_weight: number; purchase_weight: number };
      CVL: { sales_weight: number; purchase_weight: number };
    };
  };
  lastYearToDate: {
    purchase_weight: number;
    purchase_amount: number;
    sales_weight: number;
    sales_amount: number;
    inventory_weight: number;
    inventory_amount: number;
    categoryBreakdown: Array<{
      category: string;
      purchase_weight: number;
      sales_weight: number;
      inventory_weight: number;
    }>;
    autoBreakdown?: {
      PVL: { sales_weight: number; purchase_weight: number };
      CVL: { sales_weight: number; purchase_weight: number };
    };
  };
}

interface MonthlySummaryProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function MonthlySummaryTab({ selectedMonth, onMonthsAvailable }: MonthlySummaryProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState<number[]>([]);
  const hasReportedMonths = useRef(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, includeVat]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/closing-meeting?tab=monthly-summary${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // Report available months to parent only once
        if (onMonthsAvailable && result.data.availableMonths && !hasReportedMonths.current) {
          hasReportedMonths.current = true;
          onMonthsAvailable(result.data.availableMonths, result.data.currentMonth);
        }
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

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
  };

  const getCategoryLabel = (category: string) => {
    if (category === 'AUTO') return 'AUTO(PVL+CVL)';
    return category;
  };

  useEffect(() => {
    if (!data || expandedYears.length > 0) return;
    const cutoffMonth = Number(data.currentMonth.split('-')[1]);
    const years = Array.from(
      new Set(
        data.monthlyData
          .map((row) => {
            const [yearStr, monthStr] = row.month.split('-');
            const year = Number(yearStr);
            const month = Number(monthStr);
            return year && month && month <= cutoffMonth ? year : null;
          })
          .filter((year): year is number => year !== null)
      )
    ).sort((a, b) => b - a);
    if (years.length > 0) {
      setExpandedYears([years[0]]);
    }
  }, [data, expandedYears.length]);

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

  const { currentYear, lastYear, yearToDate, lastYearToDate } = data;
  const displayMonth = parseInt(data.currentMonth.split('-')[1]);
  const cumulativePeriod = `1월~${displayMonth}월 누계`;
  const cutoffMonth = displayMonth;

  const cumulativeMetricsByYear = data.monthlyData.reduce((acc, row) => {
    const [yearStr, monthStr] = row.month.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month || month > cutoffMonth) return acc;
    const prev = acc.get(year) || { purchase: 0, sales: 0 };
    acc.set(year, {
      purchase: prev.purchase + row.purchase_weight,
      sales: prev.sales + row.sales_weight,
    });
    return acc;
  }, new Map<number, { purchase: number; sales: number }>());

  const yearlyPurchaseCards = Array.from(cumulativeMetricsByYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, metrics]) => {
      const prevMetrics = cumulativeMetricsByYear.get(year - 1);
      const purchaseChange = prevMetrics ? calculateChange(metrics.purchase, prevMetrics.purchase) : null;
      const salesChange = prevMetrics ? calculateChange(metrics.sales, prevMetrics.sales) : null;
      return {
        year,
        purchase: Math.round(metrics.purchase),
        sales: Math.round(metrics.sales),
        prevPurchase: prevMetrics ? Math.round(prevMetrics.purchase) : null,
        prevSales: prevMetrics ? Math.round(prevMetrics.sales) : null,
        purchaseChange,
        salesChange,
      };
    });
  const categories = ['MB', 'AVI', 'MAR', 'AUTO', 'IL', '기타'];
  const yearlyCategoryMap = data.monthlyData.reduce((acc, row) => {
    const [yearStr, monthStr] = row.month.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month || month > cutoffMonth) return acc;
    if (!acc.has(year)) {
      const init = new Map<string, { sales: number; purchase: number; target: number }>();
      categories.forEach((cat) => init.set(cat, { sales: 0, purchase: 0, target: 0 }));
      acc.set(year, init);
    }
    const yearAgg = acc.get(year)!;
    row.breakdown.forEach((b) => {
      const agg = yearAgg.get(b.category);
      if (!agg) return;
      agg.sales += b.sales_weight || 0;
      agg.purchase += b.purchase_weight || 0;
      agg.target += b.target_weight || 0;
    });
    return acc;
  }, new Map<number, Map<string, { sales: number; purchase: number; target: number }>>());
  const yearlyMonthlyBreakdownMap = data.monthlyData.reduce((acc, row) => {
    const [yearStr, monthStr] = row.month.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month || month > cutoffMonth) return acc;
    if (!acc.has(year)) acc.set(year, []);
    acc.get(year)!.push(row);
    return acc;
  }, new Map<number, MonthlyData[]>());
  yearlyMonthlyBreakdownMap.forEach((rows) => {
    rows.sort((a, b) => b.month.localeCompare(a.month));
  });

  const toggleYear = (year: number) => {
    setExpandedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  return (
    <div className="space-y-6">
      {/* Unified accordion table by year */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">연도별 누계 / 카테고리 비교 ({cumulativePeriod})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">연도</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">구매(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">구매 증감율</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">구매 증감량(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">판매(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">판매 증감율</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">판매 증감량(L)</th>
              </tr>
            </thead>
            <tbody>
              {yearlyPurchaseCards.map((item) => {
                const isExpanded = expandedYears.includes(item.year);
                const yearDetail = yearlyCategoryMap.get(item.year);
                const prevYearDetail = yearlyCategoryMap.get(item.year - 1);
                return (
                <Fragment key={item.year}>
                <tr
                  className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                  onClick={() => toggleYear(item.year)}
                >
                  <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                    <span className="inline-flex items-center gap-1">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {item.year}년
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">{formatNumber(item.purchase)}</td>
                  <td className="py-3 px-4 text-right">
                    {item.purchaseChange ? (
                      <span className={`inline-flex items-center gap-1 font-medium ${item.purchaseChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {item.purchaseChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {item.purchaseChange.isPositive ? '+' : ''}{item.purchaseChange.percent.toFixed(1)}%
                      </span>
                    ) : <span className="text-zinc-400">N/A</span>}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {item.prevPurchase !== null ? `${item.purchase - item.prevPurchase >= 0 ? '+' : ''}${formatNumber(item.purchase - item.prevPurchase)}` : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">{formatNumber(item.sales)}</td>
                  <td className="py-3 px-4 text-right">
                    {item.salesChange ? (
                      <span className={`inline-flex items-center gap-1 font-medium ${item.salesChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {item.salesChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {item.salesChange.isPositive ? '+' : ''}{item.salesChange.percent.toFixed(1)}%
                      </span>
                    ) : <span className="text-zinc-400">N/A</span>}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {item.prevSales !== null ? `${item.sales - item.prevSales >= 0 ? '+' : ''}${formatNumber(item.sales - item.prevSales)}` : 'N/A'}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-zinc-50/40 dark:bg-zinc-900/30">
                    <td colSpan={7} className="p-0">
                      <div className="px-4 py-3 space-y-3">
                        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
                          <table className="w-full text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                              <tr>
                                <th className="text-left py-2 px-3 font-bold text-zinc-500">월</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">구매(L)</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">판매(L)</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">재고변동(L)</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">목표(L)</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">달성율</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">전년동월비</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(yearlyMonthlyBreakdownMap.get(item.year) || []).map((row) => (
                                <tr key={`monthly_${row.month}`} className="border-b border-zinc-100 dark:border-zinc-800/60">
                                  <td className="py-2 px-3 font-medium text-zinc-800 dark:text-zinc-200">
                                    {Number(row.month.split('-')[1])}월
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">{formatNumber(row.purchase_weight)}</td>
                                  <td className="py-2 px-3 text-right font-mono">{formatNumber(row.sales_weight)}</td>
                                  <td className="py-2 px-3 text-right font-mono">{formatNumber(row.inventory_weight)}</td>
                                  <td className="py-2 px-3 text-right font-mono">{formatNumber(row.target_weight)}</td>
                                  <td className="py-2 px-3 text-right">
                                    <span className={`font-medium ${
                                      row.achievement_rate >= 100 ? 'text-green-600' :
                                      row.achievement_rate >= 80 ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                      {row.achievement_rate.toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <span className={`inline-flex items-center gap-1 font-medium ${
                                      row.yoy_growth_rate >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {row.yoy_growth_rate >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                      {Math.abs(row.yoy_growth_rate).toFixed(1)}%
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
                          <table className="w-full text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                              <tr>
                                <th className="text-left py-2 px-3 font-bold text-zinc-500">카테고리</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">{item.year} 판매(L)</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">{item.year - 1} 판매(L)</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">달성율</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">전년대비</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">{item.year} 구매(L)</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">{item.year - 1} 구매(L)</th>
                                <th className="text-right py-2 px-3 font-bold text-zinc-500">전년대비</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categories.map((category) => {
                                const curr = yearDetail?.get(category) || { sales: 0, purchase: 0, target: 0 };
                                const prev = prevYearDetail?.get(category) || { sales: 0, purchase: 0, target: 0 };
                                const salesRowChange = calculateChange(curr.sales, prev.sales);
                                const purchaseRowChange = calculateChange(curr.purchase, prev.purchase);
                                const rowAchievementRate = curr.target > 0 ? (curr.sales / curr.target) * 100 : 0;
                                return (
                                  <tr key={`${item.year}_${category}`} className="border-b border-zinc-100 dark:border-zinc-800/60">
                                    <td className="py-2 px-3 font-medium text-zinc-800 dark:text-zinc-200">{getCategoryLabel(category)}</td>
                                    <td className="py-2 px-3 text-right font-mono">{formatNumber(Math.round(curr.sales))}</td>
                                    <td className="py-2 px-3 text-right font-mono">{formatNumber(Math.round(prev.sales))}</td>
                                    <td className="py-2 px-3 text-right">
                                      <span className={`font-medium ${
                                        rowAchievementRate >= 100 ? 'text-green-600' :
                                        rowAchievementRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                                      }`}>
                                        {rowAchievementRate.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <span className={`inline-flex items-center gap-1 font-medium ${
                                        salesRowChange.isPositive ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {salesRowChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {Math.abs(salesRowChange.percent).toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono">{formatNumber(Math.round(curr.purchase))}</td>
                                    <td className="py-2 px-3 text-right font-mono">{formatNumber(Math.round(prev.purchase))}</td>
                                    <td className="py-2 px-3 text-right">
                                      <span className={`inline-flex items-center gap-1 font-medium ${
                                        purchaseRowChange.isPositive ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {purchaseRowChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {Math.abs(purchaseRowChange.percent).toFixed(1)}%
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goal Achievement Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4">목표 달성율 ({cumulativePeriod})</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">목표 중량</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {formatNumber(yearToDate.target_weight)} L
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">실제 판매</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {formatNumber(yearToDate.sales_weight)} L
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">달성율</p>
            <p className={`text-2xl font-bold mt-1 ${
              yearToDate.achievement_rate >= 100 ? 'text-green-600' :
              yearToDate.achievement_rate >= 80 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {yearToDate.achievement_rate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
