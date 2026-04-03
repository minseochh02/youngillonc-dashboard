"use client";

import { useState, useEffect, useRef } from 'react';
import { Loader2, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface BranchTargetData {
  branch: string;
  target_weight: number;
  actual_weight: number;
  achievement_rate: number;
  gap: number;
}

interface TargetAchievementData {
  currentMonth: string;
  branches: BranchTargetData[];
  total: {
    target_weight: number;
    actual_weight: number;
    achievement_rate: number;
    gap: number;
  };
  grandTotals: {
    b2c: { weight: number; amount: number; ytd_weight: number; ytd_amount: number };
    b2b: { weight: number; amount: number; ytd_weight: number; ytd_amount: number };
  };
}

interface TargetAchievementProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function TargetAchievementTab({ selectedMonth, onMonthsAvailable }: TargetAchievementProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<TargetAchievementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasReportedMonths = useRef(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, includeVat]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/closing-meeting?tab=target-achievement${selectedMonth ? `&month=${selectedMonth}` : ''}`,
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
      console.error('Failed to fetch target achievement:', error);
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
      '목표(L)': branch.target_weight,
      '실적(L)': branch.actual_weight,
      '달성율(%)': (branch.achievement_rate ?? 0).toFixed(1),
      '차이(L)': branch.gap,
    }));

    exportData.push({
      '사업소': '합계',
      '목표(L)': data.total.target_weight,
      '실적(L)': data.total.actual_weight,
      '달성율(%)': (data.total.achievement_rate ?? 0).toFixed(1),
      '차이(L)': data.total.gap,
    });

    const filename = generateFilename('마감회의_목표달성율');
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
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">전체 목표 달성율</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 실적</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(data.total.actual_weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                목표: {formatNumber(data.total.target_weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">달성율</p>
              <p className={`text-2xl font-bold mt-1 ${data.total.achievement_rate >= 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                {(data.total.achievement_rate ?? 0).toFixed(1)}%
              </p>
              <p className={`text-[10px] font-medium mt-1 ${data.total.gap >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                차이: {data.total.gap >= 0 ? '+' : ''}{formatNumber(data.total.gap)} L
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

      {/* Branch Achievement Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">사업소별 목표 달성율</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">사업소</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">목표(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-500 uppercase tracking-wider">실적(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">차이(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">달성율</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">상태</th>
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
                  <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {formatNumber(branch.target_weight)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-blue-700 dark:text-blue-300 font-semibold">
                        {formatNumber(branch.actual_weight)}
                      </span>
                      <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                        전체의 {((branch.actual_weight / data.total.actual_weight) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    <span className={branch.gap >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {branch.gap >= 0 ? '+' : ''}{formatNumber(branch.gap)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-bold ${
                      (branch.achievement_rate ?? 0) >= 100
                        ? 'text-green-600'
                        : (branch.achievement_rate ?? 0) >= 80
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      {(branch.achievement_rate ?? 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      {(branch.achievement_rate ?? 0) >= 100 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
                          <TrendingUp className="w-3 h-3" />
                          목표달성
                        </span>
                      ) : (branch.achievement_rate ?? 0) >= 80 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-medium">
                          근접
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium">
                          <TrendingDown className="w-3 h-3" />
                          미달
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-zinc-50 dark:bg-zinc-800/30 font-bold border-t-2 border-zinc-300 dark:border-zinc-700">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">합계</td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(data.total.target_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300">
                  {formatNumber(data.total.actual_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono">
                  <span className={data.total.gap >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {data.total.gap >= 0 ? '+' : ''}{formatNumber(data.total.gap)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`font-bold ${
                    (data.total.achievement_rate ?? 0) >= 100
                      ? 'text-green-600'
                      : (data.total.achievement_rate ?? 0) >= 80
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}>
                    {(data.total.achievement_rate ?? 0).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-4"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Achievement Legend */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-2">달성율 기준:</p>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>목표달성: 100% 이상</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>근접: 80% ~ 100%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>미달: 80% 미만</span>
          </div>
        </div>
      </div>
    </div>
  );
}
