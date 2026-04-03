"use client";

import { useState, useEffect, useRef, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart, Archive, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
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

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];
    const categories = ['MB', 'AVI + MAR', 'AUTO', 'IL'];

    // Get cumulative breakdown by category for both years
    const currentMonthData = data.currentMonthData;

    categories.forEach(category => {
      const breakdown = currentMonthData.breakdown.find(b => b.category === category);
      if (breakdown) {
        const weightChange = calculateChange(breakdown.sales_weight, 0); // We don't have last year breakdown in current data
        exportData.push({
          '카테고리': category,
          [`${data.currentYear}년 판매(L)`]: breakdown.sales_weight,
          [`${data.currentYear}년 구매(L)`]: breakdown.purchase_weight,
          [`${data.currentYear}년 재고(L)`]: breakdown.inventory_weight,
        });
      }
    });

    // Add totals
    exportData.push({
      '카테고리': '합계',
      [`${data.currentYear}년 판매(L)`]: data.yearToDate.sales_weight,
      [`${data.currentYear}년 구매(L)`]: data.yearToDate.purchase_weight,
      [`${data.currentYear}년 재고(L)`]: data.yearToDate.inventory_weight,
    });

    const filename = generateFilename('마감회의_월간총괄');
    exportToExcel(exportData, filename, { referenceDate: selectedMonth });
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

  const { currentYear, lastYear, yearToDate, lastYearToDate } = data;
  const displayMonth = parseInt(data.currentMonth.split('-')[1]);
  const cumulativePeriod = `1월~${displayMonth}월 누계`;

  // Calculate category-level year-over-year comparisons
  const categories = ['MB', 'AVI + MAR', 'AUTO', 'IL'];
  const currentMonthData = data.currentMonthData;

  const salesChange = calculateChange(yearToDate.sales_weight, lastYearToDate.sales_weight);
  const purchaseChange = calculateChange(yearToDate.purchase_weight, lastYearToDate.purchase_weight);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Performance Summary Card */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{currentYear}년 실적 요약</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{cumulativePeriod}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 판매</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(yearToDate.sales_weight)} L</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{formatNumber(yearToDate.sales_amount)} 원</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 구매</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(yearToDate.purchase_weight)} L</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{formatNumber(yearToDate.purchase_amount)} 원</p>
            </div>
          </div>
        </div>

        {/* Year-over-Year Change Card */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              {salesChange.isPositive ? (
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">전년 대비 증감</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentYear} vs {lastYear} · {cumulativePeriod}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">판매 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${salesChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {salesChange.isPositive ? '+' : ''}{salesChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {salesChange.isPositive ? '+' : ''}{formatNumber(yearToDate.sales_weight - lastYearToDate.sales_weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">구매 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${purchaseChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {purchaseChange.isPositive ? '+' : ''}{purchaseChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {purchaseChange.isPositive ? '+' : ''}{formatNumber(yearToDate.purchase_weight - lastYearToDate.purchase_weight)} L
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Year-over-Year Comparison Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">카테고리별 연도 비교 ({cumulativePeriod})</h4>
          <ExcelDownloadButton onClick={handleExcelDownload} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">카테고리</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">{currentYear}년 판매(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{lastYear}년 판매(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">변화율</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const breakdown = currentMonthData.breakdown.find(b => b.category === category);
                const lastYearBreakdown = lastYearToDate.categoryBreakdown.find(b => b.category === category);
                if (!breakdown) return null;

                const lastYearSales = lastYearBreakdown?.sales_weight || 0;
                const change = calculateChange(breakdown.sales_weight, lastYearSales);

                return (
                  <tr
                    key={category}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {category}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                      {formatNumber(breakdown.sales_weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(lastYearSales)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        change.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {change.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(change.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-blue-50 dark:bg-blue-950/20 border-t-2 border-blue-200 dark:border-blue-800 font-bold">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">
                  합계
                </td>
                <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300">
                  {formatNumber(yearToDate.sales_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                  {formatNumber(lastYearToDate.sales_weight)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${
                    salesChange.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {salesChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(salesChange.percent).toFixed(1)}%
                  </span>
                </td>
              </tr>
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
