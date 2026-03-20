"use client";

import { useState, useEffect } from 'react';
import { Loader2, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
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

export default function BusinessTab() {
  const [data, setData] = useState<BusinessData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBusinessData();
  }, []);

  const fetchBusinessData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/b2c-meetings?tab=business`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch business data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
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

  // Aggregate by branch and business type for each year
  const aggregateByYear = (year: string) => {
    const yearData = data.businessData.filter(row => row.year === year);
    const aggregated = new Map<string, { weight: number; amount: number; quantity: number }>();

    yearData.forEach(row => {
      const key = `${row.business_type}-${row.branch}`;
      const existing = aggregated.get(key) || { weight: 0, amount: 0, quantity: 0 };
      aggregated.set(key, {
        weight: existing.weight + Number(row.total_weight || 0),
        amount: existing.amount + Number(row.total_amount || 0),
        quantity: existing.quantity + Number(row.total_quantity || 0),
      });
    });

    return aggregated;
  };

  const currentYearData = aggregateByYear(currentYear);
  const lastYearData = aggregateByYear(lastYear);

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
    exportToExcel(exportData, filename);
  };

  return (
    <div className="space-y-6">
      {/* Header with Download Button */}
      <div className="flex justify-end">
        <ExcelDownloadButton onClick={handleExcelDownload} disabled={!data || isLoading} />
      </div>

      {/* Year Comparison Summary */}
      <div className="grid grid-cols-2 gap-4">
        {/* Current Year */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {currentYear}년 (PVL + CVL, AUTO)
            </h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 중량</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {formatNumber(totalsByYear[currentYear]?.total_weight || 0)} L
              </p>
            </div>
          </div>
        </div>

        {/* Last Year */}
        <div className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-900/20 dark:to-zinc-800/20 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {lastYear}년 (비교)
            </h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 중량</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  {formatNumber(totalsByYear[lastYear]?.total_weight || 0)} L
                </p>
                {(() => {
                  const change = calculateChange(
                    totalsByYear[currentYear]?.total_weight || 0,
                    totalsByYear[lastYear]?.total_weight || 0
                  );
                  return (
                    <span className={`text-sm font-medium flex items-center gap-1 ${
                      change.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {change.isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {Math.abs(change.percent).toFixed(1)}%
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Year-over-Year Comparison Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">사업소별 연도 비교</h4>
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
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => {
                const month = String(i + 1).padStart(2, '0');
                const now = new Date();
                const currentMonthNum = now.getMonth() + 1;
                const currentYearNum = now.getFullYear();
                const yearNum = parseInt(currentYear);
                
                if (yearNum > currentYearNum) return null;
                if (yearNum === currentYearNum && i + 1 > currentMonthNum) return null;

                const currentYearMonth = `${currentYear}-${month}`;
                const lastYearMonth = `${lastYear}-${month}`;
                
                // ... rest of the logic
              }).filter(Boolean)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>제품: PVL, CVL (품목그룹1코드)</li>
          <li>거래처: AUTO 업종분류기준 코드</li>
          <li>기간: {lastYear}년 vs {currentYear}년</li>
        </ul>
      </div>
    </div>
  );
}
