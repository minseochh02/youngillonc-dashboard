"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
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

interface GoalDataRow {
  employee_name: string;
  year: string;
  year_month: string;
  fleet_goal: number;
  lcc_goal: number;
  total_goal: number;
}

interface ManagerSalesData {
  summaryData: SummaryDataRow[];
  employeeData: EmployeeDataRow[];
  goalData?: GoalDataRow[];
  currentYear: string;
  lastYear: string;
  currentMonth: string;
}

interface ManagerSalesTabProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

type ViewMode = 'yoy' | 'goal';

export default function ManagerSalesTab({ selectedMonth, onMonthsAvailable }: ManagerSalesTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<ManagerSalesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('yoy');
  /** null = 전체 사업소 */
  const [branchFilter, setBranchFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchManagerSalesData();
  }, [selectedMonth, includeVat]);

  useEffect(() => {
    setBranchFilter(null);
  }, [selectedMonth]);

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

  const calculateAchievementRate = (current: number, goal: number) => {
    if (goal === 0) return { percent: 0, isPositive: false };
    const rate = (current / goal) * 100;
    return { percent: rate, isPositive: rate >= 100 };
  };

  /** 당해 금액 + 전년 금액(작은 글씨) 세로 배치 */
  const YoYValuesCell = ({
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

  /** 당해 금액 + 목표 금액(작은 글씨) 세로 배치 */
  const GoalValuesCell = ({
    current,
    goal,
    accentClass,
    compact = false,
  }: {
    current: number;
    goal: number;
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
        목표 {formatNumber(goal)}
      </span>
    </div>
  );

  /** 증감율·달성율 열 — 좁은 패딩·작은 글씨 */
  const MetricRateSpan = ({
    percent,
    isPositive,
    compact = false,
    tone = 'default',
  }: {
    percent: number;
    isPositive: boolean;
    compact?: boolean;
    tone?: 'default' | 'subtotal';
  }) => {
    const posClass =
      tone === 'subtotal' ? 'text-green-700 dark:text-green-400' : 'text-green-600';
    const negClass =
      tone === 'subtotal' ? 'text-red-700 dark:text-red-400' : 'text-red-600';
    const iconClass = compact ? 'h-2 w-2 shrink-0' : 'h-2.5 w-2.5 shrink-0';
    return (
      <span
        className={`inline-flex items-center justify-end gap-0.5 font-medium tabular-nums leading-none ${
          isPositive ? posClass : negClass
        } ${compact ? 'text-[10px]' : 'text-[11px]'}`}
      >
        {isPositive ? (
          <TrendingUp className={iconClass} />
        ) : (
          <TrendingDown className={iconClass} />
        )}
        {percent.toFixed(1)}%
      </span>
    );
  };

  const rateColThClass =
    'text-right py-2 pl-1 pr-1.5 text-[10px] font-bold text-zinc-500 whitespace-nowrap';
  const rateColTdClass = 'py-2 pl-1 pr-1.5 text-right align-middle';
  const rateColTdClassCompact = 'py-1.5 pl-1 pr-1.5 text-right align-middle';

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

  const normalizeBranch = (b: string | undefined) => {
    const t = b?.trim();
    return t && t.length > 0 ? t : '미지정';
  };

  const branchesSorted = Array.from(
    new Set(employeeList.map((e) => normalizeBranch(e.branch)))
  ).sort((a, b) => a.localeCompare(b, 'ko'));

  const filteredEmployeeList =
    branchFilter === null
      ? employeeList
      : employeeList.filter((e) => normalizeBranch(e.branch) === branchFilter);

  // Build goal data map for each employee
  interface EmployeeGoalData {
    fleet_goal: number;
    lcc_goal: number;
    total_goal: number;
  }

  const employeeGoalMap: Record<string, EmployeeGoalData> = {};

  // Process goal data if available
  if (data.goalData) {
    data.goalData.forEach((row) => {
      if (row.year_month !== targetMonth) return;

      const key = row.employee_name;
      if (!employeeGoalMap[key]) {
        employeeGoalMap[key] = {
          fleet_goal: 0,
          lcc_goal: 0,
          total_goal: 0,
        };
      }

      employeeGoalMap[key].fleet_goal = row.fleet_goal || 0;
      employeeGoalMap[key].lcc_goal = row.lcc_goal || 0;
      employeeGoalMap[key].total_goal = row.total_goal || 0;
    });
  }

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
      fleet_goal: number;
      lcc_goal: number;
      total_goal: number;
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
        fleet_goal: 0,
        lcc_goal: 0,
        total_goal: 0,
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

  // Process monthly goal data if available
  if (data.goalData) {
    data.goalData.forEach((row) => {
      const key = row.employee_name;
      if (!employeeMonthMap[key]) return;

      const month = row.year_month.split('-')[1];
      if (!employeeMonthMap[key].months[month]) {
        employeeMonthMap[key].months[month] = {
          fleet_current: 0,
          fleet_last: 0,
          lcc_current: 0,
          lcc_last: 0,
          total_current: 0,
          total_last: 0,
          fleet_goal: 0,
          lcc_goal: 0,
          total_goal: 0,
        };
      }

      employeeMonthMap[key].months[month].fleet_goal = row.fleet_goal || 0;
      employeeMonthMap[key].months[month].lcc_goal = row.lcc_goal || 0;
      employeeMonthMap[key].months[month].total_goal = row.total_goal || 0;
    });
  }

  const employeeMonthList = Object.values(employeeMonthMap).sort((a, b) => {
    if (a.team !== b.team) {
      return a.team.localeCompare(b.team);
    }
    return b.cumulative_total_current - a.cumulative_total_current;
  });

  const filteredEmployeeMonthList =
    branchFilter === null
      ? employeeMonthList
      : employeeMonthList.filter((e) => normalizeBranch(e.branch) === branchFilter);

  console.log('Final employee list count:', employeeList.length);

  /** 팀별로 묶어 담당자 행 다음에 소계를 넣기 위한 그룹 */
  const teamGroups: { team: string; employees: EmployeeChannelData[] }[] = [];
  for (const emp of filteredEmployeeList) {
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

  const fleetCurrent = summaryByCategory('Fleet', currentYear);
  const fleetLast = summaryByCategory('Fleet', lastYear);
  const fleetChange = calculateChange(fleetCurrent.total_weight, fleetLast.total_weight);

  const lccCurrent = summaryByCategory('LCC', currentYear);
  const lccLast = summaryByCategory('LCC', lastYear);
  const lccChange = calculateChange(lccCurrent.total_weight, lccLast.total_weight);

  const totalCurrentWeight = fleetCurrent.total_weight + lccCurrent.total_weight;

  const badgeActive =
    'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900';
  const badgeInactive =
    'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700';

  return (
    <div className="space-y-6">
      {/* 비교 기준 + 사업소 badge bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">비교 기준</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('yoy')}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'yoy' ? badgeActive : badgeInactive
              }`}
            >
              전년 대비
            </button>
            <button
              type="button"
              onClick={() => setViewMode('goal')}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'goal' ? badgeActive : badgeInactive
              }`}
            >
              목표 대비
            </button>
          </div>
        </div>
        {branchesSorted.length > 0 && (
          <>
            <div
              className="hidden sm:block h-5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700"
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">사업소</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBranchFilter(null)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    branchFilter === null ? badgeActive : badgeInactive
                  }`}
                >
                  전체
                </button>
                {branchesSorted.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBranchFilter(b)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors max-w-[10rem] truncate ${
                      branchFilter === b ? badgeActive : badgeInactive
                    }`}
                    title={b}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

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
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">
                  Fleet + LCC 합계
                </th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-purple-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">Fleet</th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-orange-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">LCC</th>
              </tr>
              <tr>
                <th className="text-left py-2 px-4"></th>
                <th className="text-left py-2 px-4"></th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{viewMode === 'yoy' ? '비교(L)' : '실적/목표(L)'}</th>
                <th className={rateColThClass}>{viewMode === 'yoy' ? '증감율' : '달성율'}</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{viewMode === 'yoy' ? '비교(L)' : '실적/목표(L)'}</th>
                <th className={rateColThClass}>{viewMode === 'yoy' ? '증감율' : '달성율'}</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{viewMode === 'yoy' ? '비교(L)' : '실적/목표(L)'}</th>
                <th className={rateColThClass}>{viewMode === 'yoy' ? '증감율' : '달성율'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployeeList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    {branchFilter !== null
                      ? '선택한 사업소에 해당하는 담당자가 없습니다'
                      : '직원별 데이터가 없습니다'}
                  </td>
                </tr>
              ) : (
                teamGroups.map(({ team, employees }) => (
                  <Fragment key={team}>
                    {employees.map((emp) => {
                      // Get goal data for this employee
                      const empGoals = employeeGoalMap[emp.employee_name] || {
                        fleet_goal: 0,
                        lcc_goal: 0,
                        total_goal: 0,
                      };

                      // Calculate YoY changes
                      const totalChange = calculateChange(emp.total_current, emp.total_last);
                      const fleetChange = calculateChange(emp.fleet_current, emp.fleet_last);
                      const lccChange = calculateChange(emp.lcc_current, emp.lcc_last);

                      // Calculate achievement rates
                      const totalAchievement = calculateAchievementRate(emp.total_current, empGoals.total_goal);
                      const fleetAchievement = calculateAchievementRate(emp.fleet_current, empGoals.fleet_goal);
                      const lccAchievement = calculateAchievementRate(emp.lcc_current, empGoals.lcc_goal);

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
                          <td className="py-2 px-3 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={emp.total_current}
                                last={emp.total_last}
                                accentClass="text-blue-700 dark:text-blue-300"
                              />
                            ) : (
                              <GoalValuesCell
                                current={emp.total_current}
                                goal={empGoals.total_goal}
                                accentClass="text-blue-700 dark:text-blue-300"
                              />
                            )}
                          </td>
                          <td className={rateColTdClass}>
                            {viewMode === 'yoy' ? (
                              <MetricRateSpan
                                percent={Math.abs(totalChange.percent)}
                                isPositive={totalChange.isPositive}
                              />
                            ) : (
                              <MetricRateSpan
                                percent={totalAchievement.percent}
                                isPositive={totalAchievement.isPositive}
                              />
                            )}
                          </td>
                          <td className="py-2 px-3 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={emp.fleet_current}
                                last={emp.fleet_last}
                                accentClass="text-purple-700 dark:text-purple-300"
                              />
                            ) : (
                              <GoalValuesCell
                                current={emp.fleet_current}
                                goal={empGoals.fleet_goal}
                                accentClass="text-purple-700 dark:text-purple-300"
                              />
                            )}
                          </td>
                          <td className={rateColTdClass}>
                            {viewMode === 'yoy' ? (
                              <MetricRateSpan
                                percent={Math.abs(fleetChange.percent)}
                                isPositive={fleetChange.isPositive}
                              />
                            ) : (
                              <MetricRateSpan
                                percent={fleetAchievement.percent}
                                isPositive={fleetAchievement.isPositive}
                              />
                            )}
                          </td>
                          <td className="py-2 px-3 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={emp.lcc_current}
                                last={emp.lcc_last}
                                accentClass="text-orange-700 dark:text-orange-300"
                              />
                            ) : (
                              <GoalValuesCell
                                current={emp.lcc_current}
                                goal={empGoals.lcc_goal}
                                accentClass="text-orange-700 dark:text-orange-300"
                              />
                            )}
                          </td>
                          <td className={rateColTdClass}>
                            {viewMode === 'yoy' ? (
                              <MetricRateSpan
                                percent={Math.abs(lccChange.percent)}
                                isPositive={lccChange.isPositive}
                              />
                            ) : (
                              <MetricRateSpan
                                percent={lccAchievement.percent}
                                isPositive={lccAchievement.isPositive}
                              />
                            )}
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

                      // Calculate subtotal goals
                      const subTotalGoal = employees.reduce((sum, e) => {
                        const goals = employeeGoalMap[e.employee_name] || { total_goal: 0, fleet_goal: 0, lcc_goal: 0 };
                        return sum + goals.total_goal;
                      }, 0);
                      const subFleetGoal = employees.reduce((sum, e) => {
                        const goals = employeeGoalMap[e.employee_name] || { total_goal: 0, fleet_goal: 0, lcc_goal: 0 };
                        return sum + goals.fleet_goal;
                      }, 0);
                      const subLccGoal = employees.reduce((sum, e) => {
                        const goals = employeeGoalMap[e.employee_name] || { total_goal: 0, fleet_goal: 0, lcc_goal: 0 };
                        return sum + goals.lcc_goal;
                      }, 0);

                      const subTotalAchievement = calculateAchievementRate(subTotalCurrent, subTotalGoal);
                      const subFleetAchievement = calculateAchievementRate(sub.fleet_current, subFleetGoal);
                      const subLccAchievement = calculateAchievementRate(sub.lcc_current, subLccGoal);
                      return (
                        <tr
                          className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100/90 dark:bg-zinc-800/80 font-semibold"
                        >
                          <td className="py-3 px-4 text-zinc-800 dark:text-zinc-200">{team}</td>
                          <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">소계</td>
                          <td className="py-2 px-3 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={subTotalCurrent}
                                last={subTotalLast}
                                accentClass="text-blue-800 dark:text-blue-200"
                              />
                            ) : (
                              <GoalValuesCell
                                current={subTotalCurrent}
                                goal={subTotalGoal}
                                accentClass="text-blue-800 dark:text-blue-200"
                              />
                            )}
                          </td>
                          <td className={rateColTdClass}>
                            {viewMode === 'yoy' ? (
                              <MetricRateSpan
                                percent={Math.abs(subTotalChange.percent)}
                                isPositive={subTotalChange.isPositive}
                                tone="subtotal"
                              />
                            ) : (
                              <MetricRateSpan
                                percent={subTotalAchievement.percent}
                                isPositive={subTotalAchievement.isPositive}
                                tone="subtotal"
                              />
                            )}
                          </td>
                          <td className="py-2 px-3 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={sub.fleet_current}
                                last={sub.fleet_last}
                                accentClass="text-purple-800 dark:text-purple-200"
                              />
                            ) : (
                              <GoalValuesCell
                                current={sub.fleet_current}
                                goal={subFleetGoal}
                                accentClass="text-purple-800 dark:text-purple-200"
                              />
                            )}
                          </td>
                          <td className={rateColTdClass}>
                            {viewMode === 'yoy' ? (
                              <MetricRateSpan
                                percent={Math.abs(subFleetChange.percent)}
                                isPositive={subFleetChange.isPositive}
                                tone="subtotal"
                              />
                            ) : (
                              <MetricRateSpan
                                percent={subFleetAchievement.percent}
                                isPositive={subFleetAchievement.isPositive}
                                tone="subtotal"
                              />
                            )}
                          </td>
                          <td className="py-2 px-3 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={sub.lcc_current}
                                last={sub.lcc_last}
                                accentClass="text-orange-800 dark:text-orange-200"
                              />
                            ) : (
                              <GoalValuesCell
                                current={sub.lcc_current}
                                goal={subLccGoal}
                                accentClass="text-orange-800 dark:text-orange-200"
                              />
                            )}
                          </td>
                          <td className={rateColTdClass}>
                            {viewMode === 'yoy' ? (
                              <MetricRateSpan
                                percent={Math.abs(subLccChange.percent)}
                                isPositive={subLccChange.isPositive}
                                tone="subtotal"
                              />
                            ) : (
                              <MetricRateSpan
                                percent={subLccAchievement.percent}
                                isPositive={subLccAchievement.isPositive}
                                tone="subtotal"
                              />
                            )}
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
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider w-16">월</th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">Fleet + LCC 합계</th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-purple-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">Fleet</th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-orange-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">LCC</th>
              </tr>
              <tr>
                <th className="text-left py-2 px-2"></th>
                <th className="text-left py-2 px-2"></th>
                <th className="text-left py-2 px-2"></th>
                <th className="text-right py-2 px-3 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{viewMode === 'yoy' ? '비교(L)' : '실적/목표(L)'}</th>
                <th className={rateColThClass}>{viewMode === 'yoy' ? '증감율' : '달성율'}</th>
                <th className="text-right py-2 px-3 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{viewMode === 'yoy' ? '비교(L)' : '실적/목표(L)'}</th>
                <th className={rateColThClass}>{viewMode === 'yoy' ? '증감율' : '달성율'}</th>
                <th className="text-right py-2 px-3 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{viewMode === 'yoy' ? '비교(L)' : '실적/목표(L)'}</th>
                <th className={rateColThClass}>{viewMode === 'yoy' ? '증감율' : '달성율'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployeeMonthList.map((emp) => {
                // Get goal data for this employee
                const empGoals = employeeGoalMap[emp.employee_name] || {
                  fleet_goal: 0,
                  lcc_goal: 0,
                  total_goal: 0,
                };

                // Calculate YoY changes
                const totalChange = calculateChange(emp.cumulative_total_current, emp.cumulative_total_last);
                const fleetChange = calculateChange(emp.cumulative_fleet_current, emp.cumulative_fleet_last);
                const lccChange = calculateChange(emp.cumulative_lcc_current, emp.cumulative_lcc_last);

                // Calculate achievement rates
                const totalAchievement = calculateAchievementRate(emp.cumulative_total_current, empGoals.total_goal);
                const fleetAchievement = calculateAchievementRate(emp.cumulative_fleet_current, empGoals.fleet_goal);
                const lccAchievement = calculateAchievementRate(emp.cumulative_lcc_current, empGoals.lcc_goal);

                return (
                  <Fragment key={emp.employee_name}>
                    {/* Cumulative Row */}
                    <tr className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 font-semibold">
                      <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 text-xs">{emp.team}</td>
                      <td className="py-3 px-2 font-medium text-zinc-900 dark:text-zinc-100 text-sm">{emp.employee_name}</td>
                      <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 text-sm">누계</td>
                      <td className="py-2 px-3 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                        {viewMode === 'yoy' ? (
                          <YoYValuesCell
                            current={emp.cumulative_total_current}
                            last={emp.cumulative_total_last}
                            accentClass="text-blue-700 dark:text-blue-300"
                          />
                        ) : (
                          <GoalValuesCell
                            current={emp.cumulative_total_current}
                            goal={empGoals.total_goal}
                            accentClass="text-blue-700 dark:text-blue-300"
                          />
                        )}
                      </td>
                      <td className={rateColTdClass}>
                        {viewMode === 'yoy' ? (
                          <MetricRateSpan
                            percent={Math.abs(totalChange.percent)}
                            isPositive={totalChange.isPositive}
                          />
                        ) : (
                          <MetricRateSpan
                            percent={totalAchievement.percent}
                            isPositive={totalAchievement.isPositive}
                          />
                        )}
                      </td>
                      <td className="py-2 px-3 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                        {viewMode === 'yoy' ? (
                          <YoYValuesCell
                            current={emp.cumulative_fleet_current}
                            last={emp.cumulative_fleet_last}
                            accentClass="text-purple-700 dark:text-purple-300"
                          />
                        ) : (
                          <GoalValuesCell
                            current={emp.cumulative_fleet_current}
                            goal={empGoals.fleet_goal}
                            accentClass="text-purple-700 dark:text-purple-300"
                          />
                        )}
                      </td>
                      <td className={rateColTdClass}>
                        {viewMode === 'yoy' ? (
                          <MetricRateSpan
                            percent={Math.abs(fleetChange.percent)}
                            isPositive={fleetChange.isPositive}
                          />
                        ) : (
                          <MetricRateSpan
                            percent={fleetAchievement.percent}
                            isPositive={fleetAchievement.isPositive}
                          />
                        )}
                      </td>
                      <td className="py-2 px-3 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                        {viewMode === 'yoy' ? (
                          <YoYValuesCell
                            current={emp.cumulative_lcc_current}
                            last={emp.cumulative_lcc_last}
                            accentClass="text-orange-700 dark:text-orange-300"
                          />
                        ) : (
                          <GoalValuesCell
                            current={emp.cumulative_lcc_current}
                            goal={empGoals.lcc_goal}
                            accentClass="text-orange-700 dark:text-orange-300"
                          />
                        )}
                      </td>
                      <td className={rateColTdClass}>
                        {viewMode === 'yoy' ? (
                          <MetricRateSpan
                            percent={Math.abs(lccChange.percent)}
                            isPositive={lccChange.isPositive}
                          />
                        ) : (
                          <MetricRateSpan
                            percent={lccAchievement.percent}
                            isPositive={lccAchievement.isPositive}
                          />
                        )}
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
                        fleet_goal: 0,
                        lcc_goal: 0,
                        total_goal: 0,
                      };

                      const monthTotalChange = calculateChange(monthData.total_current, monthData.total_last);
                      const monthFleetChange = calculateChange(monthData.fleet_current, monthData.fleet_last);
                      const monthLccChange = calculateChange(monthData.lcc_current, monthData.lcc_last);

                      const monthTotalAchievement = calculateAchievementRate(monthData.total_current, monthData.total_goal);
                      const monthFleetAchievement = calculateAchievementRate(monthData.fleet_current, monthData.fleet_goal);
                      const monthLccAchievement = calculateAchievementRate(monthData.lcc_current, monthData.lcc_goal);

                      return (
                        <tr key={month} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-2 px-2"></td>
                          <td className="py-2 px-2"></td>
                          <td className="py-2 px-2 text-zinc-700 dark:text-zinc-300 text-sm">{parseInt(month)}월</td>
                          <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={monthData.total_current}
                                last={monthData.total_last}
                                accentClass="text-zinc-900 dark:text-zinc-100"
                                compact
                              />
                            ) : (
                              <GoalValuesCell
                                current={monthData.total_current}
                                goal={monthData.total_goal}
                                accentClass="text-zinc-900 dark:text-zinc-100"
                                compact
                              />
                            )}
                          </td>
                          <td className={rateColTdClassCompact}>
                            {viewMode === 'yoy' ? (
                              <MetricRateSpan
                                percent={Math.abs(monthTotalChange.percent)}
                                isPositive={monthTotalChange.isPositive}
                                compact
                              />
                            ) : (
                              <MetricRateSpan
                                percent={monthTotalAchievement.percent}
                                isPositive={monthTotalAchievement.isPositive}
                                compact
                              />
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={monthData.fleet_current}
                                last={monthData.fleet_last}
                                accentClass="text-zinc-900 dark:text-zinc-100"
                                compact
                              />
                            ) : (
                              <GoalValuesCell
                                current={monthData.fleet_current}
                                goal={monthData.fleet_goal}
                                accentClass="text-zinc-900 dark:text-zinc-100"
                                compact
                              />
                            )}
                          </td>
                          <td className={rateColTdClassCompact}>
                            {viewMode === 'yoy' ? (
                              <MetricRateSpan
                                percent={Math.abs(monthFleetChange.percent)}
                                isPositive={monthFleetChange.isPositive}
                                compact
                              />
                            ) : (
                              <MetricRateSpan
                                percent={monthFleetAchievement.percent}
                                isPositive={monthFleetAchievement.isPositive}
                                compact
                              />
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={monthData.lcc_current}
                                last={monthData.lcc_last}
                                accentClass="text-zinc-900 dark:text-zinc-100"
                                compact
                              />
                            ) : (
                              <GoalValuesCell
                                current={monthData.lcc_current}
                                goal={monthData.lcc_goal}
                                accentClass="text-zinc-900 dark:text-zinc-100"
                                compact
                              />
                            )}
                          </td>
                          <td className={rateColTdClassCompact}>
                            {viewMode === 'yoy' ? (
                              <MetricRateSpan
                                percent={Math.abs(monthLccChange.percent)}
                                isPositive={monthLccChange.isPositive}
                                compact
                              />
                            ) : (
                              <MetricRateSpan
                                percent={monthLccAchievement.percent}
                                isPositive={monthLccAchievement.isPositive}
                                compact
                              />
                            )}
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
