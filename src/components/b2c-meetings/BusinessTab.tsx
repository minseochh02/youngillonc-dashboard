"use client";

import { useState, useEffect } from 'react';
import { Loader2, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface BusinessDataRow {
  branch: string;
  business_type: string;
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface BusinessData {
  businessData: BusinessDataRow[];
  totalsByYear: Record<string, {
    total_weight: number;
    total_amount: number;
    total_quantity: number;
  }>;
  currentYear: string;
  lastYear: string;
}

interface BusinessTabProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function BusinessTab({ selectedMonth, onMonthsAvailable }: BusinessTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<BusinessData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBusinessData();
  }, [selectedMonth, includeVat]);

  const fetchBusinessData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/b2c-meetings?tab=business${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // Report available months to parent
        if (onMonthsAvailable && result.data.availableMonths) {
          onMonthsAvailable(result.data.availableMonths, result.data.currentMonth);
        }
      }
    } catch (error) {
      console.error('Failed to fetch business data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString();
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
  };

  const getDisplayName = (businessType: string, branch: string) => {
    if (businessType === 'B2B') return 'b2b본부';
    return branch;
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

  const { currentYear, lastYear, totalsByYear } = data;

  // Calculate cumulative month strings for filtering
  const currentMonthStr = selectedMonth || `${currentYear}-12`;
  const [_, currentMonthNum] = currentMonthStr.split('-');
  const lastYearMonthStr = `${lastYear}-${currentMonthNum}`;

  // Aggregate by branch and business type for each year (cumulative up to selected month)
  const aggregateByYear = (year: string, upToMonth: string) => {
    const yearData = data.businessData.filter(
      row => row.year === year && row.year_month <= upToMonth
    );
    const aggregated = new Map<string, { weight: number; amount: number; quantity: number }>();

    yearData.forEach(row => {
      const key = `${row.business_type}-${row.branch}`;
      const existing = aggregated.get(key) || { weight: 0, amount: 0, quantity: 0 };
      aggregated.set(key, {
        weight: Math.round(existing.weight + Number(row.total_weight || 0)),
        amount: Math.round(existing.amount + Number(row.total_amount || 0)),
        quantity: Math.round(existing.quantity + Number(row.total_quantity || 0)),
      });
    });

    return aggregated;
  };

  const currentYearData = aggregateByYear(currentYear, currentMonthStr);
  const lastYearData = aggregateByYear(lastYear, lastYearMonthStr);

  // Get unique branches
  const branches = new Set<string>();
  data.businessData.forEach(row => {
    branches.add(`${row.business_type}-${row.branch}`);
  });

  const sortedBranches = Array.from(branches).sort((a, b) => {
    const [typeA, branchA] = a.split('-');
    const [typeB, branchB] = b.split('-');

    // B2C first, then B2B
    if (typeA !== typeB) {
      return typeA === 'B2C' ? -1 : 1;
    }

    // Sort B2C branches
    const order = ['동부', '서부', '중부', '제주', '남부'];
    return order.indexOf(branchA) - order.indexOf(branchB);
  });

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Add year-over-year comparison rows
    exportData.push({
      '사업소': '총계',
      [`${currentYear}년 중량(L)`]: totalsByYear[currentYear]?.total_weight || 0,
      [`${lastYear}년 중량(L)`]: totalsByYear[lastYear]?.total_weight || 0,
      '변화율(%)': calculateChange(
        totalsByYear[currentYear]?.total_weight || 0,
        totalsByYear[lastYear]?.total_weight || 0
      ).percent.toFixed(1),
    });

    sortedBranches.forEach((key) => {
      const [businessType, branch] = key.split('-');
      const currentData = currentYearData.get(key) || { weight: 0, amount: 0, quantity: 0 };
      const lastData = lastYearData.get(key) || { weight: 0, amount: 0, quantity: 0 };
      const change = calculateChange(currentData.weight, lastData.weight);

      exportData.push({
        '사업소': getDisplayName(businessType, branch),
        [`${currentYear}년 중량(L)`]: currentData.weight,
        [`${lastYear}년 중량(L)`]: lastData.weight,
        '변화율(%)': change.percent.toFixed(1),
      });
    });

    // Add blank row separator
    exportData.push({});

    // Add monthly comparison header
    exportData.push({
      '월': '월별 중량 비교 (전년 동월 대비)',
    });

    // Add monthly comparison data
    Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, '0');
      const currentYearMonth = `${currentYear}-${month}`;
      const lastYearMonth = `${lastYear}-${month}`;

      const monthRow: any = { '월': `${month}월` };

      sortedBranches.forEach((key) => {
        const [businessType, branch] = key.split('-');
        const currentMonthData = data.businessData.find(
          row => row.year_month === currentYearMonth && `${row.business_type}-${row.branch}` === key
        );
        const lastMonthData = data.businessData.find(
          row => row.year_month === lastYearMonth && `${row.business_type}-${row.branch}` === key
        );

        const current = Number(currentMonthData?.total_weight || 0);
        const last = Number(lastMonthData?.total_weight || 0);
        const change = calculateChange(current, last);

        const branchName = getDisplayName(businessType, branch);
        monthRow[`${branchName} 중량`] = current;
        monthRow[`${branchName} 변화율(%)`] = change.percent.toFixed(1);
      });

      exportData.push(monthRow);
    });

    const filename = generateFilename('B2C사업소별');
    exportToExcel(exportData, filename, { referenceDate: selectedMonth });
  };

  const totalCurrentWeight = totalsByYear[currentYear]?.total_weight || 0;
  const totalLastWeight = totalsByYear[lastYear]?.total_weight || 0;
  const totalWeightChange = calculateChange(totalCurrentWeight, totalLastWeight);

  const totalCurrentAmount = totalsByYear[currentYear]?.total_amount || 0;
  const totalLastAmount = totalsByYear[lastYear]?.total_amount || 0;
  const totalAmountChange = calculateChange(totalCurrentAmount, totalLastAmount);

  // Format month display for cumulative period
  const displayMonth = parseInt(currentMonthNum);
  const cumulativePeriod = `1월~${displayMonth}월 누계`;

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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{cumulativePeriod} · 전체 사업소 합계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 중량</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totalCurrentWeight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 중량 대비 100%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 금액</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totalCurrentAmount)} 원</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 금액 대비 100%
              </p>
            </div>
          </div>
        </div>

        {/* Year-over-Year Change Card */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              {totalWeightChange.isPositive ? (
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">전년 대비 증감 (누계)</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentYear} vs {lastYear} · {cumulativePeriod}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">중량 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${totalWeightChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {totalWeightChange.isPositive ? '+' : ''}{(totalWeightChange.percent ?? 0).toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                {totalWeightChange.isPositive ? '+' : ''}{formatNumber(totalCurrentWeight - totalLastWeight)} L
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">금액 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${totalAmountChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {totalAmountChange.isPositive ? '+' : ''}{(totalAmountChange.percent ?? 0).toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                {totalAmountChange.isPositive ? '+' : ''}{formatNumber(totalCurrentAmount - totalLastAmount)} 원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Year-over-Year Comparison Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">사업소별 연도 비교 ({cumulativePeriod})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">사업소</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">{currentYear}년 용량(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{lastYear}년 용량(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">변화율</th>
              </tr>
            </thead>
            <tbody>
              {sortedBranches.map((key) => {
                const [businessType, branch] = key.split('-');
                const currentData = currentYearData.get(key) || { weight: 0, amount: 0, quantity: 0 };
                const lastData = lastYearData.get(key) || { weight: 0, amount: 0, quantity: 0 };
                const change = calculateChange(currentData.weight, lastData.weight);

                return (
                  <tr
                    key={key}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {getDisplayName(businessType, branch)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                      {formatNumber(currentData.weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(lastData.weight)}
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
                  {formatNumber(totalCurrentWeight)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                  {formatNumber(totalLastWeight)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${
                    totalWeightChange.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {totalWeightChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(totalWeightChange.percent).toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Comparison Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">월별 용량 비교 (전년 동월 대비)</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-50 dark:bg-zinc-800/50">월</th>
                {sortedBranches.map((key) => {
                  const [businessType, branch] = key.split('-');
                  return (
                    <th key={key} className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                      {getDisplayName(businessType, branch)}
                    </th>
                  );
                })}
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap">합계</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (__, i) => {
                const month = String(i + 1).padStart(2, '0');

                // Only show months up to the selected month
                const selectedMonthNum = parseInt(currentMonthNum);
                if (i + 1 > selectedMonthNum) return null;

                const currentYearMonth = `${currentYear}-${month}`;
                const lastYearMonth = `${lastYear}-${month}`;

                // Calculate total for this month across all branches
                const monthCurrentTotal = Math.round(data.businessData
                  .filter(row => row.year_month === currentYearMonth)
                  .reduce((sum, row) => sum + Number(row.total_weight || 0), 0));
                const monthLastTotal = Math.round(data.businessData
                  .filter(row => row.year_month === lastYearMonth)
                  .reduce((sum, row) => sum + Number(row.total_weight || 0), 0));
                const monthTotalChange = calculateChange(monthCurrentTotal, monthLastTotal);

                return (
                  <tr
                    key={month}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100 sticky left-0 bg-white dark:bg-zinc-900">
                      {parseInt(month)}월
                    </td>
                    {sortedBranches.map((key) => {
                      const currentMonthData = data.businessData.find(
                        row => row.year_month === currentYearMonth && `${row.business_type}-${row.branch}` === key
                      );
                      const lastMonthData = data.businessData.find(
                        row => row.year_month === lastYearMonth && `${row.business_type}-${row.branch}` === key
                      );

                      const current = Math.round(Number(currentMonthData?.total_weight || 0));
                      const last = Math.round(Number(lastMonthData?.total_weight || 0));
                      const change = calculateChange(current, last);

                      return (
                        <td key={key} className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono text-zinc-900 dark:text-zinc-100">
                              {formatNumber(current)}
                            </span>
                            <span className={`text-xs font-medium ${
                              change.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {change.isPositive ? '+' : ''}{change.percent.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right bg-blue-50/50 dark:bg-blue-950/10">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                          {formatNumber(monthCurrentTotal)}
                        </span>
                        <span className={`text-xs font-medium ${
                          monthTotalChange.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {monthTotalChange.isPositive ? '+' : ''}{monthTotalChange.percent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }).filter(Boolean)}
              <tr className="bg-blue-50 dark:bg-blue-950/20 border-t-2 border-blue-200 dark:border-blue-800 font-bold">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100 sticky left-0 bg-blue-50 dark:bg-blue-950/20">
                  합계
                </td>
                {sortedBranches.map((key) => {
                  const currentTotal = Math.round(data.businessData
                    .filter(row => row.year === currentYear && row.year_month <= currentMonthStr && `${row.business_type}-${row.branch}` === key)
                    .reduce((sum, row) => sum + Number(row.total_weight || 0), 0));
                  const lastTotal = Math.round(data.businessData
                    .filter(row => row.year === lastYear && row.year_month <= lastYearMonthStr && `${row.business_type}-${row.branch}` === key)
                    .reduce((sum, row) => sum + Number(row.total_weight || 0), 0));
                  const change = calculateChange(currentTotal, lastTotal);

                  return (
                    <td key={key} className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-blue-700 dark:text-blue-300">
                          {formatNumber(currentTotal)}
                        </span>
                        <span className={`text-xs font-medium ${
                          change.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {change.isPositive ? '+' : ''}{change.percent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="py-3 px-4 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                      {formatNumber(totalCurrentWeight)}
                    </span>
                    <span className={`text-xs font-medium ${
                      totalWeightChange.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {totalWeightChange.isPositive ? '+' : ''}{totalWeightChange.percent.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>제품: (품목그룹1코드)</li>
          <li>거래처: AUTO 업종분류기준 코드</li>
          <li>기간: {lastYear}년 {cumulativePeriod} vs {currentYear}년 {cumulativePeriod}</li>
        </ul>
      </div>
    </div>
  );
}
