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

interface ClientCountCumulativeRow {
  team: string;
  employee_name: string;
  product_group: string;
  year: string;
  client_count: number;
}

interface ClientCountMonthlyRow {
  team: string;
  employee_name: string;
  product_group: string;
  year: string;
  year_month: string;
  client_count: number;
}

interface TeamSalesData {
  salesData: SalesDataRow[];
  totalClientCountByYear?: Record<string, number>;
  clientCountCumulative?: ClientCountCumulativeRow[];
  clientCountMonthly?: ClientCountMonthlyRow[];
  currentYear: string;
  lastYear: string;
  currentMonth?: string;
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

  const {
    currentYear,
    lastYear,
    salesData,
    totalClientCountByYear = {},
    clientCountCumulative = [],
    clientCountMonthly = [],
    currentMonth: apiCurrentMonth,
  } = data;

  const targetMonth = selectedMonth || apiCurrentMonth || `${currentYear}-12`;
  const [__, currentMonthNum] = targetMonth.split('-');
  const selectedMonthNum = parseInt(currentMonthNum, 10);

  const PVL_ACCENT = 'text-blue-700 dark:text-blue-300';
  const CVL_ACCENT = 'text-emerald-700 dark:text-emerald-300';
  const OTHERS_ACCENT = 'text-amber-800 dark:text-amber-200';

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
    return {
      valueCurrent: productMap?.get(month)?.current ?? 0,
      valueLast: productMap?.get(monthLast)?.last ?? 0,
    };
  };

  const rateColThClass =
    'text-right py-2 pl-1 pr-1.5 text-[10px] font-bold text-zinc-500 whitespace-nowrap';
  const rateColTdClassCompact = 'py-1.5 pl-1 pr-1.5 text-right align-middle';

  /** 당해 금액 + 전년(원) — TeamVolumeTab YoY와 동일 패턴 */
  const YoYAmountCell = ({
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
        전년 {formatNumber(last)} 원
      </span>
    </div>
  );

  const YoYClientCell = ({
    current,
    last,
    compact = false,
  }: {
    current: number;
    last: number;
    compact?: boolean;
  }) => (
    <div
      className={`flex flex-col items-end justify-center leading-tight ${compact ? 'gap-0' : 'gap-0.5'}`}
    >
      <span
        className={`font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {current.toLocaleString()}
      </span>
      <span
        className={`font-mono text-zinc-500 dark:text-zinc-400 tabular-nums ${compact ? 'text-[9px]' : 'text-[10px]'}`}
      >
        전년 {last.toLocaleString()}개
      </span>
    </div>
  );

  const totalClientsCurrent = totalClientCountByYear[currentYear] ?? 0;
  const totalClientsLast = totalClientCountByYear[lastYear] ?? 0;
  const totalClientsChange = (() => {
    if (totalClientsLast === 0) return { percent: 0, isPositive: totalClientsCurrent > 0 };
    const change = ((totalClientsCurrent - totalClientsLast) / totalClientsLast) * 100;
    return { percent: change, isPositive: change >= 0 };
  })();

  // Create a structure for the table: team -> employee -> product_group -> month -> {current, last}
  const tableData = new Map<string, Map<string, Map<string, Map<string, { current: number; last: number }>>>>();
  const clientTableData = new Map<string, Map<string, Map<string, Map<string, { current: number; last: number }>>>>();

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

  clientCountMonthly.forEach(row => {
    if (!clientTableData.has(row.team)) {
      clientTableData.set(row.team, new Map());
    }
    const teamMap = clientTableData.get(row.team)!;

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
      productMap.get(month)!.current = row.client_count;
    } else if (row.year === lastYear) {
      productMap.get(month)!.last = row.client_count;
    }
  });

  const clientCumulativeLookup = new Map<string, number>();
  clientCountCumulative.forEach((row) => {
    const key = `${row.team}|${row.employee_name}|${row.product_group}|${row.year}`;
    clientCumulativeLookup.set(key, row.client_count);
  });

  const getCumulativeClient = (team: string, employee: string, productGroup: string, year: string) =>
    clientCumulativeLookup.get(`${team}|${employee}|${productGroup}|${year}`) ?? 0;

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
    const pgKeys = ['PVL', 'CVL', 'OTHERS'] as const;

    const headerRow: any = {
      팀명: '팀명',
      담당자명: '담당자명',
    };
    months.forEach((_, index) => {
      const m = index + 1;
      pgKeys.forEach((pg) => {
        headerRow[`${pg} ${m}월 매출`] = `${pg} ${m}월 매출`;
        headerRow[`${pg} ${m}월 거래처`] = `${pg} ${m}월 거래처`;
      });
    });
    pgKeys.forEach((pg) => {
      headerRow[`${pg} 매출 누계`] = `${pg} 매출 누계`;
      headerRow[`${pg} 거래처 누계`] = `${pg} 거래처 누계`;
    });
    headerRow['합계 매출'] = '합계 매출';
    exportData.push(headerRow);

    tableData.forEach((teamMap, team) => {
      teamMap.forEach((employeeMap, employeeName) => {
        const row: any = {
          팀명: team,
          담당자명: employeeName,
        };
        let rowSalesTotal = 0;
        months.forEach((month, index) => {
          const m = index + 1;
          pgKeys.forEach((pg) => {
            const productMap = employeeMap.get(pg);
            const clientMap = clientTableData.get(team)?.get(employeeName)?.get(pg);
            const amountVal = productMap?.get(month)?.current ?? 0;
            const clientVal = clientMap?.get(month)?.current ?? 0;
            row[`${pg} ${m}월 매출`] = amountVal;
            row[`${pg} ${m}월 거래처`] = clientVal;
            rowSalesTotal += amountVal;
          });
        });
        pgKeys.forEach((pg) => {
          row[`${pg} 매출 누계`] = sumCumulativeCurrent(employeeMap.get(pg), months);
          row[`${pg} 거래처 누계`] = getCumulativeClient(team, employeeName, pg, currentYear);
        });
        row['합계 매출'] = rowSalesTotal;
        exportData.push(row);
      });
    });

    const sumMonthSalesByPg = (monthYm: string, pg: string) =>
      salesData
        .filter(
          (r) =>
            r.year === currentYear && r.year_month === monthYm && r.product_group === pg
        )
        .reduce((s, r) => s + r.total_amount, 0);

    const totalsRow: any = {
      팀명: '총합계',
      담당자명: '',
    };
    let grandTotal = 0;
    months.forEach((month, index) => {
      const m = index + 1;
      pgKeys.forEach((pg) => {
        const sv = sumMonthSalesByPg(month, pg);
        totalsRow[`${pg} ${m}월 매출`] = sv;
        grandTotal += sv;
      });
      pgKeys.forEach((pg) => {
        totalsRow[`${pg} ${m}월 거래처`] = '';
      });
    });
    pgKeys.forEach((pg) => {
      totalsRow[`${pg} 매출 누계`] = months.reduce((s, m) => s + sumMonthSalesByPg(m, pg), 0);
      totalsRow[`${pg} 거래처 누계`] = '';
    });
    totalsRow['합계 매출'] = grandTotal;
    exportData.push(totalsRow);

    const filename = generateFilename('팀매출액');
    exportToExcel(exportData, filename, { referenceDate: selectedMonth });
  };

  // Calculate totals for summary cards - use selected month
  const latestMonth = targetMonth;
  const monthNum = selectedMonthNum;
  const previousMonthNum = monthNum > 1 ? monthNum - 1 : 12;
  const previousMonthYear = monthNum > 1 ? currentYear : String(parseInt(currentYear) - 1);
  const previousMonth = `${previousMonthYear}-${String(previousMonthNum).padStart(2, '0')}`;

  const latestSales = monthlyTotals.get(latestMonth) || 0;
  const previousSales = monthlyTotals.get(previousMonth) || 0;

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
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">최근 월별 매출 (1월~{selectedMonthNum}월)</h3>
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
          <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800/60">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              전체 거래처수 (1~{selectedMonthNum}월 누계 · distinct)
            </p>
            <div className="flex flex-wrap items-baseline gap-6 mt-2">
              <div>
                <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                  {totalClientsCurrent.toLocaleString()}개
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{currentYear}년</p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {lastYear}년: {totalClientsLast.toLocaleString()}개
                </p>
              </div>
              <div>
                <p
                  className={`text-sm font-medium ${
                    totalClientsChange.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {totalClientsChange.isPositive ? '+' : ''}
                  {totalClientsChange.percent.toFixed(1)}%
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">전년 대비</p>
              </div>
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">1월~{selectedMonthNum}월 누계</p>
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
            {currentYear}년 팀별 담당자별 매출액·거래처수 (공급가) — 1월~{selectedMonthNum}월
            <span className="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
              PVL / CVL / OTHERS — 당해·전년 동기간 비교 ({currentYear} vs {lastYear})
            </span>
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th
                  rowSpan={2}
                  className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-[4.5rem] align-middle border-b border-zinc-200 dark:border-zinc-800"
                >
                  팀명
                </th>
                <th
                  rowSpan={2}
                  className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-24 align-middle border-b border-zinc-200 dark:border-zinc-800"
                >
                  담당자명
                </th>
                <th
                  rowSpan={2}
                  className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-12 align-middle border-b border-zinc-200 dark:border-zinc-800"
                >
                  월
                </th>
                <th
                  colSpan={4}
                  className="text-center py-2 px-1 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                >
                  PVL
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">
                    매출(원) · 거래처(개)
                  </span>
                </th>
                <th
                  colSpan={4}
                  className="text-center py-2 px-1 text-xs font-bold text-emerald-600 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                >
                  CVL
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">
                    매출(원) · 거래처(개)
                  </span>
                </th>
                <th
                  colSpan={4}
                  className="text-center py-2 px-1 text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                >
                  OTHERS
                  <span className="block font-normal text-[10px] text-zinc-500 normal-case tracking-normal">
                    매출(원) · 거래처(개)
                  </span>
                </th>
              </tr>
              <tr>
                {(['PVL', 'CVL', 'OTHERS'] as const).map((pg) => (
                  <React.Fragment key={pg}>
                    <th className="text-right py-2 px-1 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">
                      매출 비교
                    </th>
                    <th className={`${rateColThClass} border-b border-zinc-200 dark:border-zinc-800`}>매출%</th>
                    <th className="text-right py-2 px-1 text-[10px] font-bold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 border-b border-zinc-200 dark:border-zinc-800">
                      거래처 비교
                    </th>
                    <th className={`${rateColThClass} border-b border-zinc-200 dark:border-zinc-800`}>거래처%</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(tableData.entries()).map(([team, teamMap]) =>
                Array.from(teamMap.entries()).map(([employeeName, employeeMap]) => {
                  const clientEmp = clientTableData.get(team)?.get(employeeName);
                  const groups = [
                    { key: 'PVL' as const, sales: employeeMap.get('PVL'), clients: clientEmp?.get('PVL'), accent: PVL_ACCENT },
                    { key: 'CVL' as const, sales: employeeMap.get('CVL'), clients: clientEmp?.get('CVL'), accent: CVL_ACCENT },
                    { key: 'OTHERS' as const, sales: employeeMap.get('OTHERS'), clients: clientEmp?.get('OTHERS'), accent: OTHERS_ACCENT },
                  ];
                  const rowKey = `${team}-${employeeName}`;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 font-semibold">
                        <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-xs">{team}</td>
                        <td className="py-3 px-2 font-medium text-zinc-900 dark:text-zinc-100 text-sm">{employeeName}</td>
                        <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 text-sm">누계</td>
                        {groups.map(({ key, sales, clients, accent }) => {
                          const cumCur = sumCumulativeCurrent(sales, months);
                          const cumLast = sumCumulativeLast(sales, months);
                          const chS = calculateChange(cumCur, cumLast);
                          const cumCc = getCumulativeClient(team, employeeName, key, currentYear);
                          const cumCl = getCumulativeClient(team, employeeName, key, lastYear);
                          const chC = calculateChange(cumCc, cumCl);
                          return (
                            <React.Fragment key={key}>
                              <td className="py-3 px-1 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                                <YoYAmountCell current={cumCur} last={cumLast} accentClass={accent} compact />
                              </td>
                              <td className={`${rateColTdClassCompact} py-3 px-1`}>
                                <span
                                  className={`inline-flex items-center gap-0.5 font-medium text-[11px] ${
                                    chS.isPositive ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  {chS.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {Math.abs(chS.percent).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-1 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                                <YoYClientCell current={cumCc} last={cumCl} compact />
                              </td>
                              <td className={`${rateColTdClassCompact} py-3 px-1`}>
                                <span
                                  className={`inline-flex items-center gap-0.5 font-medium text-[11px] ${
                                    chC.isPositive ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  {chC.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {Math.abs(chC.percent).toFixed(1)}%
                                </span>
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>

                      {months.map((month) => {
                        const mNum = parseInt(month.split('-')[1], 10);
                        return (
                          <tr
                            key={`${rowKey}-${month}`}
                            className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="py-2 px-2" />
                            <td className="py-2 px-2" />
                            <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 text-sm">{mNum}월</td>
                            {groups.map(({ key, sales, clients, accent }) => {
                              const { valueCurrent: sCur, valueLast: sLast } = monthYoY(sales, month);
                              const { valueCurrent: cCur, valueLast: cLast } = monthYoY(clients, month);
                              const chS = calculateChange(sCur, sLast);
                              const chC = calculateChange(cCur, cLast);
                              return (
                                <React.Fragment key={`${key}-${month}`}>
                                  <td className="py-2 px-1 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                                    <YoYAmountCell current={sCur} last={sLast} accentClass={accent} compact />
                                  </td>
                                  <td className={rateColTdClassCompact}>
                                    <span
                                      className={`inline-flex items-center gap-0.5 font-medium text-[10px] ${
                                        chS.isPositive ? 'text-green-600' : 'text-red-600'
                                      }`}
                                    >
                                      {Math.abs(chS.percent).toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="py-2 px-1 text-right border-l border-zinc-100 dark:border-zinc-800/50 align-middle">
                                    <YoYClientCell current={cCur} last={cLast} compact />
                                  </td>
                                  <td className={rateColTdClassCompact}>
                                    <span
                                      className={`inline-flex items-center gap-0.5 font-medium text-[10px] ${
                                        chC.isPositive ? 'text-green-600' : 'text-red-600'
                                      }`}
                                    >
                                      {Math.abs(chC.percent).toFixed(1)}%
                                    </span>
                                  </td>
                                </React.Fragment>
                              );
                            })}
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
          <li>제품 그룹: AUTO, OTHERS (품목그룹1코드)</li>
          <li>팀별: employee_category.b2c_팀 기준</li>
          <li>기간: {currentYear}년 (월별)</li>
          <li>단위: 원 (매출액 - 공급가)</li>
          <li>거래처수: 해당 기간·필터 내 DISTINCT 거래처코드 (누계 행은 1~선택월 누계, 월 행은 해당 월만)</li>
        </ul>
      </div>
    </div>
  );
}
