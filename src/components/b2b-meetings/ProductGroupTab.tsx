"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface ProductGroupData {
  product_group: string;
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface ProductGroupResponse {
  productGroupData: ProductGroupData[];
  currentYear: string;
  lastYear: string;
  availableMonths?: string[];
  currentMonth?: string;
}

interface ProductGroupTabProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function ProductGroupTab({ selectedMonth, onMonthsAvailable }: ProductGroupTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<ProductGroupResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProductGroupData();
  }, [includeVat, selectedMonth]);

  const fetchProductGroupData = async () => {
    setIsLoading(true);
    try {
      const q = selectedMonth ? `&month=${encodeURIComponent(selectedMonth)}` : '';
      const response = await apiFetch(
        withIncludeVat(`/api/dashboard/b2b-meetings?tab=product-group${q}`, includeVat)
      );
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        const d = result.data;
        if (onMonthsAvailable && d?.availableMonths?.length) {
          onMonthsAvailable(d.availableMonths, d.currentMonth);
        }
      }
    } catch (error) {
      console.error('Failed to fetch product group data:', error);
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

  const { productGroupData, currentYear, lastYear, currentMonth: apiMonth } = data;
  const productGroups = ['Standard', 'Premium', 'Flagship', 'Alliance'];

  const refYm = selectedMonth || apiMonth || `${currentYear}-12`;
  const maxMonthNum = parseInt(refYm.split('-')[1]!, 10);

  const months = Array.from({ length: maxMonthNum }, (_, i) => String(i + 1).padStart(2, '0'));

  // Organize data by product group, year, and month
  const getMonthData = (productGroup: string, year: string, month: string) => {
    const yearMonth = `${year}-${month}`;
    return productGroupData.find(
      d => d.product_group === productGroup && d.year_month === yearMonth
    );
  };

  // Calculate totals by product group and year
  const getTotalsByProductGroupAndYear = (productGroup: string, year: string) => {
    const yearData = productGroupData.filter(
      d => d.product_group === productGroup && d.year === year
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
    const yearData = productGroupData.filter(d => d.year === year);
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

  const getProductGroupColor = (productGroup: string) => {
    switch (productGroup) {
      case 'Standard':
        return 'bg-blue-500';
      case 'Premium':
        return 'bg-purple-500';
      case 'Flagship':
        return 'bg-emerald-500';
      case 'Alliance':
        return 'bg-orange-500';
      default:
        return 'bg-zinc-400';
    }
  };

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    productGroups.forEach(productGroup => {
      const currentYearTotals = getTotalsByProductGroupAndYear(productGroup, currentYear);
      const lastYearTotals = getTotalsByProductGroupAndYear(productGroup, lastYear);

      const row: any = {
        '제품군': productGroup,
        [`용량(${currentYear})`]: currentYearTotals.total_weight,
        [`용량(${lastYear})`]: lastYearTotals.total_weight,
        [`합계(${currentYear})`]: currentYearTotals.total_amount,
        [`합계(${lastYear})`]: lastYearTotals.total_amount,
      };

      // Add monthly data
      months.forEach(month => {
        const currentMonthData = getMonthData(productGroup, currentYear, month);
        row[`${month}월(${currentYear})`] = currentMonthData?.total_amount || 0;
      });

      exportData.push(row);
    });

    const filename = generateFilename('B2B제품군');
    exportToExcel(exportData, filename);
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">전체 제품군 합계</p>
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

      {/* Individual Group Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {productGroups.map(productGroup => {
          const currentTotals = getTotalsByProductGroupAndYear(productGroup, currentYear);
          const lastTotals = getTotalsByProductGroupAndYear(productGroup, lastYear);
          const amountChange = currentTotals.total_amount - lastTotals.total_amount;
          const changePercent = lastTotals.total_amount > 0
            ? ((amountChange / lastTotals.total_amount) * 100).toFixed(1)
            : '0.0';

          return (
            <div
              key={productGroup}
              className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${getProductGroupColor(productGroup)}`} />
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {productGroup}
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    {currentYear} 합계
                  </div>
                  <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {formatNumber(currentTotals.total_amount)}
                  </div>
                  <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                    전체 {formatNumber(currentYearGrandTotals.total_amount)} 원 중 {((currentTotals.total_amount / (currentYearGrandTotals.total_amount || 1)) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {amountChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      amountChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {amountChange >= 0 ? '+' : ''}{changePercent}%
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">vs {lastYear}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly Sales Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">월별 매출 (합계)</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-50 dark:bg-zinc-800/50 z-10">
                  제품군
                </th>
                {months.map(month => (
                  <th
                    key={month}
                    className="py-3 px-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider"
                  >
                    {month}월
                  </th>
                ))}
                <th className="py-3 px-4 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  합계
                </th>
              </tr>
            </thead>
            <tbody>
              {productGroups.map(productGroup => {
                const yearTotals = getTotalsByProductGroupAndYear(productGroup, currentYear);

                return (
                  <tr
                    key={productGroup}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100 sticky left-0 bg-white dark:bg-zinc-900 z-10">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getProductGroupColor(productGroup)}`} />
                        {productGroup}
                      </div>
                    </td>
                    {months.map(month => {
                      const monthData = getMonthData(productGroup, currentYear, month);
                      return (
                        <td
                          key={month}
                          className="py-3 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300"
                        >
                          {monthData ? formatNumber(monthData.total_amount) : '-'}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      {formatNumber(yearTotals.total_amount)}
                    </td>
                  </tr>
                );
              })}

              {/* Grand Total Row */}
              <tr className="bg-zinc-50 dark:bg-zinc-800/30 font-bold border-t-2 border-zinc-300 dark:border-zinc-700">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100 sticky left-0 bg-zinc-50 dark:bg-zinc-800/30 z-10">
                  전체 합계
                </td>
                {months.map(month => {
                  const monthTotal = productGroups.reduce((sum, pg) => {
                    const monthData = getMonthData(pg, currentYear, month);
                    return sum + (monthData?.total_amount || 0);
                  }, 0);

                  return (
                    <td
                      key={month}
                      className="py-3 px-3 text-center font-mono text-zinc-900 dark:text-zinc-100"
                    >
                      {monthTotal > 0 ? formatNumber(monthTotal) : '-'}
                    </td>
                  );
                })}
                <td className="py-3 px-4 text-center font-mono text-emerald-700 dark:text-emerald-300">
                  {formatNumber(currentYearGrandTotals.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Group Definitions */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="font-semibold mb-2 text-blue-700 dark:text-blue-300">제품군 분류:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="font-medium">Standard</span>: Mobil 제품 중 품목그룹3코드 = 'STA'</li>
          <li><span className="font-medium">Premium</span>: Mobil 제품 중 품목그룹3코드 = 'PRE'</li>
          <li><span className="font-medium">Flagship</span>: Mobil 제품 중 품목그룹3코드 = 'FLA'</li>
          <li><span className="font-medium">Alliance</span>: 비Mobil 브랜드 (Fuchs, Blaser, Shell, GS Caltex, Castrol 등)</li>
        </ul>
      </div>
    </div>
  );
}
