"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface VolumeDataRow {
  team: string;
  employee_name: string;
  product_group: 'PVL' | 'CVL';
  year_month: string;
  total_weight: number;
}

interface TeamVolumeData {
  volumeData: VolumeDataRow[];
  currentYear: string;
}

interface TeamVolumeTabProps {
  selectedMonth?: string;
}

export default function TeamVolumeTab({ selectedMonth }: TeamVolumeTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<TeamVolumeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, includeVat]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/b2c-meetings?tab=team-volume${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch team volume data:', error);
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

  const { currentYear, volumeData } = data;

  // Create a structure for the table: team -> employee -> product_group -> monthly data
  const tableData = new Map<string, Map<string, Map<string, Map<string, number>>>>();

  volumeData.forEach(row => {
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

    productMap.set(row.year_month, row.total_weight);
  });

  // Calculate monthly totals
  const monthlyTotals = new Map<string, number>();
  volumeData.forEach(row => {
    const current = monthlyTotals.get(row.year_month) || 0;
    monthlyTotals.set(row.year_month, current + row.total_weight);
  });

  // Generate month labels
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return `${currentYear}-${month}`;
  }).filter(m => {
    const [year, month] = m.split('-').map(Number);
    const now = new Date();
    const currentYearNum = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;
    
    if (year < currentYearNum) return true;
    if (year === currentYearNum && month <= currentMonthNum) return true;
    return false;
  });

  const handleExcelDownload = () => {
    if (!data) return;

    const exportData: any[] = [];

    // Header row
    const headerRow: any = {
      '팀명': '팀명',
      '담당자명': '담당자명',
      '품목그룹': '품목그룹',
    };
    months.forEach((month, index) => {
      headerRow[`${index + 1}월`] = `${index + 1}월`;
    });
    headerRow['합계'] = '합계';
    exportData.push(headerRow);

    // Data rows
    tableData.forEach((teamMap, team) => {
      teamMap.forEach((employeeMap, employeeName) => {
        employeeMap.forEach((productMap, productGroup) => {
          const row: any = {
            '팀명': team,
            '담당자명': employeeName,
            '품목그룹': productGroup,
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
      '품목그룹': '',
    };
    let grandTotal = 0;
    months.forEach((month, index) => {
      const value = monthlyTotals.get(month) || 0;
      totalsRow[`${index + 1}월`] = value;
      grandTotal += value;
    });
    totalsRow['합계'] = grandTotal;
    exportData.push(totalsRow);

    const filename = generateFilename('팀물량');
    exportToExcel(exportData, filename);
  };

  // Calculate totals for summary cards
  const latestMonth = months[months.length - 1];
  const previousMonth = months[months.length - 2];
  
  const latestVolume = monthlyTotals.get(latestMonth) || 0;
  const previousVolume = monthlyTotals.get(previousMonth) || 0;
  
  const calculateChangeInternal = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
  };

  const monthChange = calculateChangeInternal(latestVolume, previousVolume);
  const annualTotal = Array.from(monthlyTotals.values()).reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Month Volume Card */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">최근 월별 물량</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{getMonthName(latestMonth)} 기준 실적</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 총 중량</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(latestVolume)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                연누계 {formatNumber(annualTotal)} L 중 {((latestVolume / (annualTotal || 1)) * 100).toFixed(1)}%
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
                전월({getMonthName(previousMonth)}): {formatNumber(previousVolume)} L
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
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">연간 누적 물량</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentYear}년 전체 누계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">연간 총 중량</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{formatNumber(annualTotal)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                현재까지 누적 실적
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">월평균 물량</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{formatNumber(Math.round(annualTotal / months.length))} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {months.length}개월 평균
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Volume Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {currentYear}년 팀별 담당자별 물량 (AUTO)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-50 dark:bg-zinc-800/50 z-10">
                  팀명
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-[120px] bg-zinc-50 dark:bg-zinc-800/50 z-10">
                  담당자명
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  품목그룹
                </th>
                {months.map((month, index) => (
                  <th
                    key={month}
                    className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {index + 1}월
                  </th>
                ))}
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider whitespace-nowrap bg-zinc-100 dark:bg-zinc-800">
                  합계
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(tableData.entries()).map(([team, teamMap]) => {
                return Array.from(teamMap.entries()).map(([employeeName, employeeMap], empIndex) => {
                  return Array.from(employeeMap.entries()).map(([productGroup, productMap], prodIndex) => {
                    const rowKey = `${team}-${employeeName}-${productGroup}`;
                    let rowTotal = 0;

                    return (
                      <tr
                        key={rowKey}
                        className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        {prodIndex === 0 && empIndex === 0 ? (
                          <td
                            rowSpan={Array.from(teamMap.values()).reduce((sum, empMap) => sum + empMap.size, 0)}
                            className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-700 sticky left-0 bg-white dark:bg-zinc-900"
                          >
                            {team}
                          </td>
                        ) : prodIndex === 0 ? null : null}
                        {prodIndex === 0 ? (
                          <td
                            rowSpan={employeeMap.size}
                            className="py-3 px-4 text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700 sticky left-[120px] bg-white dark:bg-zinc-900"
                          >
                            {employeeName}
                          </td>
                        ) : null}
                        <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                          {productGroup}
                        </td>
                        {months.map(month => {
                          const value = productMap.get(month) || 0;
                          rowTotal += value;
                          return (
                            <td key={month} className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                              {value > 0 ? formatNumber(value) : '-'}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/50">
                          {formatNumber(rowTotal)}
                        </td>
                      </tr>
                    );
                  });
                });
              })}
              {/* Totals Row */}
              <tr className="bg-zinc-100 dark:bg-zinc-800/70 font-bold">
                <td colSpan={3} className="py-3 px-4 text-zinc-900 dark:text-zinc-100 sticky left-0 bg-zinc-100 dark:bg-zinc-800/70">
                  총합계
                </td>
                {months.map(month => {
                  const value = monthlyTotals.get(month) || 0;
                  return (
                    <td key={month} className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300">
                      {formatNumber(value)}
                    </td>
                  );
                })}
                <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 bg-zinc-200 dark:bg-zinc-700">
                  {formatNumber(Array.from(monthlyTotals.values()).reduce((sum, v) => sum + v, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>제품: (품목그룹1코드)</li>
          <li>팀별: employee_category.b2c_팀 기준</li>
          <li>기간: {currentYear}년 (월별)</li>
          <li>단위: L (용량)</li>
        </ul>
      </div>
    </div>
  );
}
