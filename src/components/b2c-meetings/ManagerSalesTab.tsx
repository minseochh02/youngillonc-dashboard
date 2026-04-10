"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { useDisplayOrderBootstrap } from '@/hooks/useDisplayOrderBootstrap';
import { compareOffices, compareTeams } from '@/lib/display-order-core';
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

type ManagerSummarySegment =
  | 'B2B_FIELD'
  | 'B2B_MB'
  | 'B2B_ETC'
  | 'B2C_FIELD'
  | 'B2C_OFFICE'
  | 'B2C_NAMBU';

/** 사무실·남부지사 팀은 LCC 거래처만 담당 — 표시도 LCC 기준으로 통일 */
function isOfficeOrNambuLccOnlyTeam(team: string): boolean {
  const t = team.trim();
  return t.includes('사무실') || t.includes('남부지사');
}

interface TeamChannelSummaryRow {
  segment: ManagerSummarySegment | string;
  channel: string;
  year: string;
  total_weight: number;
  client_count: number;
}

interface EmployeeClientTotalRow {
  employee_name: string;
  year: string;
  client_count: number;
}

interface EmployeeClientTotalMonthRow {
  employee_name: string;
  year: string;
  year_month: string;
  client_count: number;
}

interface EmployeeClientChannelRow {
  employee_name: string;
  year: string;
  channel: string;
  client_count: number;
}

interface EmployeeClientChannelMonthRow extends EmployeeClientChannelRow {
  year_month: string;
}

interface ManagerSalesData {
  summaryData: SummaryDataRow[];
  employeeData: EmployeeDataRow[];
  goalData?: GoalDataRow[];
  totalClientCountByYear?: Record<string, number>;
  teamChannelMonthSummary?: TeamChannelSummaryRow[];
  employeeClientTotalCumulative?: EmployeeClientTotalRow[];
  employeeClientChannelCumulative?: EmployeeClientChannelRow[];
  employeeClientTotalMonthly?: EmployeeClientTotalMonthRow[];
  employeeClientChannelMonthly?: EmployeeClientChannelMonthRow[];
  employeeClientChannelSingleMonth?: EmployeeClientChannelRow[];
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
  const displayOrder = useDisplayOrderBootstrap();
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
  /** 당해·전년 거래처수 (개) — 매출액 탭 거래처 표기와 동일 패턴 */
  const ClientYoYCell = ({
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
        className={`font-mono font-semibold tabular-nums text-zinc-800 dark:text-zinc-100 ${
          compact ? 'text-[10px]' : 'text-xs'
        }`}
      >
        {current.toLocaleString()}개
      </span>
      <span
        className={`font-mono text-zinc-500 dark:text-zinc-400 tabular-nums ${
          compact ? 'text-[8px]' : 'text-[9px]'
        }`}
      >
        전년 {last.toLocaleString()}개
      </span>
    </div>
  );

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

  /** Monthly table: 팀 / 직원명 / 월 (narrower) + 8 metric columns */
  const managerSalesMonthlyTableColgroup = (
    <colgroup>
      <col className="w-20" />
      <col className="w-24" />
      <col className="w-16" />
      <col />
      <col />
      <col />
      <col />
      <col />
      <col />
      <col />
      <col />
    </colgroup>
  );

  /** Team table: 팀·직원명 split monthly’s 팀+w-24+w-16 (15rem) evenly — data aligns with bottom */
  const managerSalesTeamTableColgroup = (
    <colgroup>
      <col className="w-[7.5rem]" />
      <col className="w-[7.5rem]" />
      <col />
      <col />
      <col />
      <col />
      <col />
      <col />
      <col />
      <col />
      <col />
    </colgroup>
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

  if (!data.employeeData || data.employeeData.length === 0) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400 p-8">
        <p>담당자 매출 데이터가 없습니다</p>
        <p className="text-sm mt-2">필터 조건을 확인하세요: B2C 팀, AUTO 채널 고객</p>
      </div>
    );
  }

  const {
    currentYear,
    lastYear,
    employeeData,
    currentMonth,
    totalClientCountByYear = {},
    teamChannelMonthSummary = [],
    employeeClientTotalCumulative = [],
    employeeClientChannelCumulative = [],
    employeeClientTotalMonthly = [],
    employeeClientChannelMonthly = [],
    employeeClientChannelSingleMonth = [],
  } = data;
  const targetMonth = selectedMonth || currentMonth;
  const lastYearMonth = targetMonth.replace(currentYear, lastYear);
  const [_, selectedMonthNum] = targetMonth.split('-');

  const totalClientsCurrentMonth = totalClientCountByYear[currentYear] ?? 0;
  const totalClientsLastMonth = totalClientCountByYear[lastYear] ?? 0;

  const pickSegmentChannel = (segment: ManagerSummarySegment, channel: 'Fleet' | 'LCC') => {
    const cur = teamChannelMonthSummary.find(
      (r) => r.segment === segment && r.channel === channel && r.year === currentYear
    );
    const last = teamChannelMonthSummary.find(
      (r) => r.segment === segment && r.channel === channel && r.year === lastYear
    );
    const wCur = cur?.total_weight ?? 0;
    const wLast = last?.total_weight ?? 0;
    const cCur = cur?.client_count ?? 0;
    const cLast = last?.client_count ?? 0;
    return {
      weight: wCur,
      lastWeight: wLast,
      clients: cCur,
      lastClients: cLast,
      change: calculateChange(wCur, wLast),
    };
  };

  const clientTotalSingle = new Map<string, { cur: number; last: number }>();
  employeeClientTotalMonthly.forEach((r) => {
    if (r.year_month !== targetMonth && r.year_month !== lastYearMonth) return;
    if (!clientTotalSingle.has(r.employee_name)) {
      clientTotalSingle.set(r.employee_name, { cur: 0, last: 0 });
    }
    const o = clientTotalSingle.get(r.employee_name)!;
    if (r.year === currentYear && r.year_month === targetMonth) o.cur = r.client_count;
    if (r.year === lastYear && r.year_month === lastYearMonth) o.last = r.client_count;
  });

  const clientChSingle = new Map<string, { cur: number; last: number }>();
  employeeClientChannelSingleMonth.forEach((r) => {
    const k = `${r.employee_name}|${r.channel}`;
    if (!clientChSingle.has(k)) clientChSingle.set(k, { cur: 0, last: 0 });
    const o = clientChSingle.get(k)!;
    if (r.year === currentYear) o.cur = r.client_count;
    if (r.year === lastYear) o.last = r.client_count;
  });

  const clientTotalCum = new Map<string, { cur: number; last: number }>();
  employeeClientTotalCumulative.forEach((r) => {
    if (!clientTotalCum.has(r.employee_name)) {
      clientTotalCum.set(r.employee_name, { cur: 0, last: 0 });
    }
    const o = clientTotalCum.get(r.employee_name)!;
    if (r.year === currentYear) o.cur = r.client_count;
    if (r.year === lastYear) o.last = r.client_count;
  });

  const clientChCum = new Map<string, { cur: number; last: number }>();
  employeeClientChannelCumulative.forEach((r) => {
    const k = `${r.employee_name}|${r.channel}`;
    if (!clientChCum.has(k)) clientChCum.set(k, { cur: 0, last: 0 });
    const o = clientChCum.get(k)!;
    if (r.year === currentYear) o.cur = r.client_count;
    if (r.year === lastYear) o.last = r.client_count;
  });

  const clientTotalMonthLookup = new Map<string, number>();
  employeeClientTotalMonthly.forEach((r) => {
    clientTotalMonthLookup.set(`${r.employee_name}|${r.year_month}|${r.year}`, r.client_count);
  });

  const clientChMonthLookup = new Map<string, number>();
  employeeClientChannelMonthly.forEach((r) => {
    clientChMonthLookup.set(
      `${r.employee_name}|${r.year_month}|${r.channel}|${r.year}`,
      r.client_count
    );
  });

  const getClientTotalSingle = (emp: string) => clientTotalSingle.get(emp) ?? { cur: 0, last: 0 };
  const getClientChSingle = (emp: string, ch: 'Fleet' | 'LCC') =>
    clientChSingle.get(`${emp}|${ch}`) ?? { cur: 0, last: 0 };
  const getClientTotalCum = (emp: string) => clientTotalCum.get(emp) ?? { cur: 0, last: 0 };
  const getClientChCum = (emp: string, ch: 'Fleet' | 'LCC') =>
    clientChCum.get(`${emp}|${ch}`) ?? { cur: 0, last: 0 };
  const getClientTotalMonth = (emp: string, monthPadded: string) => {
    const ymc = `${currentYear}-${monthPadded}`;
    const yml = `${lastYear}-${monthPadded}`;
    const cur = clientTotalMonthLookup.get(`${emp}|${ymc}|${currentYear}`) ?? 0;
    const last = clientTotalMonthLookup.get(`${emp}|${yml}|${lastYear}`) ?? 0;
    return { cur, last };
  };
  const getClientChMonth = (emp: string, monthPadded: string, ch: 'Fleet' | 'LCC') => {
    const ymc = `${currentYear}-${monthPadded}`;
    const yml = `${lastYear}-${monthPadded}`;
    const cur = clientChMonthLookup.get(`${emp}|${ymc}|${ch}|${currentYear}`) ?? 0;
    const last = clientChMonthLookup.get(`${emp}|${yml}|${ch}|${lastYear}`) ?? 0;
    return { cur, last };
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
    const tc = compareTeams(a.team, b.team, displayOrder.teamB2c, displayOrder.teamB2b);
    if (tc !== 0) return tc;
    return b.total_current - a.total_current;
  });

  const normalizeBranch = (b: string | undefined) => {
    const t = b?.trim();
    return t && t.length > 0 ? t : '미지정';
  };

  const branchesSorted = Array.from(
    new Set(employeeList.map((e) => normalizeBranch(e.branch)))
  ).sort((a, b) => compareOffices(a, b, displayOrder.office));

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

  // Helper to determine segment from team and branch
  const getSegmentFromEmployee = (team: string, branch: string): ManagerSummarySegment | null => {
    const t = team.trim();
    const b = branch?.trim() || '';

    if (t === 'B2B') {
      if (b === '벤츠') return 'B2B_MB';
      if (b && b.length > 0) return 'B2B_FIELD';
      return 'B2B_ETC';
    }
    if (t.includes('사무실') || b.includes('사무실')) return 'B2C_OFFICE';
    if (t.includes('남부지사') || b.includes('남부지사')) return 'B2C_NAMBU';
    if (t && t !== 'B2B') return 'B2C_FIELD';
    return null;
  };

  // Aggregate goals by segment and channel
  const getSegmentChannelGoal = (segment: ManagerSummarySegment, channel: 'Fleet' | 'LCC'): number => {
    let totalGoal = 0;
    const processedEmployees = new Set<string>();

    // Find all employees in this segment
    employeeData.forEach((emp) => {
      if (emp.year_month !== targetMonth) return;
      if (processedEmployees.has(emp.employee_name)) return; // Avoid double counting

      const empSegment = getSegmentFromEmployee(emp.team, emp.branch);
      if (empSegment !== segment) return;

      processedEmployees.add(emp.employee_name);

      // Get goal for this employee
      const goals = employeeGoalMap[emp.employee_name];
      if (!goals) return;

      if (channel === 'Fleet') {
        totalGoal += goals.fleet_goal;
      } else {
        totalGoal += goals.lcc_goal;
      }
    });

    return totalGoal;
  };

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
    const tc = compareTeams(a.team, b.team, displayOrder.teamB2c, displayOrder.teamB2b);
    if (tc !== 0) return tc;
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

  const badgeActive =
    'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900';
  const badgeInactive =
    'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700';

  type SegmentChannelMetrics = ReturnType<typeof pickSegmentChannel>;

  const SummaryChannelBlock = ({
    label,
    accent,
    m,
    poolTotal,
    viewMode,
    goalValue = 0,
  }: {
    label: string;
    accent: 'purple' | 'orange';
    m: SegmentChannelMetrics;
    poolTotal: number;
    viewMode: ViewMode;
    goalValue?: number;
  }) => {
    const border =
      accent === 'purple'
        ? 'border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/40 to-purple-100/20 dark:from-purple-950/20 dark:to-purple-900/10'
        : 'border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50/40 to-orange-100/20 dark:from-orange-950/20 dark:to-orange-900/10';
    const labelCls =
      accent === 'purple'
        ? 'text-purple-700 dark:text-purple-300'
        : 'text-orange-700 dark:text-orange-300';
    const numCls =
      accent === 'purple'
        ? 'text-purple-900 dark:text-purple-100'
        : 'text-orange-900 dark:text-orange-100';

    const metric = viewMode === 'yoy' ? m.change : calculateAchievementRate(m.weight, goalValue);
    const compareValue = viewMode === 'yoy' ? m.lastWeight : goalValue;
    const compareLabel = viewMode === 'yoy' ? '전년' : '목표';

    return (
      <div className={`rounded-lg border p-2 ${border}`}>
        <div className="flex items-baseline justify-between mb-1">
          <p className={`text-[10px] font-bold uppercase tracking-wide ${labelCls}`}>{label}</p>
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums ${
              metric.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {metric.isPositive ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            {viewMode === 'yoy' && metric.isPositive ? '+' : ''}
            {metric.percent.toFixed(1)}%
          </span>
        </div>

        <p className={`text-xl font-bold tabular-nums leading-none ${numCls}`}>
          {formatNumber(m.weight)}
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-0.5">L</span>
        </p>

        <div className="mt-1 flex items-baseline justify-between text-[9px]">
          <span className="text-zinc-500 dark:text-zinc-400">
            {compareLabel} {formatNumber(compareValue)}
          </span>
          <span className="text-zinc-400 dark:text-zinc-500">
            {poolTotal > 0 ? ((m.weight / poolTotal) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>

        <div className="mt-1 pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50 flex items-baseline justify-between">
          <span className="text-[9px] text-zinc-500 dark:text-zinc-400">거래처</span>
          <div className="flex items-baseline gap-1">
            <span className={`text-xs font-bold tabular-nums ${labelCls}`}>
              {m.clients.toLocaleString()}
            </span>
            <span className="text-[8px] text-zinc-400">
              ({m.lastClients.toLocaleString()})
            </span>
          </div>
        </div>
      </div>
    );
  };

  type SegmentCardTheme = 'b2c' | 'b2b';

  const renderSegmentSummaryCard = (key: ManagerSummarySegment, label: string, theme: SegmentCardTheme, lccOnly = false) => {
    const lccOnlySeg = key === 'B2C_OFFICE' || key === 'B2C_NAMBU' || lccOnly;
    const fleet = lccOnlySeg ? null : pickSegmentChannel(key, 'Fleet');
    const lcc = pickSegmentChannel(key, 'LCC');
    const fleetGoal = lccOnlySeg ? 0 : getSegmentChannelGoal(key, 'Fleet');
    const lccGoal = getSegmentChannelGoal(key, 'LCC');
    const segmentTotal = lccOnlySeg ? lcc.weight : fleet!.weight + lcc.weight;
    const isB2c = theme === 'b2c';
    const outer =
      isB2c
        ? 'rounded-lg border border-blue-200/80 dark:border-blue-900/50 bg-white/60 dark:bg-zinc-900/30 p-2'
        : 'rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-white/50 dark:bg-zinc-900/25 p-2';
    const titleCls = isB2c ? 'text-blue-900 dark:text-blue-100' : 'text-amber-900 dark:text-amber-100';
    return (
      <div key={key} className={outer}>
        <div className="flex items-baseline justify-between mb-1.5">
          <p className={`text-xs font-bold ${titleCls}`}>{label}</p>
          <span className="text-[9px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            {lccOnlySeg ? 'LCC만' : `합계 ${formatNumber(segmentTotal)} L`}
          </span>
        </div>
        <div className={`grid ${lccOnlySeg ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
          {!lccOnlySeg && (
            <SummaryChannelBlock label="Fleet" accent="purple" m={fleet!} poolTotal={segmentTotal} viewMode={viewMode} goalValue={fleetGoal} />
          )}
          <SummaryChannelBlock label="LCC" accent="orange" m={lcc} poolTotal={segmentTotal} viewMode={viewMode} goalValue={lccGoal} />
        </div>
      </div>
    );
  };

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

      {/* Summary: 전체 거래처 + B2C/B2B × Fleet/LCC */}
      <div className="space-y-3">
        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              전체 거래처수 <span className="text-[9px] font-normal">({targetMonth} vs {lastYearMonth})</span>
            </p>
            <div className="flex items-baseline gap-4">
              <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {totalClientsCurrentMonth.toLocaleString()}
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-0.5">개</span>
              </span>
              <span className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                전년 {totalClientsLastMonth.toLocaleString()}개
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/90 to-cyan-50/50 dark:from-blue-950/25 dark:to-cyan-950/10 p-2.5 w-full">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">B2C 팀</h3>
              <span className="text-[9px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{targetMonth}</span>
            </div>
            <div className="space-y-2">
              {renderSegmentSummaryCard('B2C_FIELD', '현장 팀', 'b2c')}
              <div className="grid grid-cols-2 gap-2">
                {renderSegmentSummaryCard('B2C_OFFICE', '사무실', 'b2c')}
                {renderSegmentSummaryCard('B2C_NAMBU', '남부지사', 'b2c')}
              </div>
            </div>
          </div>

          {(() => {
            const fieldLcc = pickSegmentChannel('B2B_FIELD', 'LCC');
            const mbLcc = pickSegmentChannel('B2B_MB', 'LCC');
            const etcLcc = pickSegmentChannel('B2B_ETC', 'LCC');
            const b2bCombined = fieldLcc.weight + mbLcc.weight + etcLcc.weight;
            return (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-950/25 dark:to-orange-950/10 p-2.5 w-full">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">B2B 팀</h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                      합계 {formatNumber(b2bCombined)} L
                    </span>
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{targetMonth}</span>
                  </div>
                </div>
                <p className="text-[9px] text-amber-700/80 dark:text-amber-300/80 mb-2 leading-tight">
                  LCC만 표시 · Fleet은 B2C 현장팀만 해당
                </p>
                <div className="space-y-2">
                  {renderSegmentSummaryCard('B2B_FIELD', '현장 팀', 'b2b', true)}
                  <div className="grid grid-cols-2 gap-2">
                    {renderSegmentSummaryCard('B2B_MB', 'MB', 'b2b', true)}
                    {renderSegmentSummaryCard('B2B_ETC', '기타', 'b2b', true)}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Employee Details Table - Grouped by Team */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 space-y-1">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">팀별 담당자 Fleet/LCC 매출 · 거래처수</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            {managerSalesTeamTableColgroup}
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">팀</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">직원명</th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">
                  Fleet + LCC 합계
                </th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-purple-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">Fleet</th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-orange-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">LCC</th>
                <th colSpan={3} className="text-center py-3 px-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">
                  거래처수
                </th>
              </tr>
              <tr>
                <th className="text-left py-2 px-2"></th>
                <th className="text-left py-2 px-2"></th>
                <th className="text-right py-2 px-2 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{viewMode === 'yoy' ? '비교(L)' : '실적/목표(L)'}</th>
                <th className={rateColThClass}>{viewMode === 'yoy' ? '증감율' : '달성율'}</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{viewMode === 'yoy' ? '비교(L)' : '실적/목표(L)'}</th>
                <th className={rateColThClass}>{viewMode === 'yoy' ? '증감율' : '달성율'}</th>
                <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700">{viewMode === 'yoy' ? '비교(L)' : '실적/목표(L)'}</th>
                <th className={rateColThClass}>{viewMode === 'yoy' ? '증감율' : '달성율'}</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700 whitespace-nowrap">합계(개)</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-purple-600 whitespace-nowrap">Fleet</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-orange-600 whitespace-nowrap">LCC</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployeeList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
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

                      const lccOnlyTeam = isOfficeOrNambuLccOnlyTeam(emp.team);

                      // Calculate YoY changes
                      const totalChange = lccOnlyTeam
                        ? calculateChange(emp.lcc_current, emp.lcc_last)
                        : calculateChange(emp.total_current, emp.total_last);
                      const fleetChange = calculateChange(emp.fleet_current, emp.fleet_last);
                      const lccChange = calculateChange(emp.lcc_current, emp.lcc_last);

                      // Calculate achievement rates
                      const totalAchievement = lccOnlyTeam
                        ? calculateAchievementRate(emp.lcc_current, empGoals.lcc_goal)
                        : calculateAchievementRate(emp.total_current, empGoals.total_goal);
                      const fleetAchievement = calculateAchievementRate(emp.fleet_current, empGoals.fleet_goal);
                      const lccAchievement = calculateAchievementRate(emp.lcc_current, empGoals.lcc_goal);

                      return (
                        <tr
                          key={emp.employee_name}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-3 px-2 text-zinc-700 dark:text-zinc-300 font-medium min-w-0">
                            {emp.team}
                          </td>
                          <td className="py-3 px-2 font-semibold text-zinc-900 dark:text-zinc-100 min-w-0">
                            {emp.employee_name}
                          </td>
                          <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={lccOnlyTeam ? emp.lcc_current : emp.total_current}
                                last={lccOnlyTeam ? emp.lcc_last : emp.total_last}
                                accentClass="text-blue-700 dark:text-blue-300"
                              />
                            ) : (
                              <GoalValuesCell
                                current={lccOnlyTeam ? emp.lcc_current : emp.total_current}
                                goal={lccOnlyTeam ? empGoals.lcc_goal : empGoals.total_goal}
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
                            {lccOnlyTeam ? (
                              <span className="text-zinc-400 text-sm">—</span>
                            ) : viewMode === 'yoy' ? (
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
                            {lccOnlyTeam ? (
                              <span className="text-zinc-400 text-sm">—</span>
                            ) : viewMode === 'yoy' ? (
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
                          <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            <ClientYoYCell
                              current={
                                lccOnlyTeam
                                  ? getClientChSingle(emp.employee_name, 'LCC').cur
                                  : getClientTotalSingle(emp.employee_name).cur
                              }
                              last={
                                lccOnlyTeam
                                  ? getClientChSingle(emp.employee_name, 'LCC').last
                                  : getClientTotalSingle(emp.employee_name).last
                              }
                            />
                          </td>
                          <td className="py-2 px-2 text-right align-middle">
                            {lccOnlyTeam ? (
                              <span className="text-zinc-400 text-xs">—</span>
                            ) : (
                              <ClientYoYCell
                                current={getClientChSingle(emp.employee_name, 'Fleet').cur}
                                last={getClientChSingle(emp.employee_name, 'Fleet').last}
                              />
                            )}
                          </td>
                          <td className="py-2 px-2 text-right align-middle">
                            <ClientYoYCell
                              current={getClientChSingle(emp.employee_name, 'LCC').cur}
                              last={getClientChSingle(emp.employee_name, 'LCC').last}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {(() => {
                      const sub = sumTeamMetrics(employees);
                      const lccOnlyGroup = isOfficeOrNambuLccOnlyTeam(team);
                      const subTotalCurrent = lccOnlyGroup ? sub.lcc_current : sub.fleet_current + sub.lcc_current;
                      const subTotalLast = lccOnlyGroup ? sub.lcc_last : sub.fleet_last + sub.lcc_last;
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

                      const subTotalGoalForCol = lccOnlyGroup ? subLccGoal : subTotalGoal;
                      const subTotalAchievement = calculateAchievementRate(subTotalCurrent, subTotalGoalForCol);
                      const subFleetAchievement = calculateAchievementRate(sub.fleet_current, subFleetGoal);
                      const subLccAchievement = calculateAchievementRate(sub.lcc_current, subLccGoal);
                      return (
                        <tr
                          className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100/90 dark:bg-zinc-800/80 font-semibold"
                        >
                          <td className="py-3 px-2 text-zinc-800 dark:text-zinc-200 min-w-0">{team}</td>
                          <td className="py-3 px-2 text-zinc-900 dark:text-zinc-100 min-w-0">소계</td>
                          <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            {viewMode === 'yoy' ? (
                              <YoYValuesCell
                                current={subTotalCurrent}
                                last={subTotalLast}
                                accentClass="text-blue-800 dark:text-blue-200"
                              />
                            ) : (
                              <GoalValuesCell
                                current={subTotalCurrent}
                                goal={subTotalGoalForCol}
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
                            {lccOnlyGroup ? (
                              <span className="text-zinc-400 text-sm">—</span>
                            ) : viewMode === 'yoy' ? (
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
                            {lccOnlyGroup ? (
                              <span className="text-zinc-400 text-sm">—</span>
                            ) : viewMode === 'yoy' ? (
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
                          <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 text-zinc-400 text-xs">
                            —
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-400 text-xs">—</td>
                          <td className="py-2 px-2 text-right text-zinc-400 text-xs">—</td>
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
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 space-y-1">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            팀별 담당자 월별 Fleet/LCC 매출 · 거래처수 (누계: 1월~{parseInt(selectedMonthNum)}월)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            {managerSalesMonthlyTableColgroup}
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">팀</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">직원명</th>
                <th className="text-left py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">월</th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">Fleet + LCC 합계</th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-purple-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">Fleet</th>
                <th colSpan={2} className="text-center py-3 px-4 text-xs font-bold text-orange-600 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">LCC</th>
                <th colSpan={3} className="text-center py-3 px-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider border-l border-zinc-300 dark:border-zinc-700">
                  거래처수
                </th>
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
                <th className="text-right py-2 px-2 text-[10px] font-bold text-zinc-500 border-l border-zinc-300 dark:border-zinc-700 whitespace-nowrap">합계(개)</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-purple-600 whitespace-nowrap">Fleet</th>
                <th className="text-right py-2 px-2 text-[10px] font-bold text-orange-600 whitespace-nowrap">LCC</th>
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

                const lccOnlyTeam = isOfficeOrNambuLccOnlyTeam(emp.team);

                // Calculate YoY changes
                const totalChange = lccOnlyTeam
                  ? calculateChange(emp.cumulative_lcc_current, emp.cumulative_lcc_last)
                  : calculateChange(emp.cumulative_total_current, emp.cumulative_total_last);
                const fleetChange = calculateChange(emp.cumulative_fleet_current, emp.cumulative_fleet_last);
                const lccChange = calculateChange(emp.cumulative_lcc_current, emp.cumulative_lcc_last);

                // Calculate achievement rates
                const totalAchievement = lccOnlyTeam
                  ? calculateAchievementRate(emp.cumulative_lcc_current, empGoals.lcc_goal)
                  : calculateAchievementRate(emp.cumulative_total_current, empGoals.total_goal);
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
                            current={lccOnlyTeam ? emp.cumulative_lcc_current : emp.cumulative_total_current}
                            last={lccOnlyTeam ? emp.cumulative_lcc_last : emp.cumulative_total_last}
                            accentClass="text-blue-700 dark:text-blue-300"
                          />
                        ) : (
                          <GoalValuesCell
                            current={lccOnlyTeam ? emp.cumulative_lcc_current : emp.cumulative_total_current}
                            goal={lccOnlyTeam ? empGoals.lcc_goal : empGoals.total_goal}
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
                        {lccOnlyTeam ? (
                          <span className="text-zinc-400 text-sm">—</span>
                        ) : viewMode === 'yoy' ? (
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
                        {lccOnlyTeam ? (
                          <span className="text-zinc-400 text-sm">—</span>
                        ) : viewMode === 'yoy' ? (
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
                      <td className="py-2 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                        <ClientYoYCell
                          current={
                            lccOnlyTeam
                              ? getClientChCum(emp.employee_name, 'LCC').cur
                              : getClientTotalCum(emp.employee_name).cur
                          }
                          last={
                            lccOnlyTeam
                              ? getClientChCum(emp.employee_name, 'LCC').last
                              : getClientTotalCum(emp.employee_name).last
                          }
                        />
                      </td>
                      <td className="py-2 px-2 text-right align-middle">
                        {lccOnlyTeam ? (
                          <span className="text-zinc-400 text-xs">—</span>
                        ) : (
                          <ClientYoYCell
                            current={getClientChCum(emp.employee_name, 'Fleet').cur}
                            last={getClientChCum(emp.employee_name, 'Fleet').last}
                          />
                        )}
                      </td>
                      <td className="py-2 px-2 text-right align-middle">
                        <ClientYoYCell
                          current={getClientChCum(emp.employee_name, 'LCC').cur}
                          last={getClientChCum(emp.employee_name, 'LCC').last}
                        />
                      </td>
                    </tr>

                    {/* Monthly Rows */}
                    {Array.from({ length: 12 }, (__, i) => {
                      const month = String(i + 1).padStart(2, '0');
                      const monthNum = parseInt(selectedMonthNum);
                      if (i + 1 > monthNum) return null;

                      const ct = getClientTotalMonth(emp.employee_name, month);
                      const cf = getClientChMonth(emp.employee_name, month, 'Fleet');
                      const cl = getClientChMonth(emp.employee_name, month, 'LCC');

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

                      const monthTotalChange = lccOnlyTeam
                        ? calculateChange(monthData.lcc_current, monthData.lcc_last)
                        : calculateChange(monthData.total_current, monthData.total_last);
                      const monthFleetChange = calculateChange(monthData.fleet_current, monthData.fleet_last);
                      const monthLccChange = calculateChange(monthData.lcc_current, monthData.lcc_last);

                      const monthTotalAchievement = lccOnlyTeam
                        ? calculateAchievementRate(monthData.lcc_current, monthData.lcc_goal)
                        : calculateAchievementRate(monthData.total_current, monthData.total_goal);
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
                                current={lccOnlyTeam ? monthData.lcc_current : monthData.total_current}
                                last={lccOnlyTeam ? monthData.lcc_last : monthData.total_last}
                                accentClass="text-zinc-900 dark:text-zinc-100"
                                compact
                              />
                            ) : (
                              <GoalValuesCell
                                current={lccOnlyTeam ? monthData.lcc_current : monthData.total_current}
                                goal={lccOnlyTeam ? monthData.lcc_goal : monthData.total_goal}
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
                            {lccOnlyTeam ? (
                              <span className="text-zinc-400 text-xs">—</span>
                            ) : viewMode === 'yoy' ? (
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
                            {lccOnlyTeam ? (
                              <span className="text-zinc-400 text-xs">—</span>
                            ) : viewMode === 'yoy' ? (
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
                          <td className="py-1.5 px-2 text-right border-l border-zinc-200 dark:border-zinc-700 align-middle">
                            <ClientYoYCell
                              current={lccOnlyTeam ? cl.cur : ct.cur}
                              last={lccOnlyTeam ? cl.last : ct.last}
                              compact
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right align-middle">
                            {lccOnlyTeam ? (
                              <span className="text-zinc-400 text-[10px]">—</span>
                            ) : (
                              <ClientYoYCell current={cf.cur} last={cf.last} compact />
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right align-middle">
                            <ClientYoYCell current={cl.cur} last={cl.last} compact />
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
          <li>
            거래처수: DISTINCT 거래처코드 (합계 열은 Fleet+LCC 통합 기준, 팀 소계 행은 distinct 합산 불가로 &quot;—&quot;)
          </li>
          <li>
            요약 카드: B2C는 현장·사무실·남부지사로 구분. B2B는 MB(전체사업소=벤츠)·현장(그 외 사업소명 있음)·기타(전체사업소 공란 등). 당월·전년 동월 비교. B2C 사무실·남부지사 카드는 LCC만 표시.
          </li>
        </ul>
      </div>
    </div>
  );
}
