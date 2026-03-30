"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface IndustryDairyData {
  품목코드: string;
  품목명: string;
  youngil_category: string;
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface IndustryDairyResponse {
  industryDairyData: IndustryDairyData[];
  currentYear: string;
  lastYear: string;
}

export default function IndustryDairyTab() {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<IndustryDairyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchIndustryDairyData();
  }, [includeVat]);

  const fetchIndustryDairyData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(
        withIncludeVat('/api/dashboard/b2b-meetings?tab=industry-dairy', includeVat)
      );
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch industry dairy data:', error);
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

  const { industryDairyData, currentYear, lastYear } = data;

  // Organize data by item, year, and month
  const getMonthData = (itemKey: string, year: string, month: string) => {
    const [code, name, category] = itemKey.split('|');
    const yearMonth = `${year}-${month}`;
    return industryDairyData.find(
      d => d.품목코드 === code && d.품목명 === name && d.youngil_category === category && d.year_month === yearMonth
    );
  };

  // Calculate totals by item and year
  const getTotalsByItemAndYear = (itemKey: string, year: string) => {
    const [code, name, category] = itemKey.split('|');
    const yearData = industryDairyData.filter(
      d => d.품목코드 === code && d.품목명 === name && d.youngil_category === category && d.year === year
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
    const yearData = industryDairyData.filter(d => d.year === year);
    return yearData.reduce(
      (acc, d) => ({
        total_weight: acc.total_weight + d.total_weight,
        total_amount: acc.total_amount + d.total_amount,
        total_quantity: acc.total_quantity + d.total_quantity,
      }),
      { total_weight: 0, total_amount: 0, total_quantity: 0 }
    );
  };

  const currentYearGrandTotals = getGrandTotalsByYear(currentYear);
  const lastYearGrandTotals = getGrandTotalsByYear(lastYear);
  const totalAmountChange = calculateChange(currentYearGrandTotals.total_amount, lastYearGrandTotals.total_amount);
  const totalWeightChange = calculateChange(currentYearGrandTotals.total_weight, lastYearGrandTotals.total_weight);

  // Get unique items
  const itemKeys = Array.from(new Set(industryDairyData.map(d => `${d.품목코드}|${d.품목명}|${d.youngil_category}`))).sort();

  // Group items by category
  const categoriesMap = itemKeys.reduce((acc, itemKey) => {
    const [,, category] = itemKey.split('|');
    const categoryName = category || '미분류';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(itemKey);
    return acc;
  }, {} as Record<string, string[]>);

  const sortedCategories = Object.keys(categoriesMap).sort((a, b) => {
    const aTotals = categoriesMap[a].reduce((sum, key) => sum + getTotalsByItemAndYear(key, currentYear).total_amount, 0);
    const bTotals = categoriesMap[b].reduce((sum, key) => sum + getTotalsByItemAndYear(key, currentYear).total_amount, 0);
    return bTotals - aTotals;
  });

  const getCategoryTotals = (category: string, year: string) => {
    const itemKeys = categoriesMap[category] || [];
    return itemKeys.reduce((acc, key) => {
      const totals = getTotalsByItemAndYear(key, year);
      return {
        total_weight: acc.total_weight + totals.total_weight,
        total_amount: acc.total_amount + totals.total_amount,
      };
    }, { total_weight: 0, total_amount: 0 });
  };

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).filter(m => {
    const now = new Date();
    const currentYearNum = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;
    const yearNum = parseInt(currentYear);
    if (yearNum < currentYearNum) return true;
    if (yearNum === currentYearNum && parseInt(m) <= currentMonthNum) return true;
    return false;
  });

  const handleExcelDownload = () => {
    if (!data) return;
    const exportData = itemKeys.map(itemKey => {
      const [code, name, category] = itemKey.split('|');
      const currentTotals = getTotalsByItemAndYear(itemKey, currentYear);
      const lastTotals = getTotalsByItemAndYear(itemKey, lastYear);
      return {
        '품목코드': code,
        '품목명': name,
        '영일분류': category,
        [`용량(${currentYear})`]: currentTotals.total_weight,
        [`용량(${lastYear})`]: lastTotals.total_weight,
        [`합계(${currentYear})`]: currentTotals.total_amount,
        [`합계(${lastYear})`]: lastTotals.total_amount,
      };
    });
    exportToExcel(exportData, generateFilename('B2B산업유제품_품목별'));
  };

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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">산업유제품 전체 합계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 중량</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(currentYearGrandTotals.total_weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 중량 대비 100%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 금액</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(currentYearGrandTotals.total_amount)} 원</p>
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
              {totalAmountChange.isPositive ? (
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">전년 대비 증감</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentYear} vs {lastYear}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">중량 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${totalWeightChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {totalWeightChange.isPositive ? '+' : ''}{totalWeightChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                {totalWeightChange.isPositive ? '+' : ''}{formatNumber(currentYearGrandTotals.total_weight - lastYearGrandTotals.total_weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">금액 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${totalAmountChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {totalAmountChange.isPositive ? '+' : ''}{totalAmountChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                {totalAmountChange.isPositive ? '+' : ''}{formatNumber(currentYearGrandTotals.total_amount - lastYearGrandTotals.total_amount)} 원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Year-over-Year Comparison Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">품목별 연도 비교</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">품목명</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">영일분류</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">용량 ({currentYear})</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-zinc-400 uppercase tracking-wider">용량 ({lastYear})</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">합계 ({currentYear})</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-emerald-500/70 uppercase tracking-wider">합계 ({lastYear})</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">증감</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map(category => {
                const categoryCurrentTotals = getCategoryTotals(category, currentYear);
                const categoryLastTotals = getCategoryTotals(category, lastYear);
                const categoryAmountChange = calculateChange(categoryCurrentTotals.total_amount, categoryLastTotals.total_amount);

                return (
                  <Fragment key={category}>
                    {/* Category Header Row */}
                    <tr className="bg-zinc-100/50 dark:bg-zinc-800/80 font-bold border-y border-zinc-200 dark:border-zinc-700">
                      <td colSpan={2} className="py-2 px-4 text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600 dark:text-blue-400 text-xs">●</span>
                          {category}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(categoryCurrentTotals.total_weight)}
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-zinc-500 dark:text-zinc-400">
                        {formatNumber(categoryLastTotals.total_weight)}
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-emerald-700 dark:text-emerald-300">
                        ₩{formatNumber(categoryCurrentTotals.total_amount)}
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-emerald-600/70 dark:text-emerald-500/70">
                        ₩{formatNumber(categoryLastTotals.total_amount)}
                      </td>
                      <td className={`py-2 px-4 text-center font-mono ${
                        categoryAmountChange.isPositive ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        <div className="flex items-center justify-center gap-1 text-xs">
                          {categoryAmountChange.isPositive ? '+' : ''}{categoryAmountChange.percent.toFixed(1)}%
                        </div>
                      </td>
                    </tr>

                    {/* Item Rows for this category */}
                    {categoriesMap[category].map(itemKey => {
                      const [code, name, cat] = itemKey.split('|');
                      const currentTotals = getTotalsByItemAndYear(itemKey, currentYear);
                      const lastTotals = getTotalsByItemAndYear(itemKey, lastYear);
                      const itemAmountChange = calculateChange(currentTotals.total_amount, lastTotals.total_amount);

                      return (
                        <tr
                          key={itemKey}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-3 px-4 pl-8">
                            <div className="font-medium text-zinc-800 dark:text-zinc-200">{name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{code}</div>
                          </td>
                          <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 text-xs italic">
                            {cat}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                            {formatNumber(currentTotals.total_weight)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-zinc-400 dark:text-zinc-500 text-xs">
                            {formatNumber(lastTotals.total_weight)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium text-emerald-600 dark:text-emerald-400 text-xs">
                            ₩{formatNumber(currentTotals.total_amount)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-emerald-500/60 dark:text-emerald-500/60 text-xs">
                            ₩{formatNumber(lastTotals.total_amount)}
                          </td>
                          <td className={`py-3 px-4 text-center font-mono text-xs ${
                            itemAmountChange.isPositive ? 'text-blue-500/80 dark:text-blue-400/80' : 'text-red-500/80 dark:text-red-400/80'
                          }`}>
                            <div className="flex items-center justify-center gap-1">
                              {itemAmountChange.isPositive ? (
                                <TrendingUp className="w-2.5 h-2.5" />
                              ) : (
                                <TrendingDown className="w-2.5 h-2.5" />
                              )}
                              {itemAmountChange.isPositive ? '+' : ''}{itemAmountChange.percent.toFixed(1)}%
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}

              {/* Totals Row */}
              <tr className="bg-zinc-50 dark:bg-zinc-800/30 font-bold border-t-2 border-zinc-300 dark:border-zinc-700">
                <td colSpan={2} className="py-3 px-4 text-zinc-900 dark:text-zinc-100">
                  전체 합계
                </td>
                <td className="py-3 px-4 text-center font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(currentYearGrandTotals.total_weight)}
                </td>
                <td className="py-3 px-4 text-center font-mono text-zinc-700 dark:text-zinc-300">
                  {formatNumber(lastYearGrandTotals.total_weight)}
                </td>
                <td className="py-3 px-4 text-center font-mono text-emerald-700 dark:text-emerald-300">
                  ₩{formatNumber(currentYearGrandTotals.total_amount)}
                </td>
                <td className="py-3 px-4 text-center font-mono text-emerald-600/70 dark:text-emerald-500/70">
                  ₩{formatNumber(lastYearGrandTotals.total_amount)}
                </td>
                <td className={`py-3 px-4 text-center font-mono ${
                  totalAmountChange.isPositive
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  <div className="flex items-center justify-center gap-1">
                    {totalAmountChange.isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {totalAmountChange.isPositive ? '+' : ''}{totalAmountChange.percent.toFixed(1)}%
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Panel */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="font-semibold mb-1 text-blue-700 dark:text-blue-300">데이터 분류:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>품목: 개별 산업유제품 (품목그룹1코드 = 'IL')</li>
          <li>영일분류: 각 품목이 속한 영일분류 표시</li>
          <li>B2B 거래처만 포함 (AUTO 채널 제외)</li>
          <li>품목 코드를 기반으로 월별 상세 실적 및 연도별 비교 데이터를 제공합니다.</li>
        </ul>
      </div>
    </div>
  );
}
