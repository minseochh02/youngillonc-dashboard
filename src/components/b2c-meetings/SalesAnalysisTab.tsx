"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface ChannelDataRow {
  channel: string;
  year: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface SalesAnalysisData {
  channelData: ChannelDataRow[];
  currentYear: string;
  lastYear: string;
}

export default function SalesAnalysisTab() {
  const [data, setData] = useState<SalesAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSalesAnalysisData();
  }, []);

  const fetchSalesAnalysisData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/b2c-meetings?tab=sales-analysis`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch sales analysis data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatAmount = (num: number) => {
    // Convert to millions (백만원)
    return (num / 1000000).toFixed(1);
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
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

  const { currentYear, lastYear, channelData } = data;

  // Get data by channel and year
  const getChannelData = (channel: string, year: string) => {
    const found = channelData.find(row => row.channel === channel && row.year === year);
    return found || { total_weight: 0, total_amount: 0, total_quantity: 0 };
  };

  // Get all unique channels from data, sorted
  const allChannels = Array.from(new Set(channelData.map(row => row.channel))).sort();

  // Calculate total by year
  const getTotalByYear = (year: string) => {
    return channelData
      .filter(row => row.year === year)
      .reduce((acc, row) => ({
        total_weight: acc.total_weight + row.total_weight,
        total_amount: acc.total_amount + row.total_amount,
        total_quantity: acc.total_quantity + row.total_quantity,
      }), { total_weight: 0, total_amount: 0, total_quantity: 0 });
  };

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Add header
    exportData.push({
      '채널': '전체 채널별 매출액 (단위: 백만원)',
    });

    // Add channel rows
    allChannels.forEach((channel) => {
      const currentData = getChannelData(channel, currentYear);
      const lastData = getChannelData(channel, lastYear);
      const amountChange = calculateChange(currentData.total_amount, lastData.total_amount);

      exportData.push({
        '채널': channel,
        [`${currentYear}년 매출액(백만원)`]: formatAmount(currentData.total_amount),
        [`${lastYear}년 매출액(백만원)`]: formatAmount(lastData.total_amount),
        '변화율(%)': amountChange.percent.toFixed(1),
        [`${currentYear}년 중량(L)`]: currentData.total_weight,
        [`${lastYear}년 중량(L)`]: lastData.total_weight,
      });
    });

    // Add total
    const totalCurrent = getTotalByYear(currentYear);
    const totalLast = getTotalByYear(lastYear);
    const totalChange = calculateChange(totalCurrent.total_amount, totalLast.total_amount);

    exportData.push({});
    exportData.push({
      '채널': '전체 합계',
      [`${currentYear}년 매출액(백만원)`]: formatAmount(totalCurrent.total_amount),
      [`${lastYear}년 매출액(백만원)`]: formatAmount(totalLast.total_amount),
      '변화율(%)': totalChange.percent.toFixed(1),
      [`${currentYear}년 중량(L)`]: totalCurrent.total_weight,
      [`${lastYear}년 중량(L)`]: totalLast.total_weight,
    });

    const filename = generateFilename('전체채널별매출분석');
    exportToExcel(exportData, filename);
  };

  return (
    <div className="space-y-6">
      {/* Header with Download Button */}
      <div className="flex justify-end">
        <ExcelDownloadButton onClick={handleExcelDownload} disabled={!data || isLoading} />
      </div>

      {/* All Channels Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AUTO 채널별 매출액 (모빌 대시보드채널)</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">단위: 백만원</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">채널</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">{currentYear}년 매출액</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{lastYear}년 매출액</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">변화율</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{currentYear}년 중량(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{lastYear}년 중량(L)</th>
              </tr>
            </thead>
            <tbody>
              {allChannels.map((channel) => {
                const currentData = getChannelData(channel, currentYear);
                const lastData = getChannelData(channel, lastYear);
                const amountChange = calculateChange(currentData.total_amount, lastData.total_amount);

                return (
                  <tr
                    key={channel}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {channel}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                      {formatAmount(currentData.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {formatAmount(lastData.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        amountChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {amountChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(amountChange.percent).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                      {formatNumber(currentData.total_weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                      {formatNumber(lastData.total_weight)}
                    </td>
                  </tr>
                );
              })}

              {/* Total Row */}
              {(() => {
                const totalCurrent = getTotalByYear(currentYear);
                const totalLast = getTotalByYear(lastYear);
                const totalChange = calculateChange(totalCurrent.total_amount, totalLast.total_amount);

                return (
                  <tr className="border-t-2 border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50">
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                      전체 합계
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-bold">
                      {formatAmount(totalCurrent.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
                      {formatAmount(totalLast.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        totalChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {totalChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(totalChange.percent).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs font-semibold">
                      {formatNumber(totalCurrent.total_weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs font-semibold">
                      {formatNumber(totalLast.total_weight)}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>제품: PVL, CVL (품목그룹1코드)</li>
          <li>거래처: AUTO 채널만 (company_type_auto 테이블)</li>
          <li>채널 분류: company_type_auto.모빌_대시보드채널 기준</li>
          <li>기간: {lastYear}년 vs {currentYear}년</li>
        </ul>
      </div>
    </div>
  );
}
