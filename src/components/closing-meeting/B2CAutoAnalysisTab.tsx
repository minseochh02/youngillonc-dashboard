"use client";

import { useState, useEffect, useRef, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, Database, ChevronDown, ChevronRight, Pencil, Save, X } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface CategoryData {
  category: string;
  current_month_weight: number;
  current_month_amount: number;
  last_month_weight: number;
  last_month_amount: number;
  yoy_weight: number;
  yoy_growth_rate: number;
  target_weight: number;
  achievement_rate: number;
}

interface TeamData {
  team_name: string;
  current_month_weight: number;
  current_month_amount: number;
  last_month_weight: number;
  yoy_weight: number;
  yoy_growth_rate: number;
  target_weight: number;
  achievement_rate: number;
  categories: CategoryData[];
}

interface BranchData {
  branch: string;
  current_month_weight: number;
  current_month_amount: number;
  last_month_weight: number;
  yoy_weight: number;
  yoy_growth_rate: number;
  target_weight: number;
  achievement_rate: number;
  teams: TeamData[];
}

interface B2CAnalysis {
  currentMonth: string;
  lastMonth: string;
  currentYear: string;
  categories: CategoryData[];
  branches: BranchData[];
  b2bTotal: {
    weight: number;
    amount: number;
    ytd_weight: number;
    ytd_amount: number;
  };
  total: {
    current_month_weight: number;
    current_month_amount: number;
    ytd_weight: number;
    ytd_amount: number;
    last_month_weight: number;
    last_month_amount: number;
    yoy_weight: number;
    yoy_growth_rate: number;
    target_weight: number;
    achievement_rate: number;
  };
  yearlySummary?: Array<{
    year: string;
    sales_weight: number;
    last_year_sales_weight: number;
    purchase_weight: number;
    yoy_growth_rate: number;
    target_weight: number;
    achievement_rate: number;
  }>;
  yearlyCategoryBreakdown?: Array<{
    year: string;
    categories: Array<{
      category: string;
      sales_weight: number;
      last_year_sales_weight: number;
      purchase_weight: number;
      yoy_growth_rate: number;
      target_weight: number;
      achievement_rate: number;
      b2b_total?: {
        sales_weight: number;
        last_year_sales_weight: number;
        yoy_growth_rate: number;
      };
      branches: Array<{
        branch: string;
        sales_weight: number;
        last_year_sales_weight: number;
        yoy_growth_rate: number;
        target_weight: number;
        achievement_rate: number;
        teams: Array<{
          team_name: string;
          sales_weight: number;
          last_year_sales_weight: number;
          yoy_growth_rate: number;
          target_weight: number;
          achievement_rate: number;
        }>;
      }>;
    }>;
  }>;
  /** YTD through selected month: B2C sales (L) per calendar month × 품목그룹 */
  monthlyCategoryBreakdown?: {
    year: string;
    months: string[];
    rows: Array<{
      category: string;
      byMonth: Record<string, number>;
      rowTotal: number;
    }>;
    monthTotals: Record<string, number>;
    grandTotal: number;
  };
}

interface B2CAnalysisProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function B2CAutoAnalysisTab({ selectedMonth, onMonthsAvailable }: B2CAnalysisProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<B2CAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [teamDrawer, setTeamDrawer] = useState<{
    isOpen: boolean;
    year: string;
    category: string;
    branch: string;
    teams: Array<{
      team_name: string;
      sales_weight: number;
      last_year_sales_weight: number;
      yoy_growth_rate: number;
      target_weight: number;
      achievement_rate: number;
    }>;
  }>({
    isOpen: false,
    year: '',
    category: '',
    branch: '',
    teams: [],
  });
  const [editingTargets, setEditingTargets] = useState<Map<string, number>>(new Map());
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const hasReportedMonths = useRef(false);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, includeVat]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/closing-meeting?tab=b2c-auto${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // Report available months to parent only once
        if (onMonthsAvailable && result.data.availableMonths && !hasReportedMonths.current) {
          hasReportedMonths.current = true;
          onMonthsAvailable(result.data.availableMonths, result.data.currentMonth);
        }
        // Expand all branches by default
        const allBranches = new Set<string>(result.data.branches.map((b: BranchData) => b.branch));
        setExpandedBranches(allBranches);
        const firstYear = result.data.yearlySummary?.[0]?.year;
        if (firstYear) setExpandedYears(new Set([firstYear]));
        setEditingTargets(new Map());
      }
    } catch (error) {
      console.error('Failed to fetch B2C analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString();
  };

  const handleTargetChange = (teamName: string, value: string) => {
    const numValue = parseFloat(value.replace(/,/g, '')) || 0;
    const newEditingTargets = new Map(editingTargets);
    newEditingTargets.set(teamName, numValue);
    setEditingTargets(newEditingTargets);
  };

  const getTargetValue = (teamName: string, defaultValue: number) => {
    return editingTargets.has(teamName) ? editingTargets.get(teamName)! : defaultValue;
  };

  const saveGoal = async (teamName: string) => {
    if (!data || !selectedMonth) return;
    
    const targetWeight = getTargetValue(teamName, 0);
    const [year, month] = selectedMonth.split('-');
    
    setIsSaving(teamName);
    try {
      const response = await apiFetch('/api/dashboard/closing-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          goal_type: 'b2c-auto',
          target_name: teamName,
          target_weight: targetWeight,
          target_amount: 0
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        // Update local data achievement rate
        const newData = { ...data };
        newData.branches = newData.branches.map(b => ({
          ...b,
          teams: b.teams.map(t => {
            if (t.team_name === teamName) {
              return {
                ...t,
                target_weight: targetWeight,
                achievement_rate: targetWeight > 0 ? (t.current_month_weight / targetWeight) * 100 : 0
              };
            }
            return t;
          })
        }));
        
        // Recalculate branch totals if team goal changed
        newData.branches = newData.branches.map(b => ({
          ...b,
          target_weight: b.teams.reduce((sum, t) => sum + t.target_weight, 0),
          achievement_rate: b.teams.reduce((sum, t) => sum + t.target_weight, 0) > 0 
            ? (b.current_month_weight / b.teams.reduce((sum, t) => sum + t.target_weight, 0)) * 100 
            : 0
        }));
        
        // Recalculate overall total if goal changed
        newData.total.target_weight = newData.branches.reduce((sum, b) => sum + b.target_weight, 0);
        newData.total.achievement_rate = newData.total.target_weight > 0
          ? (newData.total.current_month_weight / newData.total.target_weight) * 100
          : 0;

        setData(newData);
        const newEditingTargets = new Map(editingTargets);
        newEditingTargets.delete(teamName);
        setEditingTargets(newEditingTargets);
      } else {
        alert('목표 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save goal:', error);
      alert('오류가 발생했습니다.');
    } finally {
      setIsSaving(null);
    }
  };

  const toggleBranch = (branch: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branch)) {
      newExpanded.delete(branch);
    } else {
      newExpanded.add(branch);
    }
    setExpandedBranches(newExpanded);
  };

  const toggleTeam = (teamKey: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamKey)) {
      newExpanded.delete(teamKey);
    } else {
      newExpanded.add(teamKey);
    }
    setExpandedTeams(newExpanded);
  };

  const expandAll = () => {
    const allBranches = new Set(data?.branches.map((b: BranchData) => b.branch));
    setExpandedBranches(allBranches);
    
    const allTeams = new Set<string>();
    data?.branches.forEach(b => {
      b.teams.forEach(t => allTeams.add(`${b.branch}-${t.team_name}`));
    });
    setExpandedTeams(allTeams);
  };

  const collapseAll = () => {
    setExpandedBranches(new Set());
    setExpandedTeams(new Set());
  };

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Category Section
    exportData.push({ '지사': '--- 품목그룹별 B2C 분석 ---' });
    data.categories.forEach(cat => {
      exportData.push({
        '지사': '',
        '팀': '',
        '구분': cat.category,
        '당월중량(L)': cat.current_month_weight,
        '당월금액': cat.current_month_amount,
        '전월중량(L)': cat.last_month_weight,
        '전월대비증감(L)': cat.current_month_weight - cat.last_month_weight,
        '전년동월(L)': cat.yoy_weight,
        '전년대비(%)': (cat.yoy_growth_rate ?? 0).toFixed(1),
        '목표(L)': cat.target_weight,
        '달성율(%)': (cat.achievement_rate ?? 0).toFixed(1),
      });
    });

    if (data.monthlyCategoryBreakdown?.months?.length) {
      const m = data.monthlyCategoryBreakdown;
      exportData.push({ '지사': '' });
      exportData.push({ '지사': '--- 월별 품목그룹 B2C 판매 (L) ---' });
      const sumRow: Record<string, string | number> = {
        '지사': '',
        '팀': '',
        '구분': '합계',
      };
      m.rows.forEach((row) => {
        sumRow[row.category] = row.rowTotal;
      });
      sumRow['행계(L)'] = m.grandTotal;
      exportData.push(sumRow);
      m.months.forEach((mk) => {
        const monthRow: Record<string, string | number> = {
          '지사': '',
          '팀': '',
          '구분': `${parseInt(mk.split('-')[1]!, 10)}월`,
        };
        m.rows.forEach((row) => {
          monthRow[row.category] = row.byMonth[mk] ?? 0;
        });
        monthRow['행계(L)'] = m.monthTotals[mk] ?? 0;
        exportData.push(monthRow);
      });
    }

    exportData.push({ '지사': '' });
    exportData.push({ '지사': '--- 계층별 B2C 분석 ---' });

    data.branches.forEach(branch => {
      // Branch Row
      exportData.push({
        '지사': branch.branch,
        '팀': '',
        '구분': '지사합계',
        '당월중량(L)': branch.current_month_weight,
        '전월중량(L)': branch.last_month_weight,
        '전월대비증감(L)': branch.current_month_weight - branch.last_month_weight,
        '전년동월(L)': branch.yoy_weight,
        '전년대비(%)': (branch.yoy_growth_rate ?? 0).toFixed(1),
        '목표(L)': branch.target_weight,
        '달성율(%)': (branch.achievement_rate ?? 0).toFixed(1),
      });

      branch.teams.forEach(team => {
        // Team Row
        exportData.push({
          '지사': '',
          '팀': team.team_name,
          '구분': '팀합계',
          '당월중량(L)': team.current_month_weight,
          '전월중량(L)': team.last_month_weight,
          '전월대비증감(L)': team.current_month_weight - team.last_month_weight,
          '전년동월(L)': team.yoy_weight,
          '전년대비(%)': (team.yoy_growth_rate ?? 0).toFixed(1),
          '목표(L)': team.target_weight,
          '달성율(%)': (team.achievement_rate ?? 0).toFixed(1),
        });

        // Category Rows within Team
        team.categories.forEach(cat => {
          exportData.push({
            '지사': '',
            '팀': '',
            '구분': cat.category,
            '당월중량(L)': cat.current_month_weight,
            '전월중량(L)': cat.last_month_weight,
            '전월대비증감(L)': cat.current_month_weight - cat.last_month_weight,
            '전년동월(L)': cat.yoy_weight,
            '전년대비(%)': (cat.yoy_growth_rate ?? 0).toFixed(1),
            '목표(L)': '-',
            '달성율(%)': '-',
          });
        });
      });
    });

    // Total row
    exportData.push({
      '지사': '합계',
      '팀': '전체',
      '구분': '전체',
      '당월중량(L)': data.total.current_month_weight,
      '전월중량(L)': data.total.last_month_weight,
      '전월대비증감(L)': data.total.current_month_weight - data.total.last_month_weight,
      '전년동월(L)': data.total.yoy_weight,
      '전년대비(%)': (data.total.yoy_growth_rate ?? 0).toFixed(1),
      '목표(L)': data.total.target_weight,
      '달성율(%)': (data.total.achievement_rate ?? 0).toFixed(1),
    });

    const filename = generateFilename('마감회의_B2C_분석_계층별');
    exportToExcel(exportData, filename);
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

  const mcb = data.monthlyCategoryBreakdown;
  const monthlyBreakdownSection =
    mcb && mcb.months.length > 0 ? (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            월별 품목그룹 B2C 판매 (L)
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {mcb.year}년 1월~{parseInt(data.currentMonth.split('-')[1]!, 10)}월 누계 · 당월 기준 연도
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-50 dark:bg-zinc-800/50 z-10 border-r border-zinc-200 dark:border-zinc-800">
                  월
                </th>
                {mcb.rows.map((row) => (
                  <th
                    key={row.category}
                    className="text-right py-3 px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {row.category}
                  </th>
                ))}
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider whitespace-nowrap">
                  행계
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-blue-50/50 dark:bg-blue-950/25 font-semibold">
                <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100 sticky left-0 bg-blue-50/90 dark:bg-blue-950/40 border-r border-zinc-200 dark:border-zinc-800 z-10">
                  합계
                </td>
                {mcb.rows.map((row) => (
                  <td
                    key={`합계-${row.category}`}
                    className="py-3 px-3 text-right font-mono text-blue-900 dark:text-blue-100"
                  >
                    {formatNumber(row.rowTotal)}
                  </td>
                ))}
                <td className="py-3 px-4 text-right font-mono text-blue-800 dark:text-blue-200">
                  {formatNumber(mcb.grandTotal)}
                </td>
              </tr>
              {mcb.months.map((mk) => (
                <tr
                  key={mk}
                  className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                >
                  <td className="py-2.5 px-4 font-medium text-zinc-900 dark:text-zinc-100 sticky left-0 bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800/80 z-10">
                    {parseInt(mk.split('-')[1]!, 10)}월
                  </td>
                  {mcb.rows.map((row) => (
                    <td
                      key={`${mk}-${row.category}`}
                      className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300"
                    >
                      {formatNumber(row.byMonth[mk] ?? 0)}
                    </td>
                  ))}
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-blue-700 dark:text-blue-300">
                    {formatNumber(mcb.monthTotals[mk] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : null;

  if (data.yearlySummary && data.yearlySummary.length > 0 && data.yearlyCategoryBreakdown) {
    const displayMonth = parseInt(data.currentMonth.split('-')[1]);
    const cumulativePeriod = `1월~${displayMonth}월 누계`;
    const headerYear = data.yearlySummary[0]?.year || data.currentMonth.slice(0, 4);
    const headerPrevYear = String(Number(headerYear) - 1);
    const toggleYear = (year: string) => {
      const next = new Set(expandedYears);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      setExpandedYears(next);
    };
    const getYearDetails = (year: string) =>
      data.yearlyCategoryBreakdown?.find((y) => y.year === year)?.categories || [];

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">B2C 연도  ({cumulativePeriod})</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">연도</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{headerYear} 판매(L)</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{headerPrevYear} 판매(L)</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">달성율</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전년대비</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{headerYear} 구매(L)</th>
                </tr>
              </thead>
              <tbody>
                {data.yearlySummary.map((yearRow) => {
                  const yearDetails = getYearDetails(yearRow.year);
                  const autoCategories = yearDetails.filter((c) => c.category === 'PVL' || c.category === 'CVL');
                  const autoSummary = autoCategories.length > 0
                    ? autoCategories.reduce(
                        (acc, c) => ({
                          sales_weight: acc.sales_weight + (c.sales_weight || 0),
                          last_year_sales_weight: acc.last_year_sales_weight + (c.last_year_sales_weight || 0),
                          target_weight: acc.target_weight + (c.target_weight || 0),
                          b2b_sales_weight: acc.b2b_sales_weight + (c.b2b_total?.sales_weight || 0),
                          b2b_last_year_sales_weight: acc.b2b_last_year_sales_weight + (c.b2b_total?.last_year_sales_weight || 0),
                        }),
                        { sales_weight: 0, last_year_sales_weight: 0, target_weight: 0, b2b_sales_weight: 0, b2b_last_year_sales_weight: 0 }
                      )
                    : null;
                  const autoYoy = autoSummary && autoSummary.last_year_sales_weight > 0
                    ? ((autoSummary.sales_weight - autoSummary.last_year_sales_weight) / autoSummary.last_year_sales_weight) * 100
                    : 0;
                  const autoAchievement = autoSummary && autoSummary.target_weight > 0
                    ? (autoSummary.sales_weight / autoSummary.target_weight) * 100
                    : 0;

                  return (
                  <Fragment key={yearRow.year}>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800/60 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30" onClick={() => toggleYear(yearRow.year)}>
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                        <span className="inline-flex items-center gap-1">
                          {expandedYears.has(yearRow.year) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          {yearRow.year}년
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{formatNumber(yearRow.sales_weight)}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatNumber(yearRow.last_year_sales_weight)}</td>
                      <td className="py-3 px-4 text-right">{yearRow.achievement_rate.toFixed(1)}%</td>
                      <td className="py-3 px-4 text-right">{yearRow.yoy_growth_rate.toFixed(1)}%</td>
                      <td className="py-3 px-4 text-right font-mono">{formatNumber(yearRow.purchase_weight)}</td>
                    </tr>
                    {expandedYears.has(yearRow.year) && (
                      <tr className="bg-zinc-50/40 dark:bg-zinc-900/30">
                        <td colSpan={6} className="p-0">
                          <div className="py-2">
                            <table className="w-full text-xs table-fixed border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                              <colgroup>
                                <col className="w-[8%]" />
                                <col className="w-[10%]" />
                                <col className="w-[20%]" />
                                <col className="w-[20%]" />
                                <col className="w-[14%]" />
                                <col className="w-[14%]" />
                                <col className="w-[14%]" />
                              </colgroup>
                              <thead className="bg-zinc-100 dark:bg-zinc-800">
                                <tr>
                                  <th className="text-left py-2 px-3">제품품목</th>
                                  <th className="text-left py-2 px-3">사업소</th>
                                  <th className="text-right py-2 px-3">{headerYear} 판매(L)</th>
                                  <th className="text-right py-2 px-3">{headerPrevYear} 판매(L)</th>
                                  <th className="text-right py-2 px-3">달성율</th>
                                  <th className="text-right py-2 px-3">전년대비</th>
                                  <th className="text-right py-2 px-3"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {yearDetails.map((cat) => (
                                  <Fragment key={`${yearRow.year}_${cat.category}`}>
                                    {cat.category === 'PVL' && autoSummary && (
                                      <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-blue-50/60 dark:bg-blue-900/20">
                                        <td className="py-2 px-3 font-semibold text-blue-700 dark:text-blue-300">AUTO 합계</td>
                                        <td className="py-2 px-3">-</td>
                                        <td className="py-2 px-3 text-right font-mono font-semibold">{formatNumber(autoSummary.sales_weight)}</td>
                                        <td className="py-2 px-3 text-right font-mono font-semibold">{formatNumber(autoSummary.last_year_sales_weight)}</td>
                                        <td className={`py-2 px-3 text-right font-semibold ${autoAchievement >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                          {autoAchievement.toFixed(1)}%
                                        </td>
                                        <td className={`py-2 px-3 text-right font-semibold ${autoYoy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {autoYoy.toFixed(1)}%
                                        </td>
                                        <td className="py-2 px-3"></td>
                                      </tr>
                                    )}
                                    <tr className="border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-800/20">
                                      <td className="py-2 px-3 font-medium">{cat.category}</td>
                                      <td className="py-2 px-3">-</td>
                                      <td className="py-2 px-3 text-right font-mono">{formatNumber(cat.sales_weight)}</td>
                                      <td className="py-2 px-3 text-right font-mono">{formatNumber(cat.last_year_sales_weight)}</td>
                                      <td className="py-2 px-3 text-right">{(cat.achievement_rate ?? 0).toFixed(1)}%</td>
                                      <td className="py-2 px-3 text-right">{(cat.yoy_growth_rate ?? 0).toFixed(1)}%</td>
                                      <td className="py-2 px-3"></td>
                                    </tr>
                                    {cat.branches.map((branch) => (
                                      <Fragment key={`${yearRow.year}_${cat.category}_${branch.branch}`}>
                                        <tr
                                          className="border-b border-zinc-100/70 dark:border-zinc-800/40 cursor-pointer hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                                          onClick={() =>
                                            setTeamDrawer({
                                              isOpen: true,
                                              year: yearRow.year,
                                              category: cat.category,
                                              branch: branch.branch,
                                              teams: branch.teams,
                                            })
                                          }
                                        >
                                          <td className="py-1.5 px-3"></td>
                                          <td className="py-1.5 px-3 font-medium">
                                            <span className="inline-flex items-center gap-1">
                                              {branch.branch}
                                              <ChevronRight className="w-3 h-3 text-zinc-400" />
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono">{formatNumber(branch.sales_weight)}</td>
                                          <td className="py-1.5 px-3 text-right font-mono">{formatNumber(branch.last_year_sales_weight)}</td>
                                          <td className={`py-1.5 px-3 text-right font-medium ${(branch.achievement_rate ?? 0) >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                            {(branch.achievement_rate ?? 0).toFixed(1)}%
                                          </td>
                                          <td className={`py-1.5 px-3 text-right font-medium ${(branch.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {(branch.yoy_growth_rate ?? 0).toFixed(1)}%
                                          </td>
                                          <td className="py-1.5 px-3"></td>
                                        </tr>
                                      </Fragment>
                                    ))}
                                    <tr className="border-b border-zinc-100/70 dark:border-zinc-800/40 bg-zinc-50/70 dark:bg-zinc-800/30">
                                      <td className="py-1.5 px-3"></td>
                                      <td className="py-1.5 px-3 font-semibold text-zinc-700 dark:text-zinc-200">B2B</td>
                                      <td className="py-1.5 px-3 text-right font-mono">{formatNumber(cat.b2b_total?.sales_weight ?? 0)}</td>
                                      <td className="py-1.5 px-3 text-right font-mono">{formatNumber(cat.b2b_total?.last_year_sales_weight ?? 0)}</td>
                                      <td className="py-1.5 px-3 text-right">-</td>
                                      <td className={`py-1.5 px-3 text-right font-medium ${(cat.b2b_total?.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {(cat.b2b_total?.yoy_growth_rate ?? 0).toFixed(1)}%
                                      </td>
                                      <td className="py-1.5 px-3"></td>
                                    </tr>
                                  </Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )})}
              </tbody>
            </table>
          </div>
        </div>
        {monthlyBreakdownSection}
        {teamDrawer.isOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setTeamDrawer((prev) => ({ ...prev, isOpen: false }))} />
            <div className="fixed top-0 right-0 h-full w-full sm:w-[560px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {teamDrawer.year}년 {teamDrawer.category} / {teamDrawer.branch}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">팀별 상세</p>
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => setTeamDrawer((prev) => ({ ...prev, isOpen: false }))}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto h-[calc(100%-61px)]">
                <table className="w-full text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                  <thead className="bg-zinc-100 dark:bg-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3">팀</th>
                      <th className="text-right py-2 px-3">{teamDrawer.year} 판매(L)</th>
                      <th className="text-right py-2 px-3">{String(Number(teamDrawer.year) - 1)} 판매(L)</th>
                      <th className="text-right py-2 px-3">달성율</th>
                      <th className="text-right py-2 px-3">전년대비</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamDrawer.teams.map((team) => (
                      <tr key={`${teamDrawer.year}_${teamDrawer.category}_${teamDrawer.branch}_${team.team_name}`} className="border-b border-zinc-100 dark:border-zinc-800/50">
                        <td className="py-2 px-3">{team.team_name}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatNumber(team.sales_weight)}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatNumber(team.last_year_sales_weight)}</td>
                        <td className={`py-2 px-3 text-right font-medium ${(team.achievement_rate ?? 0) >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {(team.achievement_rate ?? 0).toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`inline-flex items-center gap-1 justify-end font-medium ${(team.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(team.yoy_growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {(team.yoy_growth_rate ?? 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">B2C 실적 요약</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 실적</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(data.total.current_month_weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {formatNumber(data.total.current_month_weight + data.b2bTotal.weight)} L 중 {((data.total.current_month_weight / (data.total.current_month_weight + data.b2bTotal.weight)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">목표 달성율</p>
              <p className={`text-2xl font-bold mt-1 ${data.total.achievement_rate >= 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                {(data.total.achievement_rate ?? 0).toFixed(1)}%
              </p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                목표: {formatNumber(data.total.target_weight)} L
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">전체 실적 합계</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전체 당월 중량</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatNumber(data.total.current_month_weight + data.b2bTotal.weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                연누계 {formatNumber(data.total.ytd_weight + data.b2bTotal.ytd_weight)} L 중 {((data.total.ytd_weight + data.b2bTotal.ytd_weight) > 0 ? ((data.total.current_month_weight + data.b2bTotal.weight) / (data.total.ytd_weight + data.b2bTotal.ytd_weight) * 100) : 0).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전체 당월 금액</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatNumber(data.total.current_month_amount + data.b2bTotal.amount)}</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                연누계 {formatNumber(data.total.ytd_amount + data.b2bTotal.ytd_amount)} 원 중 {((data.total.ytd_amount + data.b2bTotal.ytd_amount) > 0 ? ((data.total.current_month_amount + data.b2bTotal.amount) / (data.total.ytd_amount + data.b2bTotal.ytd_amount) * 100) : 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-zinc-50 to-slate-50 dark:from-zinc-950/20 dark:to-slate-950/20 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <Database className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">B2B 실적 (참조)</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">B2B 당월 중량</p>
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300 mt-1">{formatNumber(data.b2bTotal.weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {formatNumber(data.total.current_month_weight + data.b2bTotal.weight)} L 중 {((data.b2bTotal.weight / (data.total.current_month_weight + data.b2bTotal.weight)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">B2B 당월 금액</p>
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300 mt-1">{formatNumber(data.b2bTotal.amount)}</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {formatNumber(data.total.current_month_amount + data.b2bTotal.amount)} 원 중 {((data.b2bTotal.amount / (data.total.current_month_amount + data.b2bTotal.amount)) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">품목그룹별 B2C 분석 요약</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">품목그룹</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-500 uppercase tracking-wider">당월(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">당월금액</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전월(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전월대비</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전년동월(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전년대비</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">목표(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">달성율</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((cat) => {
                const momChange = cat.current_month_weight - cat.last_month_weight;
                const momChangeRate = cat.last_month_weight > 0 ? (momChange / cat.last_month_weight) * 100 : 0;
                return (
                  <tr key={cat.category} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">{cat.category}</td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">{formatNumber(cat.current_month_weight)}</td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{formatNumber(cat.current_month_amount)}</td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{formatNumber(cat.last_month_weight)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium text-xs ${momChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {momChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {momChange >= 0 ? '+' : ''}{momChangeRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{formatNumber(cat.yoy_weight)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${(cat.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(cat.yoy_growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {(cat.yoy_growth_rate ?? 0) >= 0 ? '+' : ''}{(cat.yoy_growth_rate ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{formatNumber(cat.target_weight)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${(cat.achievement_rate ?? 0) >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                        {(cat.achievement_rate ?? 0).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {monthlyBreakdownSection}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">지사/팀/품목별 B2C 상세 분석</h4>
          <div className="flex gap-2">
            <button onClick={expandAll} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">모두 펼치기</button>
            <button onClick={collapseAll} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">모두 접기</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32">지사</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32">팀/품목</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-500 uppercase tracking-wider">당월(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전월(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전월대비</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전년동월(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">전년대비</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">목표(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">달성율</th>
              </tr>
            </thead>
            <tbody>
              {data.branches.map((branch) => {
                const isBranchExpanded = expandedBranches.has(branch.branch);
                const branchMomChange = branch.current_month_weight - branch.last_month_weight;
                const branchMomChangeRate = branch.last_month_weight > 0 ? (branchMomChange / branch.last_month_weight) * 100 : 0;
                return (
                  <Fragment key={branch.branch}>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800/60 bg-blue-50/10 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer" onClick={() => toggleBranch(branch.branch)}>
                      <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          {isBranchExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                          {branch.branch}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-500 dark:text-zinc-400 text-xs">지사합계</td>
                      <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">{formatNumber(branch.current_month_weight)}</td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{formatNumber(branch.last_month_weight)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium text-xs ${branchMomChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {branchMomChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {branchMomChange >= 0 ? '+' : ''}{branchMomChangeRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{formatNumber(branch.yoy_weight)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium text-xs ${(branch.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(branch.yoy_growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {(branch.yoy_growth_rate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{formatNumber(branch.target_weight)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-bold ${(branch.achievement_rate ?? 0) >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {(branch.achievement_rate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                    </tr>

                    {isBranchExpanded && branch.teams.map((team) => {
                      const teamKey = `${branch.branch}-${team.team_name}`;
                      const isTeamExpanded = expandedTeams.has(teamKey);
                      const teamMomChange = team.current_month_weight - team.last_month_weight;
                      const teamMomChangeRate = team.last_month_weight > 0 ? (teamMomChange / team.last_month_weight) * 100 : 0;
                      const currentTargetValue = getTargetValue(team.team_name, team.target_weight);
                      const currentAchievementRate = currentTargetValue > 0 ? (team.current_month_weight / currentTargetValue) * 100 : 0;

                      return (
                        <Fragment key={teamKey}>
                          <tr className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleTeam(teamKey); }}>
                            <td className="py-2 px-4"></td>
                            <td className="py-2 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                              <div className="flex items-center gap-2 pl-4">
                                {isTeamExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                                {team.team_name}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-blue-600 dark:text-blue-400">{formatNumber(team.current_month_weight)}</td>
                            <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">{formatNumber(team.last_month_weight)}</td>
                            <td className="py-2 px-4 text-right">
                              <span className={`inline-flex items-center gap-1 text-xs ${teamMomChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {teamMomChange >= 0 ? '↑' : '↓'}{teamMomChangeRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">{formatNumber(team.yoy_weight)}</td>
                            <td className="py-2 px-4 text-right">
                              <span className={`inline-flex items-center gap-1 text-xs ${(team.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(team.yoy_growth_rate ?? 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="text"
                                  value={formatNumber(currentTargetValue)}
                                  onChange={(e) => handleTargetChange(team.team_name, e.target.value)}
                                  className="w-20 text-right font-mono bg-transparent border-b border-zinc-300 dark:border-zinc-600 px-1 pb-0.5 text-xs text-zinc-600 dark:text-zinc-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
                                />
                                {editingTargets.has(team.team_name) ? (
                                  <button onClick={() => saveGoal(team.team_name)} disabled={isSaving === team.team_name} className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                                    {isSaving === team.team_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 text-blue-500" />}
                                  </button>
                                ) : (
                                  <Pencil className="w-2.5 h-2.5 text-zinc-400" />
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-right">
                              <span className={`text-xs font-medium ${currentAchievementRate >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                {currentAchievementRate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>

                          {isTeamExpanded && team.categories.map((cat) => {
                            const catMomChange = cat.current_month_weight - cat.last_month_weight;
                            const catMomChangeRate = cat.last_month_weight > 0 ? (catMomChange / cat.last_month_weight) * 100 : 0;
                            return (
                              <tr key={`${teamKey}-${cat.category}`} className="border-b border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/20 text-xs">
                                <td className="py-1.5 px-4"></td>
                                <td className="py-1.5 px-4 pl-12 text-zinc-500 dark:text-zinc-400">{cat.category}</td>
                                <td className="py-1.5 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">{formatNumber(cat.current_month_weight)}</td>
                                <td className="py-1.5 px-4 text-right font-mono text-zinc-500 dark:text-zinc-500">{formatNumber(cat.last_month_weight)}</td>
                                <td className="py-1.5 px-4 text-right">
                                  <span className={`text-[10px] ${catMomChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>{catMomChangeRate.toFixed(1)}%</span>
                                </td>
                                <td className="py-1.5 px-4 text-right font-mono text-zinc-500 dark:text-zinc-500">{formatNumber(cat.yoy_weight)}</td>
                                <td className="py-1.5 px-4 text-right">
                                  <span className={`text-[10px] ${(cat.yoy_growth_rate ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{(cat.yoy_growth_rate ?? 0).toFixed(1)}%</span>
                                </td>
                                <td className="py-1.5 px-4 text-right text-zinc-400">-</td>
                                <td className="py-1.5 px-4 text-right text-zinc-400">-</td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}

              <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold border-t-2 border-blue-300 dark:border-blue-700">
                <td className="py-3 px-4 text-blue-900 dark:text-blue-100">전체 합계</td>
                <td className="py-3 px-4 text-blue-900 dark:text-blue-100">전체</td>
                <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300">{formatNumber(data.total.current_month_weight)}</td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">{formatNumber(data.total.last_month_weight)}</td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium text-xs ${(data.total.current_month_weight - (data.total.last_month_weight ?? 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(data.total.current_month_weight - (data.total.last_month_weight ?? 0)) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {(data.total.last_month_weight && data.total.last_month_weight !== 0) ? (((data.total.current_month_weight - data.total.last_month_weight) / data.total.last_month_weight * 100).toFixed(1)) : '0.0'}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">{formatNumber(data.total.yoy_weight)}</td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-bold ${(data.total.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(data.total.yoy_growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {(data.total.yoy_growth_rate ?? 0).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">{formatNumber(data.total.target_weight)}</td>
                <td className="py-3 px-4 text-right">
                  <span className={`font-bold ${(data.total.achievement_rate ?? 0) >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {(data.total.achievement_rate ?? 0).toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">B2C 상세 분석:</p>
        <p>B2C 사업부의 판매 실적을 <strong>지사 &gt; 팀 &gt; 품목그룹</strong> 순으로 상세 분석한 데이터입니다. 지사를 클릭하면 팀이 나타나며, 팀을 클릭하면 품목그룹별 상세 데이터를 확인할 수 있습니다.</p>
      </div>
    </div>
  );
}
