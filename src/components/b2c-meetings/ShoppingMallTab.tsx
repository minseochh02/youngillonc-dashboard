"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface SalesData {
  region: string;
  year: string;
  month?: string;
  transaction_count: number;
  client_count: number;
  total_quantity: number;
  total_weight: number;
  total_supply_amount: number;
  total_amount: number;
  total_points: number;
  net_amount: number;
}

interface ShoppingMallData {
  salesData: SalesData[];
  regions: string[];
  currentYear: string;
}

interface ShoppingMallTabProps {
  selectedMonth?: string;
}

export default function ShoppingMallTab({ selectedMonth }: ShoppingMallTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<ShoppingMallData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchShoppingMallData();
  }, [selectedMonth, includeVat]);

  const fetchShoppingMallData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/b2c-meetings?tab=shopping-mall${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
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
    return Math.round(num).toLocaleString();
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

  const { salesData, regions, currentYear } = data;

  // Get data for a specific team and month
  const getTeamMonthData = (team: string, month: string) => {
    return salesData.find(d => d.region === team && d.month === month);
  };

  // Calculate totals for a specific month across all teams
  const getMonthTotals = (month: string) => {
    const monthData = salesData.filter(d => d.month === month);
    return monthData.reduce((acc, d) => ({
      transaction_count: acc.transaction_count + d.transaction_count,
      client_count: acc.client_count + d.client_count,
      total_quantity: acc.total_quantity + d.total_quantity,
      total_weight: acc.total_weight + d.total_weight,
      total_supply_amount: acc.total_supply_amount + d.total_supply_amount,
      total_amount: acc.total_amount + d.total_amount,
      total_points: acc.total_points + d.total_points,
      net_amount: acc.net_amount + d.net_amount,
    }), {
      transaction_count: 0,
      client_count: 0,
      total_quantity: 0,
      total_weight: 0,
      total_supply_amount: 0,
      total_amount: 0,
      total_points: 0,
      net_amount: 0,
    });
  };

  // All months in a year
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Monthly breakdown for Excel
    months.forEach((month) => {
      regions.forEach((team) => {
        const monthData = getTeamMonthData(team, month);
        if (monthData) {
          exportData.push({
            '월': `${month}월`,
            '팀': team,
            '거래건수': monthData.transaction_count,
            '거래처수': monthData.client_count,
            '중량': monthData.total_weight,
            '총 주문금액': monthData.total_amount,
            '사용한 포인트': monthData.total_points,
            '실 결제금액': monthData.net_amount,
          });
        }
      });
    });

    const filename = generateFilename(`B2C쇼핑몰판매현황_${currentYear}년_월별`);
    exportToExcel(exportData, filename);
  };

  // Calculate totals for summary cards
  const grandTotal = salesData.reduce((acc, d) => ({
    total_amount: acc.total_amount + d.total_amount,
    total_points: acc.total_points + d.total_points,
    net_amount: acc.net_amount + d.net_amount,
    total_weight: acc.total_weight + d.total_weight,
    transaction_count: acc.transaction_count + d.transaction_count,
  }), { total_amount: 0, total_points: 0, net_amount: 0, total_weight: 0, transaction_count: 0 });

  // Get data for latest month with sales
  const monthsWithData = months.filter(m => getMonthTotals(m).total_amount > 0);
  const latestMonth = monthsWithData[monthsWithData.length - 1];
  const previousMonth = monthsWithData[monthsWithData.length - 2];
  
  const latestMonthTotals = latestMonth ? getMonthTotals(latestMonth) : null;
  const previousMonthTotals = previousMonth ? getMonthTotals(previousMonth) : null;

  const calculateChangeInternal = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
  };

  const monthChange = latestMonthTotals && previousMonthTotals 
    ? calculateChangeInternal(latestMonthTotals.net_amount, previousMonthTotals.net_amount)
    : { percent: 0, isPositive: false };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Annual Performance Card */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">쇼핑몰 연간 누적 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentYear}년 전체 누계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">실 결제금액</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">₩{formatNumber(grandTotal.net_amount)}</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                총 주문금액 {formatNumber(grandTotal.total_amount)} 대비 {((grandTotal.net_amount / (grandTotal.total_amount || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">거래 규모</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatNumber(grandTotal.transaction_count)} 건</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                총 중량: {formatNumber(grandTotal.total_weight)} kg
              </p>
            </div>
          </div>
        </div>

        {/* Latest Month Trend Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              {monthChange.isPositive ? (
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">최근 월별 트렌드</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{latestMonth ? `${parseInt(latestMonth)}월` : '-'} vs {previousMonth ? `${parseInt(previousMonth)}월` : '-'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">결제액 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${monthChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {monthChange.isPositive ? '+' : ''}{monthChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                {latestMonthTotals ? `₩${formatNumber(latestMonthTotals.net_amount)}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">주문수 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                {latestMonthTotals && previousMonthTotals ? (
                  (() => {
                    const countChange = calculateChangeInternal(latestMonthTotals.transaction_count, previousMonthTotals.transaction_count);
                    return (
                      <p className={`text-2xl font-bold ${countChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {countChange.isPositive ? '+' : ''}{countChange.percent.toFixed(1)}%
                      </p>
                    );
                  })()
                ) : (
                  <p className="text-2xl font-bold text-zinc-400">-</p>
                )}
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                {latestMonthTotals ? `${latestMonthTotals.transaction_count} 건` : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Sales Breakdown Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider border-r border-zinc-200 dark:border-zinc-700">
                  월 / 팀
                </th>
                {regions.map(team => (
                  <th key={team} className="py-3 px-4 text-center text-xs font-bold text-zinc-600 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700">
                    {team}
                  </th>
                ))}
                <th className="py-3 px-4 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  월별 합계
                </th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const monthTotals = getMonthTotals(month);
                
                // Only show rows that have data
                if (monthTotals.total_amount === 0 && monthTotals.transaction_count === 0) return null;

                return (
                  <tr
                    key={month}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-700">
                      {parseInt(month)}월
                    </td>
                    {regions.map((team) => {
                      const teamMonthData = getTeamMonthData(team, month);
                      return (
                        <td key={team} className="py-3 px-4 text-right font-mono border-r border-zinc-200 dark:border-zinc-700">
                          <div className="flex flex-col">
                            <span className="text-zinc-900 dark:text-zinc-100 font-semibold text-xs">₩{formatNumber(teamMonthData?.total_amount || 0)}</span>
                            {teamMonthData && teamMonthData.total_points > 0 && (
                              <span className="text-[10px] text-red-500">- ₩{formatNumber(teamMonthData.total_points)} (Pt)</span>
                            )}
                            <span className="text-blue-600 dark:text-blue-400 font-bold">₩{formatNumber(teamMonthData?.net_amount || 0)}</span>
                            <span className="text-[10px] text-zinc-400 mt-1">{formatNumber(teamMonthData?.total_weight || 0)} kg / {teamMonthData?.transaction_count || 0}건</span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right font-mono bg-emerald-50/30 dark:bg-emerald-900/10">
                      <div className="flex flex-col">
                        <span className="text-zinc-600 dark:text-zinc-400 font-semibold text-xs">₩{formatNumber(monthTotals.total_amount)}</span>
                        {monthTotals.total_points > 0 && (
                          <span className="text-[10px] text-red-600">- ₩{formatNumber(monthTotals.total_points)} (Pt)</span>
                        )}
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold">₩{formatNumber(monthTotals.net_amount)}</span>
                        <span className="text-[10px] text-emerald-600/70 mt-1">{formatNumber(monthTotals.total_weight)} kg / {monthTotals.transaction_count}건</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Annual Totals Row */}
              <tr className="bg-zinc-100/50 dark:bg-zinc-800/50 font-bold border-t-2 border-zinc-300 dark:border-zinc-700">
                <td className="py-4 px-4 text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-700">
                  {currentYear}년 총계
                </td>
                {regions.map((team) => {
                  const teamData = salesData.filter(d => d.region === team);
                  const teamAnnualTotal = teamData.reduce((acc, d) => ({
                    total_amount: acc.total_amount + d.total_amount,
                    total_points: acc.total_points + d.total_points,
                    net_amount: acc.net_amount + d.net_amount,
                    total_weight: acc.total_weight + d.total_weight,
                    transaction_count: acc.transaction_count + d.transaction_count,
                  }), { total_amount: 0, total_points: 0, net_amount: 0, total_weight: 0, transaction_count: 0 });

                  return (
                    <td key={team} className="py-4 px-4 text-right font-mono border-r border-zinc-200 dark:border-zinc-700">
                      <div className="flex flex-col">
                        <span className="text-zinc-500 dark:text-zinc-400 text-xs">₩{formatNumber(teamAnnualTotal.total_amount)}</span>
                        {teamAnnualTotal.total_points > 0 && (
                          <span className="text-[10px] text-red-500">- ₩{formatNumber(teamAnnualTotal.total_points)}</span>
                        )}
                        <span className="text-zinc-900 dark:text-zinc-100 font-bold">₩{formatNumber(teamAnnualTotal.net_amount)}</span>
                        <span className="text-[10px] text-zinc-500 mt-1">{formatNumber(teamAnnualTotal.total_weight)} kg / {teamAnnualTotal.transaction_count}건</span>
                      </div>
                    </td>
                  );
                })}
                <td className="py-4 px-4 text-right font-mono bg-emerald-100/40 dark:bg-emerald-900/30">
                  {(() => {
                    const grandTotal = salesData.reduce((acc, d) => ({
                      total_amount: acc.total_amount + d.total_amount,
                      total_points: acc.total_points + d.total_points,
                      net_amount: acc.net_amount + d.net_amount,
                      total_weight: acc.total_weight + d.total_weight,
                      transaction_count: acc.transaction_count + d.transaction_count,
                    }), { total_amount: 0, total_points: 0, net_amount: 0, total_weight: 0, transaction_count: 0 });
                    return (
                      <div className="flex flex-col">
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs">₩{formatNumber(grandTotal.total_amount)}</span>
                        {grandTotal.total_points > 0 && (
                          <span className="text-[10px] text-red-600">- ₩{formatNumber(grandTotal.total_points)}</span>
                        )}
                        <span className="text-emerald-800 dark:text-emerald-200 text-base font-bold">₩{formatNumber(grandTotal.net_amount)}</span>
                        <span className="text-[10px] text-emerald-700/80 mt-1">{formatNumber(grandTotal.total_weight)} kg / {grandTotal.transaction_count}건</span>
                      </div>
                    );
                  })()}
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
          <li>데이터 소스: 쇼핑몰 판매현황 (shopping_sales)</li>
          <li>분류 기준: B2C 팀별 (담당자 매칭)</li>
          <li>대상 팀: {regions.join(', ')}</li>
        </ul>
      </div>
    </div>
  );
}
