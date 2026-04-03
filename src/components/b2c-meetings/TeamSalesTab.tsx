"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface SalesDataRow {
  team: string;
  employee_name: string;
  product_group: 'PVL' | 'CVL' | 'OTHERS';
  year: string;
  year_month: string;
  total_amount: number;
}

interface TeamSalesData {
  salesData: SalesDataRow[];
  currentYear: string;
  lastYear: string;
}

interface TeamSalesTabProps {
  selectedMonth?: string;
}

export default function TeamSalesTab({ selectedMonth }: TeamSalesTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<TeamSalesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, includeVat]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/b2c-meetings?tab=team-sales${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch team sales data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Helper for month display
  const getMonthName = (monthStr: string) => {
    if (!monthStr) return '';
    const parts = monthStr.split('-');
    return parts.length > 1 ? `${parseInt(parts[1])}월` : monthStr;
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

  const { currentYear, lastYear, salesData } = data;

  // Calculate cumulative period labels
  const currentMonthStr = selectedMonth || `${currentYear}-12`;
  const [__, currentMonthNum] = currentMonthStr.split('-');

  // Create a structure for the table: team -> employee -> product_group -> month -> {current, last}
  const tableData = new Map<string, Map<string, Map<string, Map<string, { current: number; last: number }>>>>();

  // Define product group order
  const productGroupOrder = ['PVL', 'CVL', 'OTHERS'];

  salesData.forEach(row => {
    if (!tableData.has(row.team)) {
      tableData.set(row.team, new Map());
    }
    const teamMap = tableData.get(row.team)!;

    if (!teamMap.has(row.employee_name)) {
      teamMap.set(row.employee_name, new Map());
    }
    const employeeMap = teamMap.get(row.employee_name)!;

    if (!employeeMap.has(row.product_group)) {
      employeeMap.set(row.product_group, new Map());
    }
    const productMap = employeeMap.get(row.product_group)!;

    const month = row.year_month;
    if (!productMap.has(month)) {
      productMap.set(month, { current: 0, last: 0 });
    }

    if (row.year === currentYear) {
      productMap.get(month)!.current = row.total_amount;
    } else if (row.year === lastYear) {
      productMap.get(month)!.last = row.total_amount;
    }
  });

  // Calculate monthly totals for current year only (for summary cards)
  const monthlyTotals = new Map<string, number>();
  salesData.forEach(row => {
    if (row.year === currentYear) {
      const current = monthlyTotals.get(row.year_month) || 0;
      monthlyTotals.set(row.year_month, current + row.total_amount);
    }
  });

  // Generate month labels - filter by selected month
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return `${currentYear}-${month}`;
  }).filter(m => {
    const [year, month] = m.split('-').map(Number);
    const selectedYear = parseInt(currentYear);
    const selectedMonth = parseInt(currentMonthNum);

    if (year < selectedYear) return true;
    if (year === selectedYear && month <= selectedMonth) return true;
    return false;
  });

  const handleExcelDownload = () => {
    if (!data) return;

    const exportData: any[] = [];

    // Header row
    const headerRow: any = {
      '팀명': '팀명',
      '담당자명': '담당자명',
      '그룹': '그룹',
    };
    months.forEach((month, index) => {
      headerRow[`${index + 1}월`] = `${index + 1}월`;
    });
    headerRow['합계'] = '합계';
    exportData.push(headerRow);

    // Data rows
    tableData.forEach((teamMap, team) => {
      teamMap.forEach((employeeMap, employeeName) => {
        // Sort product groups in order: PVL, CVL, OTHERS
        const sortedGroups = Array.from(employeeMap.keys()).sort((a, b) => {
          return productGroupOrder.indexOf(a) - productGroupOrder.indexOf(b);
        });

        sortedGroups.forEach(productGroup => {
          const productMap = employeeMap.get(productGroup)!;
          const row: any = {
            '팀명': team,
            '담당자명': employeeName,
            '그룹': productGroup,
          };

          let rowTotal = 0;
          months.forEach((month, index) => {
            const value = productMap.get(month) || 0;
            row[`${index + 1}월`] = value;
            rowTotal += value;
          });
          row['합계'] = rowTotal;

          exportData.push(row);
        });
      });
    });

    // Totals row
    const totalsRow: any = {
      '팀명': '총합계',
      '담당자명': '',
      '그룹': '',
    };
    let grandTotal = 0;
    months.forEach((month, index) => {
      const value = monthlyTotals.get(month) || 0;
      totalsRow[`${index + 1}월`] = value;
      grandTotal += value;
    });
    totalsRow['합계'] = grandTotal;
    exportData.push(totalsRow);

    const filename = generateFilename('팀매출액');
    exportToExcel(exportData, filename, { referenceDate: selectedMonth });
  };

  // Calculate totals for summary cards - use selected month
  const latestMonth = currentMonthStr; // Use selected month instead of current date
  const monthNum = parseInt(currentMonthNum);
  const previousMonthNum = monthNum > 1 ? monthNum - 1 : 12;
  const previousMonthYear = monthNum > 1 ? currentYear : String(parseInt(currentYear) - 1);
  const previousMonth = `${previousMonthYear}-${String(previousMonthNum).padStart(2, '0')}`;

  const latestSales = monthlyTotals.get(latestMonth) || 0;
  const previousSales = monthlyTotals.get(previousMonth) || 0;
  
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
  };

  const monthChange = calculateChange(latestSales, previousSales);
  const annualTotal = Array.from(monthlyTotals.values()).reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Month Sales Card */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">최근 월별 매출 (1월~{parseInt(currentMonthNum)}월)</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{getMonthName(latestMonth)} 기준 실적</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 총 매출액</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(latestSales)} 원</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                연누계 {formatNumber(annualTotal)} 원 중 {((latestSales / (annualTotal || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전월 대비</p>
              <div className="flex items-baseline gap-2 mt-1">
                {monthChange.isPositive ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <p className={`text-2xl font-bold ${monthChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {monthChange.isPositive ? '+' : ''}{monthChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전월({getMonthName(previousMonth)}): {formatNumber(previousSales)} 원
              </p>
            </div>
          </div>
        </div>

        {/* Annual Total Card */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">연간 누적 매출액</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">1월~{parseInt(currentMonthNum)}월 누계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">연간 총 매출액</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{formatNumber(annualTotal)} 원</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                현재까지 누적 실적
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">월평균 매출액</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{formatNumber(Math.round(annualTotal / months.length))} 원</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {months.length}개월 평균
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Amount Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {currentYear}년 팀별 담당자별 매출액 (공급가) - 1월~{parseInt(currentMonthNum)}월
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-20">
                  팀명
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-24">
                  담당자명
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-20">
                  그룹
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-16">
                  월
                </th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {lastYear}년(원)
                </th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">
                  {currentYear}년(원)
                </th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  변화율
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(tableData.entries()).map(([team, teamMap]) => {
                return Array.from(teamMap.entries()).map(([employeeName, employeeMap]) => {
                  // Sort product groups: PVL, CVL, OTHERS
                  const sortedGroups = Array.from(employeeMap.keys()).sort((a, b) => {
                    return productGroupOrder.indexOf(a) - productGroupOrder.indexOf(b);
                  });

                  return sortedGroups.map((productGroup) => {
                    const productMap = employeeMap.get(productGroup)!;
                    const rowKey = `${team}-${employeeName}-${productGroup}`;

                    // Calculate cumulative totals
                    const cumulativeCurrent = months.reduce((sum, month) => {
                      const data = productMap.get(month);
                      return sum + (data?.current || 0);
                    }, 0);
                    const cumulativeLast = months.reduce((sum, month) => {
                      const monthLast = `${lastYear}${month.substring(4)}`;
                      const data = productMap.get(monthLast);
                      return sum + (data?.last || 0);
                    }, 0);
                    const cumulativeChange = calculateChange(cumulativeCurrent, cumulativeLast);

                    return (
                      <React.Fragment key={rowKey}>
                        {/* Cumulative Row */}
                        <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 font-semibold">
                          <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-xs">{team}</td>
                          <td className="py-3 px-2 font-medium text-zinc-900 dark:text-zinc-100 text-sm">{employeeName}</td>
                          <td className="py-3 px-2 text-zinc-600 dark:text-zinc-400 text-xs">{productGroup}</td>
                          <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 text-sm">누계</td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                            {formatNumber(cumulativeLast)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-bold">
                            {formatNumber(cumulativeCurrent)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 font-medium text-xs ${cumulativeChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {cumulativeChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(cumulativeChange.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>

                        {/* Monthly Rows */}
                        {months.map((month) => {
                          const monthLast = `${lastYear}${month.substring(4)}`;
                          const data = productMap.get(month) || { current: 0, last: 0 };
                          const dataLast = productMap.get(monthLast) || { current: 0, last: 0 };
                          const valueCurrent = data.current;
                          const valueLast = dataLast.last;
                          const monthChange = calculateChange(valueCurrent, valueLast);
                          const monthNum = parseInt(month.split('-')[1]);

                          return (
                            <tr
                              key={`${rowKey}-${month}`}
                              className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                            >
                              <td className="py-2 px-2"></td>
                              <td className="py-2 px-2"></td>
                              <td className="py-2 px-2"></td>
                              <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 text-sm">{monthNum}월</td>
                              <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                                {valueLast > 0 ? formatNumber(valueLast) : '-'}
                              </td>
                              <td className="py-2 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                                {valueCurrent > 0 ? formatNumber(valueCurrent) : '-'}
                              </td>
                              <td className="py-2 px-4 text-right">
                                <span className={`inline-flex items-center gap-1 font-medium text-xs ${monthChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {monthChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {Math.abs(monthChange.percent).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                });
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>제품 그룹: AUTO, OTHERS (품목그룹1코드)</li>
          <li>팀별: employee_category.b2c_팀 기준</li>
          <li>기간: {currentYear}년 (월별)</li>
          <li>단위: 원 (매출액 - 공급가)</li>
        </ul>
      </div>
    </div>
  );
}
