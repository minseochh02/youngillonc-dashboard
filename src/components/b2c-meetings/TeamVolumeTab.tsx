"use client";

import React, { useState, useEffect } from 'react';
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
  year: string;
  year_month: string;
  total_weight: number;
}

interface TeamVolumeData {
  volumeData: VolumeDataRow[];
  currentYear: string;
  lastYear: string;
  currentMonth?: string;
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

  /** 당해 중량(L) + 전년 중량(작은 글씨) — TeamStrategyTab YoYWeightCell과 동일 */
  const YoYWeightCell = ({
    current,
    last,
    accentClass,
    compact = false,
  }: {
    current: number;
    last: number;
    accentClass: string;
    compact?: boolean;
  }) => (
    <div
      className={`flex flex-col items-end justify-center leading-tight ${compact ? 'gap-0' : 'gap-0.5'}`}
    >
      <span
        className={`font-mono font-semibold tabular-nums ${accentClass} ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {formatNumber(current)}
      </span>
      <span
        className={`font-mono text-zinc-500 dark:text-zinc-400 tabular-nums ${compact ? 'text-[9px]' : 'text-[10px]'}`}
      >
        전년 {formatNumber(last)}
      </span>
    </div>
  );

  const rateColThClass =
    'text-right py-2 pl-1 pr-1.5 text-[10px] font-bold text-zinc-500 whitespace-nowrap';
  const rateColTdClassCompact = 'py-1.5 pl-1 pr-1.5 text-right align-middle';

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

  const { currentYear, lastYear, volumeData, currentMonth: apiCurrentMonth } = data;

  const targetMonth = selectedMonth || apiCurrentMonth || `${currentYear}-12`;
  const [__, currentMonthNum] = targetMonth.split('-');
  const selectedMonthNum = parseInt(currentMonthNum, 10);

  const PVL_ACCENT = 'text-blue-700 dark:text-blue-300';
  const CVL_ACCENT = 'text-emerald-700 dark:text-emerald-300';

  type MonthCellMap = Map<string, { current: number; last: number }>;

  const sumCumulativeCurrent = (productMap: MonthCellMap | undefined, monthKeys: string[]) =>
    monthKeys.reduce((sum, m) => sum + (productMap?.get(m)?.current ?? 0), 0);

  const sumCumulativeLast = (productMap: MonthCellMap | undefined, monthKeys: string[]) =>
    monthKeys.reduce((sum, month) => {
      const monthLast = `${lastYear}${month.substring(4)}`;
      return sum + (productMap?.get(monthLast)?.last ?? 0);
    }, 0);

  const monthYoY = (productMap: MonthCellMap | undefined, month: string) => {
    const monthLast = `${lastYear}${month.substring(4)}`;
    const valueCurrent = productMap?.get(month)?.current ?? 0;
    const valueLast = productMap?.get(monthLast)?.last ?? 0;
    return { valueCurrent, valueLast };
  };

  // Create a structure for the table: team -> employee -> product_group -> month -> {current, last}
  const tableData = new Map<string, Map<string, Map<string, Map<string, { current: number; last: number }>>>>();

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

    const month = row.year_month;
    if (!productMap.has(month)) {
      productMap.set(month, { current: 0, last: 0 });
    }

    if (row.year === currentYear) {
      productMap.get(month)!.current = row.total_weight;
    } else if (row.year === lastYear) {
      productMap.get(month)!.last = row.total_weight;
    }
  });

  // Calculate monthly totals for current year only (for summary cards)
  const monthlyTotals = new Map<string, number>();
  volumeData.forEach(row => {
    if (row.year === currentYear) {
      const current = monthlyTotals.get(row.year_month) || 0;
      monthlyTotals.set(row.year_month, current + row.total_weight);
    }
  });

  // Generate month labels - filter by selected month
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return `${currentYear}-${month}`;
  }).filter(m => {
    const [year, month] = m.split('-').map(Number);
    const selectedYear = parseInt(currentYear);
    const selectedMonthBound = selectedMonthNum;

    if (year < selectedYear) return true;
    if (year === selectedYear && month <= selectedMonthBound) return true;
    return false;
  });

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
  };

  const handleExcelDownload = () => {
    if (!data) return;

    const exportData: any[] = [];

    const headerRow: any = {
      팀명: '팀명',
      담당자명: '담당자명',
    };
    months.forEach((_, index) => {
      headerRow[`PVL ${index + 1}월`] = `PVL ${index + 1}월`;
      headerRow[`CVL ${index + 1}월`] = `CVL ${index + 1}월`;
    });
    headerRow['PVL 누계'] = 'PVL 누계';
    headerRow['CVL 누계'] = 'CVL 누계';
    headerRow['합계'] = '합계';
    exportData.push(headerRow);

    tableData.forEach((teamMap, team) => {
      teamMap.forEach((employeeMap, employeeName) => {
        const pvlMap = employeeMap.get('PVL');
        const cvlMap = employeeMap.get('CVL');
        const row: any = {
          팀명: team,
          담당자명: employeeName,
        };
        let rowTotal = 0;
        months.forEach((month, index) => {
          const pvl = pvlMap?.get(month)?.current ?? 0;
          const cvl = cvlMap?.get(month)?.current ?? 0;
          row[`PVL ${index + 1}월`] = pvl;
          row[`CVL ${index + 1}월`] = cvl;
          rowTotal += pvl + cvl;
        });
        row['PVL 누계'] = sumCumulativeCurrent(pvlMap, months);
        row['CVL 누계'] = sumCumulativeCurrent(cvlMap, months);
        row['합계'] = rowTotal;
        exportData.push(row);
      });
    });

    const sumMonthByProduct = (monthYm: string, pg: 'PVL' | 'CVL') =>
      volumeData
        .filter(
          (r) =>
            r.year === currentYear && r.year_month === monthYm && r.product_group === pg
        )
        .reduce((s, r) => s + r.total_weight, 0);

    const totalsRow: any = {
      팀명: '총합계',
      담당자명: '',
    };
    let grandTotal = 0;
    months.forEach((month, index) => {
      const pvlSum = sumMonthByProduct(month, 'PVL');
      const cvlSum = sumMonthByProduct(month, 'CVL');
      totalsRow[`PVL ${index + 1}월`] = pvlSum;
      totalsRow[`CVL ${index + 1}월`] = cvlSum;
      grandTotal += pvlSum + cvlSum;
    });
    totalsRow['PVL 누계'] = months.reduce((s, m) => s + sumMonthByProduct(m, 'PVL'), 0);
    totalsRow['CVL 누계'] = months.reduce((s, m) => s + sumMonthByProduct(m, 'CVL'), 0);
    totalsRow['합계'] = grandTotal;
    exportData.push(totalsRow);

    const filename = generateFilename('팀물량');
    exportToExcel(exportData, filename);
  };

  // Calculate totals for summary cards - use selected month
  const latestMonth = targetMonth;
  const monthNum = selectedMonthNum;
  const previousMonthNum = monthNum > 1 ? monthNum - 1 : 12;
  const previousMonthYear = monthNum > 1 ? currentYear : String(parseInt(currentYear) - 1);
  const previousMonth = `${previousMonthYear}-${String(previousMonthNum).padStart(2, '0')}`;

  const latestVolume = monthlyTotals.get(latestMonth) || 0;
  const previousVolume = monthlyTotals.get(previousMonth) || 0;

  const monthChange = calculateChange(latestVolume, previousVolume);
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
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">최근 월별 물량 (1월~{selectedMonthNum}월)</h3>
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">1월~{selectedMonthNum}월 누계</p>
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
            {currentYear}년 팀별 담당자별 물량 (AUTO) — 1월~{selectedMonthNum}월
            <span className="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
              PVL/CVL 용량 (L) — 당해·전년 동기간 비교 ({currentYear} vs {lastYear})
            </span>
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th
                  rowSpan={2}
                  className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-20 align-middle border-b border-zinc-200 dark:border-zinc-800"
                >
                  팀명
                </th>
                <th
                  rowSpan={2}
                  className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-24 align-middle border-b border-zinc-200 dark:border-zinc-800"
                >
                  담당자명
                </th>
                <th
                  rowSpan={2}
                  className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-16 align-middle border-b border-zinc-200 dark:border-zinc-800"
                >
                  월
                </th>
                <th
                  colSpan={2}
                  className="text-center py-2 px-2 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                >
                  PVL
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">
                    용량 (L)
                  </span>
                </th>
                <th
                  colSpan={2}
                  className="text-center py-2 px-2 text-xs font-bold text-emerald-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                >
                  CVL
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">
                    용량 (L)
                  </span>
                </th>
              </tr>
              <tr>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">
                  비교(L)
                </th>
                <th className={`${rateColThClass} border-b border-zinc-200 dark:border-zinc-800`}>변화율</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">
                  비교(L)
                </th>
                <th className={`${rateColThClass} border-b border-zinc-200 dark:border-zinc-800`}>변화율</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(tableData.entries()).map(([team, teamMap]) =>
                Array.from(teamMap.entries()).map(([employeeName, employeeMap]) => {
                  const pvlMap = employeeMap.get('PVL');
                  const cvlMap = employeeMap.get('CVL');
                  const rowKey = `${team}-${employeeName}`;

                  const cumPvlCur = sumCumulativeCurrent(pvlMap, months);
                  const cumPvlLast = sumCumulativeLast(pvlMap, months);
                  const cumCvlCur = sumCumulativeCurrent(cvlMap, months);
                  const cumCvlLast = sumCumulativeLast(cvlMap, months);
                  const cumChPvl = calculateChange(cumPvlCur, cumPvlLast);
                  const cumChCvl = calculateChange(cumCvlCur, cumCvlLast);

                  return (
                    <React.Fragment key={rowKey}>
                      <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 font-semibold">
                        <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-xs">{team}</td>
                        <td className="py-3 px-2 font-medium text-zinc-900 dark:text-zinc-100 text-sm">{employeeName}</td>
                        <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 text-sm">누계</td>
                        <td className="py-3 px-2 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                          <YoYWeightCell current={cumPvlCur} last={cumPvlLast} accentClass={PVL_ACCENT} compact />
                        </td>
                        <td className={`${rateColTdClassCompact} py-3 px-2`}>
                          <span
                            className={`inline-flex items-center gap-1 font-medium text-xs ${
                              cumChPvl.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {cumChPvl.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(cumChPvl.percent).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                          <YoYWeightCell current={cumCvlCur} last={cumCvlLast} accentClass={CVL_ACCENT} compact />
                        </td>
                        <td className={`${rateColTdClassCompact} py-3 px-2`}>
                          <span
                            className={`inline-flex items-center gap-1 font-medium text-xs ${
                              cumChCvl.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {cumChCvl.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(cumChCvl.percent).toFixed(1)}%
                          </span>
                        </td>
                      </tr>

                      {months.map((month) => {
                        const { valueCurrent: pvlCur, valueLast: pvlLast } = monthYoY(pvlMap, month);
                        const { valueCurrent: cvlCur, valueLast: cvlLast } = monthYoY(cvlMap, month);
                        const chPvl = calculateChange(pvlCur, pvlLast);
                        const chCvl = calculateChange(cvlCur, cvlLast);
                        const mNum = parseInt(month.split('-')[1], 10);

                        return (
                          <tr
                            key={`${rowKey}-${month}`}
                            className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="py-2 px-2" />
                            <td className="py-2 px-2" />
                            <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 text-sm">{mNum}월</td>
                            <td className="py-2 px-2 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                              <YoYWeightCell current={pvlCur} last={pvlLast} accentClass={PVL_ACCENT} compact />
                            </td>
                            <td className={rateColTdClassCompact}>
                              <span
                                className={`inline-flex items-center gap-1 font-medium text-[10px] ${
                                  chPvl.isPositive ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {chPvl.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(chPvl.percent).toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                              <YoYWeightCell current={cvlCur} last={cvlLast} accentClass={CVL_ACCENT} compact />
                            </td>
                            <td className={rateColTdClassCompact}>
                              <span
                                className={`inline-flex items-center gap-1 font-medium text-[10px] ${
                                  chCvl.isPositive ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {chCvl.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(chCvl.percent).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
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
