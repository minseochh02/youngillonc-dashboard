"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface ChannelDataRow {
  channel: string;
  product_group: string;
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

interface SalesAnalysisTabProps {
  selectedMonth?: string;
}

export default function SalesAnalysisTab({ selectedMonth }: SalesAnalysisTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<SalesAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSalesAnalysisData();
  }, [selectedMonth, includeVat]);

  const fetchSalesAnalysisData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/b2c-meetings?tab=sales-analysis${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
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
    return num.toLocaleString();
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

  // Get data by channel, product group and year
  const getChannelData = (channel: string, productGroup: string, year: string) => {
    const found = channelData.find(row => row.channel === channel && row.product_group === productGroup && row.year === year);
    return found || { total_weight: 0, total_amount: 0, total_quantity: 0 };
  };

  // Get total by channel and year (combining PVL and CVL)
  const getChannelTotal = (channel: string, year: string) => {
    return channelData
      .filter(row => row.channel === channel && row.year === year)
      .reduce((acc, row) => ({
        total_weight: acc.total_weight + row.total_weight,
        total_amount: acc.total_amount + row.total_amount,
        total_quantity: acc.total_quantity + row.total_quantity,
      }), { total_weight: 0, total_amount: 0, total_quantity: 0 });
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
      '채널': '전체 채널별 매출액',
    });

    // Add channel rows with PVL/CVL breakdown
    allChannels.forEach((channel) => {
      const pvlCurrent = getChannelData(channel, 'PVL', currentYear);
      const cvlCurrent = getChannelData(channel, 'CVL', currentYear);
      const totalCurrent = getChannelTotal(channel, currentYear);
      const totalLast = getChannelTotal(channel, lastYear);
      const totalChange = calculateChange(totalCurrent.total_amount, totalLast.total_amount);

      exportData.push({
        '채널': channel,
        [`PVL 중량(${currentYear})`]: pvlCurrent.total_weight,
        [`CVL 중량(${currentYear})`]: cvlCurrent.total_weight,
        [`합계 중량(${currentYear})`]: totalCurrent.total_weight,
        [`PVL 매출(${currentYear})`]: pvlCurrent.total_amount,
        [`CVL 매출(${currentYear})`]: cvlCurrent.total_amount,
        [`합계 매출(${currentYear})`]: totalCurrent.total_amount,
        '변화율(%)': totalChange.percent.toFixed(1),
      });
    });

    // Add total
    const totalCurrent = getTotalByYear(currentYear);
    const totalLast = getTotalByYear(lastYear);
    const totalChange = calculateChange(totalCurrent.total_amount, totalLast.total_amount);

    exportData.push({});
    exportData.push({
      '채널': '전체 합계',
      [`합계 중량(${currentYear})`]: totalCurrent.total_weight,
      [`합계 매출(${currentYear})`]: totalCurrent.total_amount,
      '변화율(%)': totalChange.percent.toFixed(1),
    });

    const filename = generateFilename('전체채널별매출분석');
    exportToExcel(exportData, filename);
  };

  const pvlCurrent = channelData.filter(r => r.product_group === 'PVL' && r.year === currentYear).reduce((acc, r) => ({
    weight: acc.weight + r.total_weight,
    amount: acc.amount + r.total_amount
  }), { weight: 0, amount: 0 });
  const pvlLast = channelData.filter(r => r.product_group === 'PVL' && r.year === lastYear).reduce((acc, r) => ({
    weight: acc.weight + r.total_weight,
    amount: acc.amount + r.total_amount
  }), { weight: 0, amount: 0 });
  const pvlWeightChange = calculateChange(pvlCurrent.weight, pvlLast.weight);

  const cvlCurrent = channelData.filter(r => r.product_group === 'CVL' && r.year === currentYear).reduce((acc, r) => ({
    weight: acc.weight + r.total_weight,
    amount: acc.amount + r.total_amount
  }), { weight: 0, amount: 0 });
  const cvlLast = channelData.filter(r => r.product_group === 'CVL' && r.year === lastYear).reduce((acc, r) => ({
    weight: acc.weight + r.total_weight,
    amount: acc.amount + r.total_amount
  }), { weight: 0, amount: 0 });
  const cvlWeightChange = calculateChange(cvlCurrent.weight, cvlLast.weight);

  const totalCurrentWeight = pvlCurrent.weight + cvlCurrent.weight;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PVL Summary Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">PVL 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentYear}년 합계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 중량</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(pvlCurrent.weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {formatNumber(totalCurrentWeight)} L 중 {((pvlCurrent.weight / (totalCurrentWeight || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전년 대비</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${pvlWeightChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {pvlWeightChange.isPositive ? '+' : ''}{pvlWeightChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년: {formatNumber(pvlLast.weight)} L
              </p>
            </div>
          </div>
        </div>

        {/* CVL Summary Card */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">CVL 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentYear}년 합계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 중량</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatNumber(cvlCurrent.weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {formatNumber(totalCurrentWeight)} L 중 {((cvlCurrent.weight / (totalCurrentWeight || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전년 대비</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${cvlWeightChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {cvlWeightChange.isPositive ? '+' : ''}{cvlWeightChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년: {formatNumber(cvlLast.weight)} L
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* All Channels Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AUTO 채널별 매출액 (거래처그룹2)</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th rowSpan={2} className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">채널</th>
                <th colSpan={3} className="text-center py-2 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700">중량 (L) - {currentYear}년</th>
                <th colSpan={3} className="text-center py-2 px-4 text-xs font-bold text-purple-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700">매출액 (원) - {currentYear}년</th>
                <th rowSpan={2} className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">변화율<br/>(전체)</th>
              </tr>
              <tr>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">PVL</th>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">CVL</th>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-blue-600 border-b border-zinc-200 dark:border-zinc-800">합계</th>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">PVL</th>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">CVL</th>
                <th className="text-right py-2 px-4 text-[10px] font-bold text-purple-600 border-b border-zinc-200 dark:border-zinc-800">합계</th>
              </tr>
            </thead>
            <tbody>
              {allChannels.map((channel) => {
                const pvlCurrent = getChannelData(channel, 'PVL', currentYear);
                const cvlCurrent = getChannelData(channel, 'CVL', currentYear);
                const totalCurrent = getChannelTotal(channel, currentYear);
                const totalLast = getChannelTotal(channel, lastYear);
                const totalChange = calculateChange(totalCurrent.total_amount, totalLast.total_amount);

                return (
                  <tr
                    key={channel}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {channel}
                    </td>
                    {/* Weight Columns */}
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs border-l border-zinc-100 dark:border-zinc-800/50">
                      {formatNumber(pvlCurrent.total_weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                      {formatNumber(cvlCurrent.total_weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-bold bg-blue-50/20">
                      {formatNumber(totalCurrent.total_weight)}
                    </td>
                    {/* Amount Columns */}
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs border-l border-zinc-100 dark:border-zinc-800/50">
                      {formatNumber(pvlCurrent.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                      {formatNumber(cvlCurrent.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-purple-700 dark:text-purple-300 font-bold bg-purple-50/20">
                      {formatNumber(totalCurrent.total_amount)}
                    </td>
                    {/* Change Column */}
                    <td className="py-3 px-4 text-right border-l border-zinc-100 dark:border-zinc-800/50">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        totalChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {totalChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(totalChange.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Total Row */}
              {(() => {
                const pvlGrand = channelData.filter(r => r.product_group === 'PVL' && r.year === currentYear).reduce((acc, r) => acc + r.total_weight, 0);
                const cvlGrand = channelData.filter(r => r.product_group === 'CVL' && r.year === currentYear).reduce((acc, r) => acc + r.total_weight, 0);
                
                const pvlGrandAmt = channelData.filter(r => r.product_group === 'PVL' && r.year === currentYear).reduce((acc, r) => acc + r.total_amount, 0);
                const cvlGrandAmt = channelData.filter(r => r.product_group === 'CVL' && r.year === currentYear).reduce((acc, r) => acc + r.total_amount, 0);

                const totalCurrent = getTotalByYear(currentYear);
                const totalLast = getTotalByYear(lastYear);
                const totalChange = calculateChange(totalCurrent.total_amount, totalLast.total_amount);

                return (
                  <tr className="border-t-2 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold">
                    <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100 uppercase">전체 합계</td>
                    <td className="py-3 px-4 text-right font-mono text-xs border-l border-zinc-200 dark:border-zinc-700">{formatNumber(pvlGrand)}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs">{formatNumber(cvlGrand)}</td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 bg-blue-50/30">{formatNumber(totalCurrent.total_weight)}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs border-l border-zinc-200 dark:border-zinc-700">{formatNumber(pvlGrandAmt)}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs">{formatNumber(cvlGrandAmt)}</td>
                    <td className="py-3 px-4 text-right font-mono text-purple-700 dark:text-purple-300 bg-purple-50/30">{formatNumber(totalCurrent.total_amount)}</td>
                    <td className="py-3 px-4 text-right border-l border-zinc-200 dark:border-zinc-700">
                      <span className={`inline-flex items-center gap-1 ${totalChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {totalChange.isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {Math.abs(totalChange.percent).toFixed(1)}%
                      </span>
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
          <li>제품: (품목그룹1코드)</li>
          <li>거래처: AUTO 채널만 (company_type_auto 테이블)</li>
          <li>채널 분류: company_type_auto.거래처그룹2 기준</li>
          <li>기간: {lastYear}년 vs {currentYear}년</li>
        </ul>
      </div>
    </div>
  );
}
