"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
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
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function ManagerSalesTab({ selectedMonth, onMonthsAvailable }: ManagerSalesTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<ManagerSalesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchManagerSalesData();
  }, [selectedMonth, includeVat]);

  const fetchManagerSalesData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/b2c-meetings?tab=manager-sales${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
      const result = await response.json();
      console.log('Manager sales API response:', result);
      if (result.success) {
        console.log('Setting data:', result.data);
        console.log('Employee data count:', result.data.employeeData?.length);
        console.log('Summary data count:', result.data.summaryData?.length);
        setData(result.data);
        // Report available months to parent
        if (onMonthsAvailable && result.data.availableMonths) {
          onMonthsAvailable(result.data.availableMonths, result.data.currentMonth);
        }
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
  const [_, selectedMonthNum] = targetMonth.split('-');

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

  // Create monthly breakdown data structure
  interface EmployeeMonthData {
    team: string;
    employee_name: string;
    branch: string;
    months: Record<string, {
      fleet_current: number;
      fleet_last: number;
      lcc_current: number;
      lcc_last: number;
      total_current: number;
      total_last: number;
    }>;
    cumulative_fleet_current: number;
    cumulative_fleet_last: number;
    cumulative_lcc_current: number;
    cumulative_lcc_last: number;
    cumulative_total_current: number;
    cumulative_total_last: number;
  }

  const employeeMonthMap: Record<string, EmployeeMonthData> = {};

  employeeData.forEach((row) => {
    const key = row.employee_name;
    if (!employeeMonthMap[key]) {
      employeeMonthMap[key] = {
        team: row.team,
        employee_name: row.employee_name,
        branch: row.branch,
        months: {},
        cumulative_fleet_current: 0,
        cumulative_fleet_last: 0,
        cumulative_lcc_current: 0,
        cumulative_lcc_last: 0,
        cumulative_total_current: 0,
        cumulative_total_last: 0,
      };
    }

    const month = row.year_month.split('-')[1];
    if (!employeeMonthMap[key].months[month]) {
      employeeMonthMap[key].months[month] = {
        fleet_current: 0,
        fleet_last: 0,
        lcc_current: 0,
        lcc_last: 0,
        total_current: 0,
        total_last: 0,
      };
    }

    const isCurrent = row.year === currentYear;
    const isFleet = row.channel === 'Fleet';
    const weight = row.total_weight;

    if (isCurrent) {
      if (isFleet) {
        employeeMonthMap[key].months[month].fleet_current += weight;
        employeeMonthMap[key].cumulative_fleet_current += weight;
      } else {
        employeeMonthMap[key].months[month].lcc_current += weight;
        employeeMonthMap[key].cumulative_lcc_current += weight;
      }
      employeeMonthMap[key].months[month].total_current += weight;
      employeeMonthMap[key].cumulative_total_current += weight;
    } else {
      if (isFleet) {
        employeeMonthMap[key].months[month].fleet_last += weight;
        employeeMonthMap[key].cumulative_fleet_last += weight;
      } else {
        employeeMonthMap[key].months[month].lcc_last += weight;
        employeeMonthMap[key].cumulative_lcc_last += weight;
      }
      employeeMonthMap[key].months[month].total_last += weight;
      employeeMonthMap[key].cumulative_total_last += weight;
    }
  });

  const employeeMonthList = Object.values(employeeMonthMap).sort((a, b) => {
    if (a.team !== b.team) {
      return a.team.localeCompare(b.team);
    }
    return b.cumulative_total_current - a.cumulative_total_current;
  });

  console.log('Final employee list count:', employeeList.length);

  /** 팀별로 묶어 담당자 행 다음에 소계를 넣기 위한 그룹 */
  const teamGroups: { team: string; employees: EmployeeChannelData[] }[] = [];
  for (const emp of employeeList) {
    const last = teamGroups[teamGroups.length - 1];
    if (!last || last.team !== emp.team) {
      teamGroups.push({ team: emp.team, employees: [emp] });
    } else {
      last.employees.push(emp);
    }
  }

  const sumTeamMetrics = (employees: EmployeeChannelData[]) =>
    employees.reduce(
      (acc, e) => ({
        fleet_current: acc.fleet_current + e.fleet_current,
        fleet_last: acc.fleet_last + e.fleet_last,
        lcc_current: acc.lcc_current + e.lcc_current,
        lcc_last: acc.lcc_last + e.lcc_last,
      }),
      { fleet_current: 0, fleet_last: 0, lcc_current: 0, lcc_last: 0 }
    );

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

    teamGroups.forEach(({ team, employees }) => {
      employees.forEach((emp) => {
        const totalChange = calculateChange(emp.total_current, emp.total_last);
        const fleetChange = calculateChange(emp.fleet_current, emp.fleet_last);
        const lccChange = calculateChange(emp.lcc_current, emp.lcc_last);

        exportData.push({
          '팀': emp.team,
          '사업소': emp.branch,
          '직원명': emp.employee_name,
          [`Fleet+LCC 합계 ${currentYear}년(L)`]: emp.total_current,
          [`Fleet+LCC 합계 ${lastYear}년(L)`]: emp.total_last,
          'Fleet+LCC 합계 변화율(%)': totalChange.percent.toFixed(1),
          [`Fleet ${currentYear}년(L)`]: emp.fleet_current,
          [`Fleet ${lastYear}년(L)`]: emp.fleet_last,
          'Fleet 변화율(%)': fleetChange.percent.toFixed(1),
          [`LCC ${currentYear}년(L)`]: emp.lcc_current,
          [`LCC ${lastYear}년(L)`]: emp.lcc_last,
          'LCC 변화율(%)': lccChange.percent.toFixed(1),
        });
      });

      const sub = sumTeamMetrics(employees);
      const subTotalCurrent = sub.fleet_current + sub.lcc_current;
      const subTotalLast = sub.fleet_last + sub.lcc_last;
      const subTotalChange = calculateChange(subTotalCurrent, subTotalLast);
      const subFleetChange = calculateChange(sub.fleet_current, sub.fleet_last);
      const subLccChange = calculateChange(sub.lcc_current, sub.lcc_last);
      exportData.push({
        '팀': team,
        '사업소': '',
        '직원명': '소계',
        [`Fleet+LCC 합계 ${currentYear}년(L)`]: subTotalCurrent,
        [`Fleet+LCC 합계 ${lastYear}년(L)`]: subTotalLast,
        'Fleet+LCC 합계 변화율(%)': subTotalChange.percent.toFixed(1),
        [`Fleet ${currentYear}년(L)`]: sub.fleet_current,
        [`Fleet ${lastYear}년(L)`]: sub.fleet_last,
        'Fleet 변화율(%)': subFleetChange.percent.toFixed(1),
        [`LCC ${currentYear}년(L)`]: sub.lcc_current,
        [`LCC ${lastYear}년(L)`]: sub.lcc_last,
        'LCC 변화율(%)': subLccChange.percent.toFixed(1),
      });
    });

    // Add blank row separator
    exportData.push({});

    // Add Monthly Breakdown section
    exportData.push({
      '구분': '팀별 담당자 월별 Fleet/LCC 매출 (누계 포함)',
    });

    employeeMonthList.forEach((emp) => {
      // Cumulative row
      const totalChange = calculateChange(emp.cumulative_total_current, emp.cumulative_total_last);
      const fleetChange = calculateChange(emp.cumulative_fleet_current, emp.cumulative_fleet_last);
      const lccChange = calculateChange(emp.cumulative_lcc_current, emp.cumulative_lcc_last);

      exportData.push({
        '팀': emp.team,
        '직원명': emp.employee_name,
        '사업소': emp.branch,
        '월': '누계',
        [`Fleet+LCC 합계 ${currentYear}년(L)`]: emp.cumulative_total_current,
        [`Fleet+LCC 합계 ${lastYear}년(L)`]: emp.cumulative_total_last,
        'Fleet+LCC 합계 변화율(%)': totalChange.percent.toFixed(1),
        [`Fleet ${currentYear}년(L)`]: emp.cumulative_fleet_current,
        [`Fleet ${lastYear}년(L)`]: emp.cumulative_fleet_last,
        'Fleet 변화율(%)': fleetChange.percent.toFixed(1),
        [`LCC ${currentYear}년(L)`]: emp.cumulative_lcc_current,
        [`LCC ${lastYear}년(L)`]: emp.cumulative_lcc_last,
        'LCC 변화율(%)': lccChange.percent.toFixed(1),
      });

      // Monthly rows
      const monthNum = parseInt(selectedMonthNum);
      for (let i = 1; i <= monthNum; i++) {
        const month = String(i).padStart(2, '0');
        const monthData = emp.months[month] || {
          fleet_current: 0,
          fleet_last: 0,
          lcc_current: 0,
          lcc_last: 0,
          total_current: 0,
          total_last: 0,
        };

        const monthTotalChange = calculateChange(monthData.total_current, monthData.total_last);
        const monthFleetChange = calculateChange(monthData.fleet_current, monthData.fleet_last);
        const monthLccChange = calculateChange(monthData.lcc_current, monthData.lcc_last);

        exportData.push({
          '팀': '',
          '직원명': '',
          '사업소': '',
          '월': `${parseInt(month)}월`,
          [`Fleet+LCC 합계 ${currentYear}년(L)`]: monthData.total_current,
          [`Fleet+LCC 합계 ${lastYear}년(L)`]: monthData.total_last,
          'Fleet+LCC 합계 변화율(%)': monthTotalChange.percent.toFixed(1),
          [`Fleet ${currentYear}년(L)`]: monthData.fleet_current,
          [`Fleet ${lastYear}년(L)`]: monthData.fleet_last,
          'Fleet 변화율(%)': monthFleetChange.percent.toFixed(1),
          [`LCC ${currentYear}년(L)`]: monthData.lcc_current,
          [`LCC ${lastYear}년(L)`]: monthData.lcc_last,
          'LCC 변화율(%)': monthLccChange.percent.toFixed(1),
        });
      }
    });

    const filename = generateFilename('B2C담당자별Fleet_LCC매출');
    exportToExcel(exportData, filename);
  };

  const fleetCurrent = summaryByCategory('Fleet', currentYear);
  const fleetLast = summaryByCategory('Fleet', lastYear);
  const fleetChange = calculateChange(fleetCurrent.total_weight, fleetLast.total_weight);

  const lccCurrent = summaryByCategory('LCC', currentYear);
  const lccLast = summaryByCategory('LCC', lastYear);
  const lccChange = calculateChange(lccCurrent.total_weight, lccLast.total_weight);

  const totalCurrentWeight = fleetCurrent.total_weight + lccCurrent.total_weight;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fleet Performance Card */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Fleet 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{targetMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 중량</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{formatNumber(fleetCurrent.total_weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {formatNumber(totalCurrentWeight)} L 중 {((fleetCurrent.total_weight / (totalCurrentWeight || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전년 대비</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${fleetChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {fleetChange.isPositive ? '+' : ''}{fleetChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년 동월: {formatNumber(fleetLast.total_weight)} L
              </p>
            </div>
          </div>
        </div>

        {/* LCC Performance Card */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">LCC 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{targetMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 중량</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{formatNumber(lccCurrent.total_weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {formatNumber(totalCurrentWeight)} L 중 {((lccCurrent.total_weight / (totalCurrentWeight || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전년 대비</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${lccChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {lccChange.isPositive ? '+' : ''}{lccChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년 동월: {formatNumber(lccLast.total_weight)} L
              </p>
            </div>
          </div>
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
                <th colSpan={3} className="text-center py-3 px-4 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">
                  Fleet + LCC 합계
                </th>
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
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{currentYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">{lastYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">변화율</th>
              </tr>
            </thead>
            <tbody>
              {employeeList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    직원별 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                teamGroups.map(({ team, employees }) => (
                  <Fragment key={team}>
                    {employees.map((emp) => {
                      const totalChange = calculateChange(emp.total_current, emp.total_last);
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
                          <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold border-l border-zinc-200 dark:border-zinc-700">
                            {formatNumber(emp.total_current)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                            {formatNumber(emp.total_last)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 font-medium text-xs ${
                                totalChange.isPositive ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {totalChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(totalChange.percent).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-purple-700 dark:text-purple-300 font-semibold border-l border-zinc-200 dark:border-zinc-700">
                            {formatNumber(emp.fleet_current)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                            {formatNumber(emp.fleet_last)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 font-medium text-xs ${
                                fleetChange.isPositive ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {fleetChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(fleetChange.percent).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-orange-700 dark:text-orange-300 font-semibold border-l border-zinc-200 dark:border-zinc-700">
                            {formatNumber(emp.lcc_current)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                            {formatNumber(emp.lcc_last)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 font-medium text-xs ${
                                lccChange.isPositive ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {lccChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(lccChange.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(() => {
                      const sub = sumTeamMetrics(employees);
                      const subTotalCurrent = sub.fleet_current + sub.lcc_current;
                      const subTotalLast = sub.fleet_last + sub.lcc_last;
                      const subTotalChange = calculateChange(subTotalCurrent, subTotalLast);
                      const subFleetChange = calculateChange(sub.fleet_current, sub.fleet_last);
                      const subLccChange = calculateChange(sub.lcc_current, sub.lcc_last);
                      return (
                        <tr
                          className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100/90 dark:bg-zinc-800/80 font-semibold"
                        >
                          <td className="py-3 px-4 text-zinc-800 dark:text-zinc-200">{team}</td>
                          <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">소계</td>
                          <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 text-xs">—</td>
                          <td className="py-3 px-4 text-right font-mono text-blue-800 dark:text-blue-200 border-l border-zinc-200 dark:border-zinc-700">
                            {formatNumber(subTotalCurrent)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                            {formatNumber(subTotalLast)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 font-medium text-xs ${
                                subTotalChange.isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {subTotalChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(subTotalChange.percent).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-purple-800 dark:text-purple-200 border-l border-zinc-200 dark:border-zinc-700">
                            {formatNumber(sub.fleet_current)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                            {formatNumber(sub.fleet_last)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 font-medium text-xs ${
                                subFleetChange.isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {subFleetChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(subFleetChange.percent).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-orange-800 dark:text-orange-200 border-l border-zinc-200 dark:border-zinc-700">
                            {formatNumber(sub.lcc_current)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                            {formatNumber(sub.lcc_last)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 font-medium text-xs ${
                                subLccChange.isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {subLccChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(subLccChange.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })()}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">팀별 담당자 월별 Fleet/LCC 매출 (누계: 1월~{parseInt(selectedMonthNum)}월)</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-20">팀</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-24">직원명</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-20">사업소</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-16">월</th>
                <th colSpan={3} className="text-center py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">Fleet + LCC 합계</th>
                <th colSpan={3} className="text-center py-3 px-4 text-xs font-bold text-purple-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">Fleet</th>
                <th colSpan={3} className="text-center py-3 px-4 text-xs font-bold text-orange-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">LCC</th>
              </tr>
              <tr>
                <th className="text-left py-2 px-2"></th>
                <th className="text-left py-2 px-2"></th>
                <th className="text-left py-2 px-2"></th>
                <th className="text-left py-2 px-2"></th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{currentYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">{lastYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">변화율</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{currentYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">{lastYear}년({'>'}L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">변화율</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{currentYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">{lastYear}년(L)</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500">변화율</th>
              </tr>
            </thead>
            <tbody>
              {employeeMonthList.map((emp) => {
                const totalChange = calculateChange(emp.cumulative_total_current, emp.cumulative_total_last);
                const fleetChange = calculateChange(emp.cumulative_fleet_current, emp.cumulative_fleet_last);
                const lccChange = calculateChange(emp.cumulative_lcc_current, emp.cumulative_lcc_last);

                return (
                  <Fragment key={emp.employee_name}>
                    {/* Cumulative Row */}
                    <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 font-semibold">
                      <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-xs">{emp.team}</td>
                      <td className="py-3 px-2 font-medium text-zinc-900 dark:text-zinc-100 text-sm">{emp.employee_name}</td>
                      <td className="py-3 px-2 text-zinc-600 dark:text-zinc-400 text-xs">{emp.branch}</td>
                      <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 text-sm">누계</td>
                      <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 border-l border-zinc-200 dark:border-zinc-700">
                        {formatNumber(emp.cumulative_total_current)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {formatNumber(emp.cumulative_total_last)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                          totalChange.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {totalChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(totalChange.percent).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-purple-700 dark:text-purple-300 border-l border-zinc-200 dark:border-zinc-700">
                        {formatNumber(emp.cumulative_fleet_current)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {formatNumber(emp.cumulative_fleet_last)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                          fleetChange.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {fleetChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(fleetChange.percent).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-orange-700 dark:text-orange-300 border-l border-zinc-200 dark:border-zinc-700">
                        {formatNumber(emp.cumulative_lcc_current)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {formatNumber(emp.cumulative_lcc_last)}
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

                    {/* Monthly Rows */}
                    {Array.from({ length: 12 }, (__, i) => {
                      const month = String(i + 1).padStart(2, '0');
                      const monthNum = parseInt(selectedMonthNum);
                      if (i + 1 > monthNum) return null;

                      const monthData = emp.months[month] || {
                        fleet_current: 0,
                        fleet_last: 0,
                        lcc_current: 0,
                        lcc_last: 0,
                        total_current: 0,
                        total_last: 0,
                      };

                      const monthTotalChange = calculateChange(monthData.total_current, monthData.total_last);
                      const monthFleetChange = calculateChange(monthData.fleet_current, monthData.fleet_last);
                      const monthLccChange = calculateChange(monthData.lcc_current, monthData.lcc_last);

                      return (
                        <tr key={month} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-2 px-2"></td>
                          <td className="py-2 px-2"></td>
                          <td className="py-2 px-2"></td>
                          <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 text-sm">{parseInt(month)}월</td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100 border-l border-zinc-200 dark:border-zinc-700">
                            {formatNumber(monthData.total_current)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                            {formatNumber(monthData.total_last)}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                              monthTotalChange.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {monthTotalChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(monthTotalChange.percent).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100 border-l border-zinc-200 dark:border-zinc-700">
                            {formatNumber(monthData.fleet_current)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                            {formatNumber(monthData.fleet_last)}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                              monthFleetChange.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {monthFleetChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(monthFleetChange.percent).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100 border-l border-zinc-200 dark:border-zinc-700">
                            {formatNumber(monthData.lcc_current)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                            {formatNumber(monthData.lcc_last)}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                              monthLccChange.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {monthLccChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(monthLccChange.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    }).filter(Boolean)}
                  </Fragment>
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
          <li>제품: (품목그룹1코드)</li>
          <li>거래처 채널: Fleet (업종분류코드 28600, 28610, 28710), LCC (기타 AUTO 채널)</li>
          <li>직원: B2C 팀 (김도량 제외)</li>
          <li>기간: {lastYear}년 vs {currentYear}년</li>
        </ul>
      </div>
    </div>
  );
}
