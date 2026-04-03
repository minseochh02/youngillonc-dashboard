"use client";

import { useState, useEffect, useRef } from 'react';
import { Loader2, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface BranchYoYData {
  branch: string;
  current_year_weight: number;
  last_year_weight: number;
  growth_rate: number;
  growth_amount: number;
}

interface YearOverYearData {
  currentYear: string;
  lastYear: string;
  currentMonth: string;
  branches: BranchYoYData[];
  total: {
    current_year_weight: number;
    last_year_weight: number;
    growth_rate: number;
    growth_amount: number;
  };
  grandTotals: {
    b2c: { weight: number; amount: number; ytd_weight: number; ytd_amount: number };
    b2b: { weight: number; amount: number; ytd_weight: number; ytd_amount: number };
  };
}

interface YearOverYearProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function YearOverYearTab({ selectedMonth, onMonthsAvailable }: YearOverYearProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<YearOverYearData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasReportedMonths = useRef(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, includeVat]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/closing-meeting?tab=yoy-comparison${selectedMonth ? `&month=${selectedMonth}` : ''}`,
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
      console.error('Failed to fetch year-over-year comparison:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString();
  };

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData = data.branches.map(branch => ({
      '사업소': branch.branch,
      [`${data.currentYear}년(L)`]: branch.current_year_weight,
      [`${data.lastYear}년(L)`]: branch.last_year_weight,
      '증감량(L)': branch.growth_amount,
      '증감률(%)': (branch.growth_rate ?? 0).toFixed(1),
    }));

    exportData.push({
      '사업소': '합계',
      [`${data.currentYear}년(L)`]: data.total.current_year_weight,
      [`${data.lastYear}년(L)`]: data.total.last_year_weight,
      '증감량(L)': data.total.growth_amount,
      '증감률(%)': (data.total.growth_rate ?? 0).toFixed(1),
    });

    const filename = generateFilename('마감회의_전년대비');
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
              <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">전년 동월 대비</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{data.currentYear}년 실적</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{formatNumber(data.total.current_year_weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년({data.lastYear}년): {formatNumber(data.total.last_year_weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">증감률</p>
              <p className={`text-2xl font-bold mt-1 ${data.total.growth_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.total.growth_rate >= 0 ? '+' : ''}{(data.total.growth_rate ?? 0).toFixed(1)}%
              </p>
              <p className={`text-[10px] font-medium mt-1 ${data.total.growth_amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.total.growth_amount >= 0 ? '+' : ''}{formatNumber(data.total.growth_amount)} L
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">전체 실적 합계</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전체 당월 중량</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatNumber(data.grandTotals.b2b.weight + data.grandTotals.b2c.weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                연누계 {formatNumber(data.grandTotals.b2b.ytd_weight + data.grandTotals.b2c.ytd_weight)} L 중 {((data.grandTotals.b2b.ytd_weight + data.grandTotals.b2c.ytd_weight) > 0 ? ((data.grandTotals.b2b.weight + data.grandTotals.b2c.weight) / (data.grandTotals.b2b.ytd_weight + data.grandTotals.b2c.ytd_weight) * 100) : 0).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전체 당월 금액</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatNumber(data.grandTotals.b2b.amount + data.grandTotals.b2c.amount)}</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                연누계 {formatNumber(data.grandTotals.b2b.ytd_amount + data.grandTotals.b2c.ytd_amount)} 원 중 {((data.grandTotals.b2b.ytd_amount + data.grandTotals.b2c.ytd_amount) > 0 ? ((data.grandTotals.b2b.amount + data.grandTotals.b2c.amount) / (data.grandTotals.b2b.ytd_amount + data.grandTotals.b2c.ytd_amount) * 100) : 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Branch YoY Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">사업소별 전년 대비</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">사업소</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-indigo-500 uppercase tracking-wider">{data.currentYear}년(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{data.lastYear}년(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">증감량(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">증감률</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">추세</th>
              </tr>
            </thead>
            <tbody>
              {data.branches.map((branch) => (
                <tr
                  key={branch.branch}
                  className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                    {branch.branch}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-indigo-700 dark:text-indigo-300 font-semibold">
                        {formatNumber(branch.current_year_weight)}
                      </span>
                      <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                        전체의 {((branch.current_year_weight / data.total.current_year_weight) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {formatNumber(branch.last_year_weight)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    <span className={branch.growth_amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {branch.growth_amount >= 0 ? '+' : ''}{formatNumber(branch.growth_amount)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-flex items-center gap-1 font-bold ${
                      (branch.growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(branch.growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {(branch.growth_rate ?? 0) >= 0 ? '+' : ''}{(branch.growth_rate ?? 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      {(branch.growth_rate ?? 0) >= 10 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
                          <TrendingUp className="w-3 h-3" />
                          큰 증가
                        </span>
                      ) : (branch.growth_rate ?? 0) >= 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                          <TrendingUp className="w-3 h-3" />
                          증가
                        </span>
                      ) : (branch.growth_rate ?? 0) >= -10 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium">
                          <TrendingDown className="w-3 h-3" />
                          감소
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium">
                          <TrendingDown className="w-3 h-3" />
                          큰 감소
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-zinc-50 dark:bg-zinc-800/30 font-bold border-t-2 border-zinc-300 dark:border-zinc-700">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">합계</td>
                <td className="py-3 px-4 text-right font-mono text-indigo-700 dark:text-indigo-300">
                  {formatNumber(data.total.current_year_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(data.total.last_year_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono">
                  <span className={data.total.growth_amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {data.total.growth_amount >= 0 ? '+' : ''}{formatNumber(data.total.growth_amount)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    (data.total.growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(data.total.growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {(data.total.growth_rate ?? 0) >= 0 ? '+' : ''}{(data.total.growth_rate ?? 0).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-4"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Trend Legend */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-2">추세 분류:</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>큰 증가: +10% 이상</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>증가: 0% ~ +10%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>감소: 0% ~ -10%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>큰 감소: -10% 미만</span>
          </div>
        </div>
      </div>
    </div>
  );
}
