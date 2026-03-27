"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface SummaryDataRow {
  business_type: string;
  category: string;
  year: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface EmployeeDataRow {
  employee_name: string;
  branch: string;
  team: string;
  channel: string; // 'Fleet' or 'LCC'
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface ManagerSalesData {
  summaryData: SummaryDataRow[];
  employeeData: EmployeeDataRow[];
  currentYear: string;
  lastYear: string;
  currentMonth: string;
}

interface ManagerSalesTabProps {
  selectedMonth?: string;
}

export default function ManagerSalesTab({ selectedMonth }: ManagerSalesTabProps) {
  const [data, setData] = useState<ManagerSalesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchManagerSalesData();
  }, [selectedMonth]);

  const fetchManagerSalesData = async () => {
    setIsLoading(true);
    try {
      const url = `/api/dashboard/b2c-meetings?tab=manager-sales${selectedMonth ? `&month=${selectedMonth}` : ''}`;
      const response = await apiFetch(url);
      const result = await response.json();
      console.log('Manager sales API response:', result);
      if (result.success) {
        console.log('Setting data:', result.data);
        console.log('Employee data count:', result.data.employeeData?.length);
        console.log('Summary data count:', result.data.summaryData?.length);
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch manager sales data:', error);
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

  if (!data.employeeData || data.employeeData.length === 0) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400 p-8">
        <p>담당자 매출 데이터가 없습니다</p>
        <p className="text-sm mt-2">필터 조건을 확인하세요: B2C 팀, AUTO 채널 고객</p>
      </div>
    );
  }

  const { currentYear, lastYear, summaryData, employeeData, currentMonth } = data;
  const targetMonth = selectedMonth || currentMonth;
  const lastYearMonth = targetMonth.replace(currentYear, lastYear);

  // Aggregate summary by category and year
  const summaryByCategory = (category: string, year: string) => {
    // Filter summary by specific month if targetMonth is available
    const monthToFilter = year === currentYear ? targetMonth : lastYearMonth;
    
    // In current API, employeeData definitely has year_month and channel. 
    // Let's use employeeData for accurate filtering.
    const filteredEmployeeData = employeeData.filter(row => 
      row.channel === category && row.year_month === monthToFilter
    );

    if (filteredEmployeeData.length > 0) {
      return filteredEmployeeData.reduce((acc, row) => ({
        total_weight: acc.total_weight + row.total_weight,
        total_amount: acc.total_amount + row.total_amount,
        total_quantity: acc.total_quantity + row.total_quantity,
      }), { total_weight: 0, total_amount: 0, total_quantity: 0 });
    }

    // Fallback to summaryData if year_month filtering not possible there
    const categoryData = summaryData.find(row => row.category === category && row.year === year);
    return categoryData || { total_weight: 0, total_amount: 0, total_quantity: 0 };
  };

  // Group employee data by team and employee, with Fleet/LCC breakdown
  interface EmployeeChannelData {
    team: string;
    employee_name: string;
    branch: string;
    fleet_current: number;
    fleet_last: number;
    lcc_current: number;
    lcc_last: number;
    total_current: number;
    total_last: number;
  }

  const employeeChannelMap: Record<string, EmployeeChannelData> = {};

  console.log('Target Month:', targetMonth, 'Last Year Month:', lastYearMonth);

  employeeData.forEach((row) => {
    // ONLY include data for the selected month or its last year counterpart
    if (row.year_month !== targetMonth && row.year_month !== lastYearMonth) return;

    const key = row.employee_name;
    if (!employeeChannelMap[key]) {
      employeeChannelMap[key] = {
        team: row.team,
        employee_name: row.employee_name,
        branch: row.branch,
        fleet_current: 0,
        fleet_last: 0,
        lcc_current: 0,
        lcc_last: 0,
        total_current: 0,
        total_last: 0,
      };
    }

    if (row.channel === 'Fleet') {
      if (row.year_month === targetMonth) {
        employeeChannelMap[key].fleet_current += row.total_weight;
      } else if (row.year_month === lastYearMonth) {
        employeeChannelMap[key].fleet_last += row.total_weight;
      }
    } else if (row.channel === 'LCC') {
      if (row.year_month === targetMonth) {
        employeeChannelMap[key].lcc_current += row.total_weight;
      } else if (row.year_month === lastYearMonth) {
        employeeChannelMap[key].lcc_last += row.total_weight;
      }
    }
  });

  // Calculate totals
  Object.values(employeeChannelMap).forEach(emp => {
    emp.total_current = emp.fleet_current + emp.lcc_current;
    emp.total_last = emp.fleet_last + emp.lcc_last;
  });

  console.log('Employee channel map size:', Object.keys(employeeChannelMap).length);
  console.log('Sample employees:', Object.values(employeeChannelMap).slice(0, 3));

  // Sort by team, then by total weight
  const employeeList = Object.values(employeeChannelMap).sort((a, b) => {
    if (a.team !== b.team) {
      return a.team.localeCompare(b.team);
    }
    return b.total_current - a.total_current;
  });

  console.log('Final employee list count:', employeeList.length);

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Add Summary section
    exportData.push({
      '구분': 'Fleet / LCC 중량 써머리',
    });

    // Fleet Total
    const fleetCurrent = summaryByCategory('Fleet', currentYear);
    const fleetLast = summaryByCategory('Fleet', lastYear);
    const fleetChange = calculateChange(fleetCurrent.total_weight, fleetLast.total_weight);

    exportData.push({
      '구분': 'Fleet 합계',
      [`${currentYear}년 중량(L)`]: fleetCurrent.total_weight,
      [`${lastYear}년 중량(L)`]: fleetLast.total_weight,
      '변화율(%)': fleetChange.percent.toFixed(1),
    });

    // LCC Total
    const lccCurrent = summaryByCategory('LCC', currentYear);
    const lccLast = summaryByCategory('LCC', lastYear);
    const lccChange = calculateChange(lccCurrent.total_weight, lccLast.total_weight);

    exportData.push({
      '구분': 'LCC 합계',
      [`${currentYear}년 중량(L)`]: lccCurrent.total_weight,
      [`${lastYear}년 중량(L)`]: lccLast.total_weight,
      '변화율(%)': lccChange.percent.toFixed(1),
    });

    // Add blank row separator
    exportData.push({});

    // Add Employee Details section
    exportData.push({
      '구분': '팀별 담당자 Fleet/LCC 매출',
    });

    employeeList.forEach((emp) => {
      const fleetChange = calculateChange(emp.fleet_current, emp.fleet_last);
      const lccChange = calculateChange(emp.lcc_current, emp.lcc_last);

      exportData.push({
        '팀': emp.team,
        '사업소': emp.branch,
        '직원명': emp.employee_name,
        [`Fleet ${currentYear}년(L)`]: emp.fleet_current,
        [`Fleet ${lastYear}년(L)`]: emp.fleet_last,
        'Fleet 변화율(%)': fleetChange.percent.toFixed(1),
        [`LCC ${currentYear}년(L)`]: emp.lcc_current,
        [`LCC ${lastYear}년(L)`]: emp.lcc_last,
        'LCC 변화율(%)': lccChange.percent.toFixed(1),
      });
    });

    const filename = generateFilename('B2C담당자별Fleet_LCC매출');
    exportToExcel(exportData, filename);
  };

  return (
    <div className="space-y-6">
      {/* Summary Table - Fleet and LCC */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Fleet / LCC 중량 써머리</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">구분</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">{currentYear}년 중량(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{lastYear}년 중량(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">변화율</th>
              </tr>
            </thead>
            <tbody>
              {/* Fleet Total */}
              {(() => {
                const currentData = summaryByCategory('Fleet', currentYear);
                const lastData = summaryByCategory('Fleet', lastYear);
                const change = calculateChange(currentData.total_weight, lastData.total_weight);

                return (
                  <tr className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors bg-purple-50/30 dark:bg-purple-950/20">
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                      Fleet 합계
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-bold">
                      {formatNumber(currentData.total_weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
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
              })()}

              {/* LCC Total */}
              {(() => {
                const currentData = summaryByCategory('LCC', currentYear);
                const lastData = summaryByCategory('LCC', lastYear);
                const change = calculateChange(currentData.total_weight, lastData.total_weight);

                return (
                  <tr className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors bg-orange-50/30 dark:bg-orange-950/20">
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                      LCC 합계
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-bold">
                      {formatNumber(currentData.total_weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
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
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Details Table - Grouped by Team */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">팀별 담당자 Fleet/LCC 매출</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">팀</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">직원명</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">사업소</th>
                <th colSpan={3} className="text-center py-3 px-4 text-xs font-bold text-purple-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">Fleet</th>
                <th colSpan={3} className="text-center py-3 px-4 text-xs font-bold text-orange-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">LCC</th>
              </tr>
              <tr>
                <th className="text-left py-2 px-4"></th>
                <th className="text-left py-2 px-4"></th>
                <th className="text-left py-2 px-4"></th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{currentYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">{lastYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">변화율</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{currentYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">{lastYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">변화율</th>
              </tr>
            </thead>
            <tbody>
              {employeeList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    직원별 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                employeeList.map((emp) => {
                  const fleetChange = calculateChange(emp.fleet_current, emp.fleet_last);
                  const lccChange = calculateChange(emp.lcc_current, emp.lcc_last);

                  return (
                    <tr
                      key={emp.employee_name}
                      className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                      {emp.team}
                    </td>
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {emp.employee_name}
                    </td>
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 text-xs">
                      {emp.branch}
                    </td>
                    {/* Fleet Columns */}
                    <td className="py-3 px-4 text-right font-mono text-purple-700 dark:text-purple-300 font-semibold border-l border-zinc-200 dark:border-zinc-700">
                      {formatNumber(emp.fleet_current)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      {formatNumber(emp.fleet_last)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                        fleetChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {fleetChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(fleetChange.percent).toFixed(1)}%
                      </span>
                    </td>
                    {/* LCC Columns */}
                    <td className="py-3 px-4 text-right font-mono text-orange-700 dark:text-orange-300 font-semibold border-l border-zinc-200 dark:border-zinc-700">
                      {formatNumber(emp.lcc_current)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      {formatNumber(emp.lcc_last)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                        lccChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {lccChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(lccChange.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
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
          <li>거래처 채널: Fleet (업종분류코드 28600, 28610, 28710), LCC (기타 AUTO 채널)</li>
          <li>직원: B2C 팀 (김도량 제외)</li>
          <li>기간: {lastYear}년 vs {currentYear}년</li>
        </ul>
      </div>
    </div>
  );
}
