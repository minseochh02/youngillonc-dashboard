"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface EmployeeMonthDataRow {
  team: string;
  employee_name: string;
  branch: string;
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface ComparisonDataRow {
  business_type: string;
  employee_team: string;
  year: string;
  client_count: number;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface TeamEmployeeDataRow {
  team: string;
  employee_name: string;
  branch: string;
  year: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface B2BDataRow {
  year: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
}

interface SalesAmountData {
  employeeMonthData: EmployeeMonthDataRow[];
  comparisonData: ComparisonDataRow[];
  teamEmployeeData: TeamEmployeeDataRow[];
  b2bData: B2BDataRow[];
  currentYear: string;
  lastYear: string;
}

interface SalesAmountTabProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function SalesAmountTab({
  selectedMonth,
  onMonthsAvailable,
}: SalesAmountTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<SalesAmountData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSalesAmountData();
  }, [selectedMonth, includeVat]);

  const fetchSalesAmountData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/b2c-meetings?tab=sales-amount${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        if (onMonthsAvailable && result.data.availableMonths) {
          onMonthsAvailable(result.data.availableMonths, result.data.currentMonth);
        }
      }
    } catch (error) {
      console.error('Failed to fetch sales amount data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (num: number) => {
    return Math.round(num).toLocaleString();
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
  };

  /** 당해 매출 + 전년 매출(작은 글씨) — ManagerSalesTab YoYValuesCell과 동일 패턴 */
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
        {formatAmount(current)}
      </span>
      <span
        className={`font-mono text-zinc-500 dark:text-zinc-400 tabular-nums ${compact ? 'text-[9px]' : 'text-[10px]'}`}
      >
        전년 {formatAmount(last)}
      </span>
    </div>
  );

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

  const { currentYear, lastYear, employeeMonthData, comparisonData, teamEmployeeData, b2bData } = data;

  // Calculate cumulative period label
  const currentMonthStr = selectedMonth || `${currentYear}-12`;
  const [_, currentMonthNum] = currentMonthStr.split('-');
  const displayMonth = parseInt(currentMonthNum);
  const cumulativePeriod = `1월~${displayMonth}월 누계`;
  const lastYearMonthStr = `${lastYear}-${currentMonthNum}`;

  // Get employee monthly data
  const getEmployeeMonthlyData = (employee: string, yearMonth: string) => {
    const found = employeeMonthData.find(row => row.employee_name === employee && row.year_month === yearMonth);
    return found || { total_weight: 0, total_amount: 0, total_quantity: 0 };
  };

  // Calculate cumulative totals by employee
  const getEmployeeCumulativeData = (employee: string, year: string, upToMonth: string) => {
    return employeeMonthData
      .filter(row => row.employee_name === employee && row.year === year && row.year_month <= upToMonth)
      .reduce((acc, row) => ({
        total_weight: acc.total_weight + row.total_weight,
        total_amount: acc.total_amount + row.total_amount,
        total_quantity: acc.total_quantity + row.total_quantity,
      }), { total_weight: 0, total_amount: 0, total_quantity: 0 });
  };

  // Get unique employees with their info (grouped by team)
  interface EmployeeMonthGroup {
    team: string;
    employees: { name: string }[];
  }

  const employeeMonthGroups: EmployeeMonthGroup[] = [];
  const uniqueMonthEmployees = new Set<string>();

  employeeMonthData.forEach(row => {
    const employeeKey = `${row.team}|${row.employee_name}`;
    if (!uniqueMonthEmployees.has(employeeKey)) {
      uniqueMonthEmployees.add(employeeKey);
      let group = employeeMonthGroups.find(g => g.team === row.team);
      if (!group) {
        group = { team: row.team, employees: [] };
        employeeMonthGroups.push(group);
      }
      group.employees.push({ name: row.employee_name });
    }
  });

  // Sort teams and employees by cumulative sales
  employeeMonthGroups.sort((a, b) => a.team.localeCompare(b.team));
  employeeMonthGroups.forEach(group => {
    group.employees.sort((a, b) => {
      const aCumulative = getEmployeeCumulativeData(a.name, currentYear, currentMonthStr);
      const bCumulative = getEmployeeCumulativeData(b.name, currentYear, currentMonthStr);
      return bCumulative.total_amount - aCumulative.total_amount;
    });
  });

  // Get comparison data by business type, employee team, and year
  const getComparisonData = (businessType: string, employeeTeam: string, year: string) => {
    const found = comparisonData.find(row =>
      row.business_type === businessType &&
      row.employee_team === employeeTeam &&
      row.year === year
    );
    return found || { client_count: 0, total_weight: 0, total_amount: 0, total_quantity: 0 };
  };

  // Get employee data by team, employee, and year
  const getEmployeeData = (team: string, employee: string, year: string) => {
    const found = teamEmployeeData.find(row => row.team === team && row.employee_name === employee && row.year === year);
    return found || { total_weight: 0, total_amount: 0, total_quantity: 0, branch: '' };
  };

  // Get B2B data by year
  const getB2BData = (year: string) => {
    const found = b2bData.find(row => row.year === year);
    return found || { total_weight: 0, total_amount: 0, total_quantity: 0 };
  };

  // Group employees by team
  interface EmployeeGroup {
    team: string;
    employees: { name: string }[];
  }

  const teamGroups: EmployeeGroup[] = [];
  const uniqueEmployees = new Set<string>();

  teamEmployeeData.forEach(row => {
    const employeeKey = `${row.team}|${row.employee_name}`;
    if (!uniqueEmployees.has(employeeKey)) {
      uniqueEmployees.add(employeeKey);
      let group = teamGroups.find(g => g.team === row.team);
      if (!group) {
        group = { team: row.team, employees: [] };
        teamGroups.push(group);
      }
      group.employees.push({ name: row.employee_name });
    }
  });

  // Sort teams and employees within each team
  teamGroups.sort((a, b) => a.team.localeCompare(b.team));
  teamGroups.forEach(group => {
    group.employees.sort((a, b) => {
      const aCurrent = getEmployeeData(group.team, a.name, currentYear);
      const bCurrent = getEmployeeData(group.team, b.name, currentYear);
      return bCurrent.total_amount - aCurrent.total_amount;
    });
  });


  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Add B2C vs B2B comparison
    exportData.push({
      '구분': 'B2C vs B2B 매출 비교',
    });

    // B2C (AUTO) - B2C Team
    const b2cB2cCurrent = getComparisonData('B2C', 'B2C', currentYear);
    const b2cB2cLast = getComparisonData('B2C', 'B2C', lastYear);
    const b2cB2cChange = calculateChange(b2cB2cCurrent.total_amount, b2cB2cLast.total_amount);

    exportData.push({
      '구분': 'B2C (AUTO 채널) - B2C팀',
      [`${currentYear}년 매출액(원)`]: formatAmount(b2cB2cCurrent.total_amount),
      [`${lastYear}년 매출액(원)`]: formatAmount(b2cB2cLast.total_amount),
      '변화율(%)': b2cB2cChange.percent.toFixed(1),
      [`${currentYear}년 거래처수`]: b2cB2cCurrent.client_count,
      [`${lastYear}년 거래처수`]: b2cB2cLast.client_count,
      [`${currentYear}년 중량(L)`]: b2cB2cCurrent.total_weight,
      [`${lastYear}년 중량(L)`]: b2cB2cLast.total_weight,
    });

    // B2C (AUTO) - B2B Team
    const b2cB2bCurrent = getComparisonData('B2C', 'B2B', currentYear);
    const b2cB2bLast = getComparisonData('B2C', 'B2B', lastYear);
    const b2cB2bChange = calculateChange(b2cB2bCurrent.total_amount, b2cB2bLast.total_amount);

    exportData.push({
      '구분': 'B2C (AUTO 채널) - B2B팀',
      [`${currentYear}년 매출액(원)`]: formatAmount(b2cB2bCurrent.total_amount),
      [`${lastYear}년 매출액(원)`]: formatAmount(b2cB2bLast.total_amount),
      '변화율(%)': b2cB2bChange.percent.toFixed(1),
      [`${currentYear}년 거래처수`]: b2cB2bCurrent.client_count,
      [`${lastYear}년 거래처수`]: b2cB2bLast.client_count,
      [`${currentYear}년 중량(L)`]: b2cB2bCurrent.total_weight,
      [`${lastYear}년 중량(L)`]: b2cB2bLast.total_weight,
    });

    // B2B (IL/AVI/MAR/MB) - B2C Team
    const b2bB2cCurrent = getComparisonData('B2B', 'B2C', currentYear);
    const b2bB2cLast = getComparisonData('B2B', 'B2C', lastYear);
    const b2bB2cChange = calculateChange(b2bB2cCurrent.total_amount, b2bB2cLast.total_amount);

    exportData.push({
      '구분': 'B2B (IL/AVI/MAR/MB) - B2C팀',
      [`${currentYear}년 매출액(원)`]: formatAmount(b2bB2cCurrent.total_amount),
      [`${lastYear}년 매출액(원)`]: formatAmount(b2bB2cLast.total_amount),
      '변화율(%)': b2bB2cChange.percent.toFixed(1),
      [`${currentYear}년 거래처수`]: b2bB2cCurrent.client_count,
      [`${lastYear}년 거래처수`]: b2bB2cLast.client_count,
      [`${currentYear}년 중량(L)`]: b2bB2cCurrent.total_weight,
      [`${lastYear}년 중량(L)`]: b2bB2cLast.total_weight,
    });

    // B2B (IL/AVI/MAR/MB) - B2B Team
    const b2bB2bCurrent = getComparisonData('B2B', 'B2B', currentYear);
    const b2bB2bLast = getComparisonData('B2B', 'B2B', lastYear);
    const b2bB2bChange = calculateChange(b2bB2bCurrent.total_amount, b2bB2bLast.total_amount);

    exportData.push({
      '구분': 'B2B (IL/AVI/MAR/MB) - B2B팀',
      [`${currentYear}년 매출액(원)`]: formatAmount(b2bB2bCurrent.total_amount),
      [`${lastYear}년 매출액(원)`]: formatAmount(b2bB2bLast.total_amount),
      '변화율(%)': b2bB2bChange.percent.toFixed(1),
      [`${currentYear}년 거래처수`]: b2bB2bCurrent.client_count,
      [`${lastYear}년 거래처수`]: b2bB2bLast.client_count,
      [`${currentYear}년 중량(L)`]: b2bB2bCurrent.total_weight,
      [`${lastYear}년 중량(L)`]: b2bB2bLast.total_weight,
    });

    exportData.push({});

    // Add B2C team and employee breakdown
    exportData.push({
      '팀': 'B2C 팀별 직원별 매출액',
    });

    let b2cTeamTotalCurrent = { total_amount: 0 };
    let b2cTeamTotalLast = { total_amount: 0 };

    teamGroups.forEach(group => {
      let teamTotalCurrent = { total_amount: 0 };
      let teamTotalLast = { total_amount: 0 };

      group.employees.forEach(emp => {
        const currentData = getEmployeeData(group.team, emp.name, currentYear);
        const lastData = getEmployeeData(group.team, emp.name, lastYear);
        const amountChange = calculateChange(currentData.total_amount, lastData.total_amount);

        teamTotalCurrent.total_amount += currentData.total_amount;
        teamTotalLast.total_amount += lastData.total_amount;

        exportData.push({
          '팀': group.team,
          '직원명': emp.name,
          [`${currentYear}년 매출액(원)`]: formatAmount(currentData.total_amount),
          [`${lastYear}년 매출액(원)`]: formatAmount(lastData.total_amount),
          '변화율(%)': amountChange.percent.toFixed(1),
        });
      });

      const teamAmountChange = calculateChange(teamTotalCurrent.total_amount, teamTotalLast.total_amount);
      exportData.push({
        '팀': group.team,
        '직원명': '소계',
        [`${currentYear}년 매출액(원)`]: formatAmount(teamTotalCurrent.total_amount),
        [`${lastYear}년 매출액(원)`]: formatAmount(teamTotalLast.total_amount),
        '변화율(%)': teamAmountChange.percent.toFixed(1),
      });

      b2cTeamTotalCurrent.total_amount += teamTotalCurrent.total_amount;
      b2cTeamTotalLast.total_amount += teamTotalLast.total_amount;
    });

    const b2cTeamAmountChange = calculateChange(b2cTeamTotalCurrent.total_amount, b2cTeamTotalLast.total_amount);
    exportData.push({
      '팀': '',
      '직원명': 'B2C 소계',
      [`${currentYear}년 매출액(원)`]: formatAmount(b2cTeamTotalCurrent.total_amount),
      [`${lastYear}년 매출액(원)`]: formatAmount(b2cTeamTotalLast.total_amount),
      '변화율(%)': b2cTeamAmountChange.percent.toFixed(1),
    });

    const b2bCurrentExport = getB2BData(currentYear);
    const b2bLastExport = getB2BData(lastYear);
    const b2bAmountChangeExport = calculateChange(b2bCurrentExport.total_amount, b2bLastExport.total_amount);
    exportData.push({
      '팀': '',
      '직원명': 'B2B 소계',
      [`${currentYear}년 매출액(원)`]: formatAmount(b2bCurrentExport.total_amount),
      [`${lastYear}년 매출액(원)`]: formatAmount(b2bLastExport.total_amount),
      '변화율(%)': b2bAmountChangeExport.percent.toFixed(1),
    });

    exportData.push({});

    // Add employee monthly breakdown
    exportData.push({
      '팀': '직원별 월별 매출액',
    });

    employeeMonthGroups.forEach(group => {
      group.employees.forEach(emp => {
        // Add cumulative row
        const cumulativeCurrent = getEmployeeCumulativeData(emp.name, currentYear, currentMonthStr);
        const cumulativeLast = getEmployeeCumulativeData(emp.name, lastYear, lastYearMonthStr);
        const cumulativeChange = calculateChange(cumulativeCurrent.total_amount, cumulativeLast.total_amount);

        exportData.push({
          '팀': group.team,
          '직원명': emp.name,
          '월': '누계',
          [`${currentYear}년 매출액(원)`]: formatAmount(cumulativeCurrent.total_amount),
          [`${lastYear}년 매출액(원)`]: formatAmount(cumulativeLast.total_amount),
          '변화율(%)': cumulativeChange.percent.toFixed(1),
        });

        // Add monthly rows
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        months.forEach((month) => {
          const currentYearMonth = `${currentYear}-${month}`;
          const lastYearMonth = `${lastYear}-${month}`;
          const currentData = getEmployeeMonthlyData(emp.name, currentYearMonth);
          const lastData = getEmployeeMonthlyData(emp.name, lastYearMonth);
          const change = calculateChange(currentData.total_amount, lastData.total_amount);

          exportData.push({
            '팀': '',
            '직원명': '',
            '월': `${parseInt(month)}월`,
            [`${currentYear}년 매출액(원)`]: formatAmount(currentData.total_amount),
            [`${lastYear}년 매출액(원)`]: formatAmount(lastData.total_amount),
            '변화율(%)': change.percent.toFixed(1),
          });
        });
      });
    });

    const filename = generateFilename('B2C_AUTO채널별매출액');
    exportToExcel(exportData, filename);
  };

  // B2C (AUTO) - B2C Team
  const b2cB2cTeamCurrent = getComparisonData('B2C', 'B2C', currentYear);
  const b2cB2cTeamLast = getComparisonData('B2C', 'B2C', lastYear);
  const b2cB2cTeamChange = calculateChange(b2cB2cTeamCurrent.total_amount, b2cB2cTeamLast.total_amount);

  // B2C (AUTO) - B2B Team
  const b2cB2bTeamCurrent = getComparisonData('B2C', 'B2B', currentYear);
  const b2cB2bTeamLast = getComparisonData('B2C', 'B2B', lastYear);
  const b2cB2bTeamChange = calculateChange(b2cB2bTeamCurrent.total_amount, b2cB2bTeamLast.total_amount);

  // B2B (IL/AVI/MAR/MB) - B2C Team
  const b2bB2cTeamCurrent = getComparisonData('B2B', 'B2C', currentYear);
  const b2bB2cTeamLast = getComparisonData('B2B', 'B2C', lastYear);
  const b2bB2cTeamChange = calculateChange(b2bB2cTeamCurrent.total_amount, b2bB2cTeamLast.total_amount);

  // B2B (IL/AVI/MAR/MB) - B2B Team
  const b2bB2bTeamCurrent = getComparisonData('B2B', 'B2B', currentYear);
  const b2bB2bTeamLast = getComparisonData('B2B', 'B2B', lastYear);
  const b2bB2bTeamChange = calculateChange(b2bB2bTeamCurrent.total_amount, b2bB2bTeamLast.total_amount);

  const totalCurrentAmount = b2cB2cTeamCurrent.total_amount + b2cB2bTeamCurrent.total_amount + b2bB2cTeamCurrent.total_amount + b2bB2bTeamCurrent.total_amount;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* B2C (AUTO) - B2C Team Card */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">B2C (AUTO) - B2C팀</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{cumulativePeriod}</p>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">매출액</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatAmount(b2cB2cTeamCurrent.total_amount)} 원</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                전체 {((b2cB2cTeamCurrent.total_amount / (totalCurrentAmount || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">거래처수</p>
              <p className="text-base font-semibold text-blue-700 dark:text-blue-300">{b2cB2cTeamCurrent.client_count.toLocaleString()}개</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {lastYear}년: {b2cB2cTeamLast.client_count.toLocaleString()}개
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">전년 대비</p>
              <p className={`text-lg font-bold ${b2cB2cTeamChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {b2cB2cTeamChange.isPositive ? '+' : ''}{b2cB2cTeamChange.percent.toFixed(1)}%
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {lastYear}년: {formatAmount(b2cB2cTeamLast.total_amount)} 원
              </p>
            </div>
          </div>
        </div>

        {/* B2C (AUTO) - B2B Team Card */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">B2C (AUTO) - B2B팀</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{cumulativePeriod}</p>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">매출액</p>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{formatAmount(b2cB2bTeamCurrent.total_amount)} 원</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                전체 {((b2cB2bTeamCurrent.total_amount / (totalCurrentAmount || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">거래처수</p>
              <p className="text-base font-semibold text-indigo-700 dark:text-indigo-300">{b2cB2bTeamCurrent.client_count.toLocaleString()}개</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {lastYear}년: {b2cB2bTeamLast.client_count.toLocaleString()}개
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">전년 대비</p>
              <p className={`text-lg font-bold ${b2cB2bTeamChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {b2cB2bTeamChange.isPositive ? '+' : ''}{b2cB2bTeamChange.percent.toFixed(1)}%
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {lastYear}년: {formatAmount(b2cB2bTeamLast.total_amount)} 원
              </p>
            </div>
          </div>
        </div>

        {/* B2B (IL/AVI/MAR/MB) - B2C Team Card */}
        <div className="bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-950/20 dark:to-pink-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">B2B (IL/AVI/MAR/MB) - B2C팀</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{cumulativePeriod}</p>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">매출액</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatAmount(b2bB2cTeamCurrent.total_amount)} 원</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                전체 {((b2bB2cTeamCurrent.total_amount / (totalCurrentAmount || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">거래처수</p>
              <p className="text-base font-semibold text-orange-700 dark:text-orange-300">{b2bB2cTeamCurrent.client_count.toLocaleString()}개</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {lastYear}년: {b2bB2cTeamLast.client_count.toLocaleString()}개
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">전년 대비</p>
              <p className={`text-lg font-bold ${b2bB2cTeamChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {b2bB2cTeamChange.isPositive ? '+' : ''}{b2bB2cTeamChange.percent.toFixed(1)}%
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {lastYear}년: {formatAmount(b2bB2cTeamLast.total_amount)} 원
              </p>
            </div>
          </div>
        </div>

        {/* B2B (IL/AVI/MAR/MB) - B2B Team Card */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">B2B (IL/AVI/MAR/MB) - B2B팀</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{cumulativePeriod}</p>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">매출액</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatAmount(b2bB2bTeamCurrent.total_amount)} 원</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                전체 {((b2bB2bTeamCurrent.total_amount / (totalCurrentAmount || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">거래처수</p>
              <p className="text-base font-semibold text-amber-700 dark:text-amber-300">{b2bB2bTeamCurrent.client_count.toLocaleString()}개</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {lastYear}년: {b2bB2bTeamLast.client_count.toLocaleString()}개
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">전년 대비</p>
              <p className={`text-lg font-bold ${b2bB2bTeamChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {b2bB2bTeamChange.isPositive ? '+' : ''}{b2bB2bTeamChange.percent.toFixed(1)}%
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {lastYear}년: {formatAmount(b2bB2bTeamLast.total_amount)} 원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* B2C Team & Employee Sales Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">B2C 팀별 직원별 매출액 ({cumulativePeriod})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">팀</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">직원명</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">{currentYear}년 매출액</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">변화율</th>
              </tr>
            </thead>
            <tbody>
              {teamGroups.map((group) => {
                let teamTotalCurrent = { total_amount: 0 };
                let teamTotalLast = { total_amount: 0 };

                return (
                  <Fragment key={group.team}>
                    {group.employees.map((emp) => {
                      const currentData = getEmployeeData(group.team, emp.name, currentYear);
                      const lastData = getEmployeeData(group.team, emp.name, lastYear);
                      const amountChange = calculateChange(currentData.total_amount, lastData.total_amount);

                      teamTotalCurrent.total_amount += currentData.total_amount;
                      teamTotalLast.total_amount += lastData.total_amount;

                      return (
                        <tr
                          key={`${group.team}-${emp.name}`}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                            {group.team}
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                            {emp.name}
                          </td>
                          <td className="py-3 px-3 text-right align-middle">
                            <YoYAmountCell
                              current={currentData.total_amount}
                              last={lastData.total_amount}
                              accentClass="text-blue-700 dark:text-blue-300"
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                              amountChange.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {amountChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(amountChange.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(() => {
                      const teamAmountChange = calculateChange(teamTotalCurrent.total_amount, teamTotalLast.total_amount);
                      return (
                        <tr className="bg-zinc-100 dark:bg-zinc-800/50 border-b-2 border-zinc-300 dark:border-zinc-700">
                          <td className="py-2 px-4 font-semibold text-zinc-800 dark:text-zinc-200">{group.team}</td>
                          <td className="py-2 px-4 font-semibold text-zinc-900 dark:text-zinc-100">소계</td>
                          <td className="py-2 px-3 text-right align-middle">
                            <YoYAmountCell
                              current={teamTotalCurrent.total_amount}
                              last={teamTotalLast.total_amount}
                              accentClass="text-blue-800 dark:text-blue-200"
                            />
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                              teamAmountChange.isPositive ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {teamAmountChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(teamAmountChange.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })()}
                  </Fragment>
                );
              })}
              {/* B2C Subtotal */}
              {(() => {
                let b2cTotalCurrent = { total_amount: 0 };
                let b2cTotalLast = { total_amount: 0 };

                teamGroups.forEach(group => {
                  group.employees.forEach(emp => {
                    const currentData = getEmployeeData(group.team, emp.name, currentYear);
                    const lastData = getEmployeeData(group.team, emp.name, lastYear);
                    b2cTotalCurrent.total_amount += currentData.total_amount;
                    b2cTotalLast.total_amount += lastData.total_amount;
                  });
                });

                const b2cAmountChange = calculateChange(b2cTotalCurrent.total_amount, b2cTotalLast.total_amount);
                return (
                  <tr className="bg-blue-100 dark:bg-blue-950/30 border-t-2 border-blue-300 dark:border-blue-700 font-bold">
                    <td className="py-3 px-4" colSpan={2}>B2C 소계</td>
                    <td className="py-3 px-3 text-right align-middle">
                      <YoYAmountCell
                        current={b2cTotalCurrent.total_amount}
                        last={b2cTotalLast.total_amount}
                        accentClass="text-blue-800 dark:text-blue-200"
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                        b2cAmountChange.isPositive ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {b2cAmountChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(b2cAmountChange.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })()}
              {/* B2B Subtotal */}
              {(() => {
                const b2bCurrent = getB2BData(currentYear);
                const b2bLast = getB2BData(lastYear);
                const b2bAmountChange = calculateChange(b2bCurrent.total_amount, b2bLast.total_amount);
                return (
                  <tr className="bg-amber-100 dark:bg-amber-950/30 border-t-2 border-amber-300 dark:border-amber-700 font-bold">
                    <td className="py-3 px-4" colSpan={2}>B2B 소계</td>
                    <td className="py-3 px-3 text-right align-middle">
                      <YoYAmountCell
                        current={b2bCurrent.total_amount}
                        last={b2bLast.total_amount}
                        accentClass="text-amber-800 dark:text-amber-200"
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                        b2bAmountChange.isPositive ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {b2bAmountChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(b2bAmountChange.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Monthly Sales Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">직원별 월별 매출액 ({cumulativePeriod})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-20">팀</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-24">직원명</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-16">월</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">{currentYear}년 매출액</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">변화율</th>
              </tr>
            </thead>
            <tbody>
              {employeeMonthGroups.map((group) => (
                <Fragment key={group.team}>
                  {group.employees.map((emp) => {
                    // Cumulative row
                    const cumulativeCurrent = getEmployeeCumulativeData(emp.name, currentYear, currentMonthStr);
                    const cumulativeLast = getEmployeeCumulativeData(emp.name, lastYear, lastYearMonthStr);
                    const cumulativeChange = calculateChange(cumulativeCurrent.total_amount, cumulativeLast.total_amount);

                    return (
                      <Fragment key={`${group.team}-${emp.name}`}>
                        {/* Cumulative Row */}
                        <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 font-semibold">
                          <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-xs">
                            {group.team}
                          </td>
                          <td className="py-3 px-2 font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                            {emp.name}
                          </td>
                          <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 text-sm">
                            누계
                          </td>
                          <td className="py-3 px-3 text-right align-middle">
                            <YoYAmountCell
                              current={cumulativeCurrent.total_amount}
                              last={cumulativeLast.total_amount}
                              accentClass="text-blue-700 dark:text-blue-300"
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                              cumulativeChange.isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {cumulativeChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(cumulativeChange.percent).toFixed(1)}%
                            </span>
                          </td>
                        </tr>

                        {/* Monthly Rows */}
                        {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((month) => {
                          // Only show months up to the selected month
                          const selectedMonthNum = parseInt(currentMonthNum);
                          if (parseInt(month) > selectedMonthNum) return null;

                          const currentYearMonth = `${currentYear}-${month}`;
                          const lastYearMonth = `${lastYear}-${month}`;
                          const currentData = getEmployeeMonthlyData(emp.name, currentYearMonth);
                          const lastData = getEmployeeMonthlyData(emp.name, lastYearMonth);
                          const change = calculateChange(currentData.total_amount, lastData.total_amount);

                          return (
                            <tr
                              key={month}
                              className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                            >
                              <td className="py-2 px-2 text-zinc-500 dark:text-zinc-400 text-xs"></td>
                              <td className="py-2 px-2 text-zinc-500 dark:text-zinc-400 text-xs"></td>
                              <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 text-sm">
                                {parseInt(month)}월
                              </td>
                              <td className="py-2 px-3 text-right align-middle">
                                <YoYAmountCell
                                  current={currentData.total_amount}
                                  last={lastData.total_amount}
                                  accentClass="text-zinc-900 dark:text-zinc-100"
                                  compact
                                />
                              </td>
                              <td className="py-2 px-4 text-right">
                                <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                                  change.isPositive ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {change.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {Math.abs(change.percent).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        }).filter(Boolean)}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>제품: (품목그룹1코드)</li>
          <li>거래처: AUTO 채널 (company_type_auto 테이블의 모든 업종분류코드)</li>
          <li>B2C 팀: employee_category.b2c_팀 != 'B2B' (김도량 제외)</li>
          <li>채널 구분:
            <ul className="list-circle list-inside ml-4 mt-1">
              <li>Mobil 1 CCO: 28110</li>
              <li>Mobil Brand Shop: 28120</li>
              <li>IWS: 28230-28330</li>
              <li>Fleet: 28600, 28610, 28710</li>
              <li>Reseller: 28500-28510</li>
            </ul>
          </li>
          <li>기간: {lastYear}년 {cumulativePeriod} vs {currentYear}년 {cumulativePeriod}</li>
        </ul>
      </div>
    </div>
  );
}
