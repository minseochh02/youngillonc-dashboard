"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface SalesData {
  region: string;
  year: string;
  transaction_count: number;
  client_count: number;
  total_quantity: number;
  total_weight: number;
  total_supply_amount: number;
  total_amount: number;
}

interface ShoppingMallData {
  salesData: SalesData[];
  regions: string[];
  currentYear: string;
  lastYear: string;
}

interface ShoppingMallTabProps {
  selectedMonth?: string;
}

export default function ShoppingMallTab({ selectedMonth }: ShoppingMallTabProps) {
  const [data, setData] = useState<ShoppingMallData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchShoppingMallData();
  }, [selectedMonth]);

  const fetchShoppingMallData = async () => {
    setIsLoading(true);
    try {
      const url = `/api/dashboard/b2c-meetings?tab=shopping-mall${selectedMonth ? `&month=${selectedMonth}` : ''}`;
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch shopping mall data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
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

  const { salesData, regions, currentYear, lastYear } = data;

  // Organize data by region and year
  const getRegionData = (region: string, year: string) => {
    return salesData.find(d => d.region === region && d.year === year);
  };

  // Calculate totals for each year
  const getTotalsByYear = (year: string) => {
    const yearData = salesData.filter(d => d.year === year);
    return yearData.reduce((acc, d) => ({
      transaction_count: acc.transaction_count + d.transaction_count,
      client_count: acc.client_count + d.client_count,
      total_quantity: acc.total_quantity + d.total_quantity,
      total_weight: acc.total_weight + d.total_weight,
      total_supply_amount: acc.total_supply_amount + d.total_supply_amount,
      total_amount: acc.total_amount + d.total_amount,
    }), {
      transaction_count: 0,
      client_count: 0,
      total_quantity: 0,
      total_weight: 0,
      total_supply_amount: 0,
      total_amount: 0,
    });
  };

  const currentYearTotals = getTotalsByYear(currentYear);
  const lastYearTotals = getTotalsByYear(lastYear);

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Add data for each region
    regions.forEach((region) => {
      const currentData = getRegionData(region, currentYear);
      const lastData = getRegionData(region, lastYear);

      exportData.push({
        '지역': region,
        [`거래건수(${currentYear})`]: currentData?.transaction_count || 0,
        [`거래건수(${lastYear})`]: lastData?.transaction_count || 0,
        [`거래처수(${currentYear})`]: currentData?.client_count || 0,
        [`거래처수(${lastYear})`]: lastData?.client_count || 0,
        [`중량(${currentYear})`]: currentData?.total_weight || 0,
        [`중량(${lastYear})`]: lastData?.total_weight || 0,
        [`합계(${currentYear})`]: currentData?.total_amount || 0,
        [`합계(${lastYear})`]: lastData?.total_amount || 0,
      });
    });

    const filename = generateFilename('B2C쇼핑몰판매현황');
    exportToExcel(exportData, filename);
  };

  return (
    <div className="space-y-6">
      {/* Sales Data Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th
                  rowSpan={2}
                  className="py-3 px-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider align-bottom border-r border-zinc-200 dark:border-zinc-700"
                >
                  지역
                </th>
                <th
                  colSpan={2}
                  className="py-2 px-4 text-center text-xs font-bold text-zinc-600 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700"
                >
                  거래건수
                </th>
                <th
                  colSpan={2}
                  className="py-2 px-4 text-center text-xs font-bold text-zinc-600 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700"
                >
                  거래처수
                </th>
                <th
                  colSpan={2}
                  className="py-2 px-4 text-center text-xs font-bold text-zinc-600 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700"
                >
                  중량
                </th>
                <th
                  colSpan={3}
                  className="py-2 px-4 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400"
                >
                  합계
                </th>
              </tr>
              <tr>
                <th className="py-2 px-3 text-center text-xs text-zinc-500 dark:text-zinc-400">{currentYear}</th>
                <th className="py-2 px-3 text-center text-xs text-zinc-400 dark:text-zinc-500 border-r border-zinc-200 dark:border-zinc-700">{lastYear}</th>
                <th className="py-2 px-3 text-center text-xs text-zinc-500 dark:text-zinc-400">{currentYear}</th>
                <th className="py-2 px-3 text-center text-xs text-zinc-400 dark:text-zinc-500 border-r border-zinc-200 dark:border-zinc-700">{lastYear}</th>
                <th className="py-2 px-3 text-center text-xs text-zinc-500 dark:text-zinc-400">{currentYear}</th>
                <th className="py-2 px-3 text-center text-xs text-zinc-400 dark:text-zinc-500 border-r border-zinc-200 dark:border-zinc-700">{lastYear}</th>
                <th className="py-2 px-3 text-center text-xs text-emerald-600 dark:text-emerald-400">{currentYear}</th>
                <th className="py-2 px-3 text-center text-xs text-emerald-500/70 dark:text-emerald-500/70">{lastYear}</th>
                <th className="py-2 px-3 text-center text-xs text-blue-600 dark:text-blue-400">증감</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => {
                const currentData = getRegionData(region, currentYear);
                const lastData = getRegionData(region, lastYear);

                const amountChange = (currentData?.total_amount || 0) - (lastData?.total_amount || 0);
                const amountChangePercent = lastData?.total_amount
                  ? ((amountChange / lastData.total_amount) * 100).toFixed(1)
                  : '0.0';

                return (
                  <tr
                    key={region}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          region === '동부' ? 'bg-blue-500' :
                          region === '서부' ? 'bg-purple-500' :
                          'bg-emerald-500'
                        }`} />
                        {region}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(currentData?.transaction_count || 0)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-zinc-500 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-700">
                      {formatNumber(lastData?.transaction_count || 0)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(currentData?.client_count || 0)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-zinc-500 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-700">
                      {formatNumber(lastData?.client_count || 0)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(currentData?.total_weight || 0)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-zinc-500 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-700">
                      {formatNumber(lastData?.total_weight || 0)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                      ₩{formatNumber(currentData?.total_amount || 0)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-emerald-600/70 dark:text-emerald-500/70">
                      ₩{formatNumber(lastData?.total_amount || 0)}
                    </td>
                    <td className={`py-3 px-3 text-center font-mono font-medium ${
                      amountChange >= 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      <div className="flex items-center justify-center gap-1">
                        {amountChange >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {amountChange >= 0 ? '+' : ''}{amountChangePercent}%
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Totals Row */}
              <tr className="bg-zinc-50 dark:bg-zinc-800/30 font-bold border-t-2 border-zinc-300 dark:border-zinc-700">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-700">
                  합계
                </td>
                <td className="py-3 px-3 text-center font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(currentYearTotals.transaction_count)}
                </td>
                <td className="py-3 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700">
                  {formatNumber(lastYearTotals.transaction_count)}
                </td>
                <td className="py-3 px-3 text-center font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(currentYearTotals.client_count)}
                </td>
                <td className="py-3 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700">
                  {formatNumber(lastYearTotals.client_count)}
                </td>
                <td className="py-3 px-3 text-center font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(currentYearTotals.total_weight)}
                </td>
                <td className="py-3 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700">
                  {formatNumber(lastYearTotals.total_weight)}
                </td>
                <td className="py-3 px-3 text-center font-mono text-emerald-700 dark:text-emerald-300">
                  ₩{formatNumber(currentYearTotals.total_amount)}
                </td>
                <td className="py-3 px-3 text-center font-mono text-emerald-600/70 dark:text-emerald-500/70">
                  ₩{formatNumber(lastYearTotals.total_amount)}
                </td>
                <td className={`py-3 px-3 text-center font-mono ${
                  (currentYearTotals.total_amount - lastYearTotals.total_amount) >= 0
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  <div className="flex items-center justify-center gap-1">
                    {(currentYearTotals.total_amount - lastYearTotals.total_amount) >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {lastYearTotals.total_amount > 0
                      ? `${(currentYearTotals.total_amount - lastYearTotals.total_amount) >= 0 ? '+' : ''}${(((currentYearTotals.total_amount - lastYearTotals.total_amount) / lastYearTotals.total_amount) * 100).toFixed(1)}%`
                      : '-'
                    }
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="font-semibold mb-1 text-blue-700 dark:text-blue-300">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>업종분류코드: 28800 (인터넷/웹샵)</li>
          <li>거래처그룹2: 웹샵</li>
          <li>지역: 동부, 서부, 중부</li>
        </ul>
      </div>
    </div>
  );
}
