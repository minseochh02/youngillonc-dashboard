"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface RegionData {
  region: string;
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface RegionResponse {
  regionData: RegionData[];
  currentYear: string;
  lastYear: string;
}

export default function RegionTab() {
  const [data, setData] = useState<RegionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRegionData();
  }, []);

  const fetchRegionData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/dashboard/b2b-meetings?tab=region');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch region data:', error);
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

  const { regionData, currentYear, lastYear } = data;
  const regions = ['서울경기', '충청', '경남'];

  // Get all months from Jan to Dec
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return month;
  }).filter(m => {
    const monthNum = parseInt(m);
    const now = new Date();
    const currentYearNum = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;
    const yearNum = parseInt(currentYear);
    
    if (yearNum < currentYearNum) return true;
    if (yearNum === currentYearNum && monthNum <= currentMonthNum) return true;
    return false;
  });

  // Organize data by region, year, and month
  const getMonthData = (region: string, year: string, month: string) => {
    const yearMonth = `${year}-${month}`;
    return regionData.find(
      d => d.region === region && d.year_month === yearMonth
    );
  };

  // Calculate totals by region and year
  const getTotalsByRegionAndYear = (region: string, year: string) => {
    const yearData = regionData.filter(
      d => d.region === region && d.year === year
    );
    return yearData.reduce(
      (acc, d) => ({
        total_weight: acc.total_weight + d.total_weight,
        total_amount: acc.total_amount + d.total_amount,
        total_quantity: acc.total_quantity + d.total_quantity,
      }),
      { total_weight: 0, total_amount: 0, total_quantity: 0 }
    );
  };

  // Calculate grand totals by year
  const getGrandTotalsByYear = (year: string) => {
    const yearData = regionData.filter(d => d.year === year);
    return yearData.reduce(
      (acc, d) => ({
        total_weight: acc.total_weight + d.total_weight,
        total_amount: acc.total_amount + d.total_amount,
        total_quantity: acc.total_quantity + d.total_quantity,
      }),
      { total_weight: 0, total_amount: 0, total_quantity: 0 }
    );
  };

  const handleExcelDownload = () => {
    if (!data) return;

    const exportData: any[] = [];

    // Summary section
    exportData.push({ '지역': '연도별 비교 (전년 동기 대비)' });
    exportData.push({
      '지역': '지역',
      [`${currentYear}년 용량(L)`]: `${currentYear}년 용량(L)`,
      [`${lastYear}년 용량(L)`]: `${lastYear}년 용량(L)`,
      '변화율(%)': '변화율(%)',
    });

    regions.forEach(region => {
      const currentData = getTotalsByRegionAndYear(region, currentYear);
      const lastData = getTotalsByRegionAndYear(region, lastYear);
      const change = calculateChange(currentData.total_weight, lastData.total_weight);

      exportData.push({
        '지역': region,
        [`${currentYear}년 용량(L)`]: currentData.total_weight,
        [`${lastYear}년 용량(L)`]: lastData.total_weight,
        '변화율(%)': change.percent.toFixed(1),
      });
    });

    exportData.push({});

    // Monthly breakdown
    exportData.push({ '월': '월별 용량 비교 (전년 동월 대비)' });
    const monthlyHeaderRow: any = { '월': '월' };
    regions.forEach(region => {
      monthlyHeaderRow[`${region} ${currentYear}`] = `${region} ${currentYear}`;
      monthlyHeaderRow[`${region} ${lastYear}`] = `${region} ${lastYear}`;
      monthlyHeaderRow[`${region} 변화율(%)`] = `${region} 변화율(%)`;
    });
    exportData.push(monthlyHeaderRow);

    months.forEach(month => {
      const row: any = { '월': `${parseInt(month)}월` };

      regions.forEach(region => {
        const currentMonthData = getMonthData(region, currentYear, month);
        const lastMonthData = getMonthData(region, lastYear, month);
        const currentWeight = currentMonthData?.total_weight || 0;
        const lastWeight = lastMonthData?.total_weight || 0;
        const change = calculateChange(currentWeight, lastWeight);

        row[`${region} ${currentYear}`] = currentWeight;
        row[`${region} ${lastYear}`] = lastWeight;
        row[`${region} 변화율(%)`] = change.percent.toFixed(1);
      });

      exportData.push(row);
    });

    const filename = generateFilename('B2B지역별');
    exportToExcel(exportData, filename);
  };

  const currentYearTotals = getGrandTotalsByYear(currentYear);
  const lastYearTotals = getGrandTotalsByYear(lastYear);
  const grandTotalChange = calculateChange(currentYearTotals.total_weight, lastYearTotals.total_weight);

  return (
    <div className="space-y-6">
      {/* Header with Download Button */}
      <div className="flex justify-end">
        <ExcelDownloadButton onClick={handleExcelDownload} disabled={!data || isLoading} />
      </div>

      {/* Year Comparison Summary */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">지역별 연도 비교 (PVL + CVL)</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">지역</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">{currentYear}년 용량(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{lastYear}년 용량(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">변화율</th>
              </tr>
            </thead>
            <tbody>
              {regions.map(region => {
                const currentData = getTotalsByRegionAndYear(region, currentYear);
                const lastData = getTotalsByRegionAndYear(region, lastYear);
                const change = calculateChange(currentData.total_weight, lastData.total_weight);

                return (
                  <tr
                    key={region}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">{region}</td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                      {formatNumber(currentData.total_weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(lastData.total_weight)}
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
              {/* Total row */}
              <tr className="bg-zinc-100 dark:bg-zinc-800/70 font-bold">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">총계</td>
                <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300">
                  {formatNumber(currentYearTotals.total_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                  {formatNumber(lastYearTotals.total_weight)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium ${
                    grandTotalChange.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {grandTotalChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(grandTotalChange.percent).toFixed(1)}%
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
                {regions.map(region => (
                  <th key={region} className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                    {region}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map(month => {
                return (
                  <tr key={month} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100 sticky left-0 bg-white dark:bg-zinc-900">
                      {parseInt(month)}월
                    </td>
                    {regions.map(region => {
                      const currentMonthData = getMonthData(region, currentYear, month);
                      const lastMonthData = getMonthData(region, lastYear, month);
                      const currentWeight = currentMonthData?.total_weight || 0;
                      const lastWeight = lastMonthData?.total_weight || 0;
                      const change = calculateChange(currentWeight, lastWeight);

                      return (
                        <td key={region} className="py-3 px-4 text-right">
                          <div className="font-mono text-zinc-900 dark:text-zinc-100 text-xs">
                            {formatNumber(currentWeight)}
                          </div>
                          <div className={`text-[10px] font-medium flex items-center justify-end gap-0.5 ${
                            change.isPositive ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {change.isPositive ? '↑' : '↓'}
                            {Math.abs(change.percent).toFixed(0)}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>제품: PVL, CVL (품목그룹1코드)</li>
          <li>지역: 지역세분 기준 (서울경기, 충청, 경남)</li>
          <li>기간: {lastYear}년 vs {currentYear}년</li>
        </ul>
      </div>
    </div>
  );
}
