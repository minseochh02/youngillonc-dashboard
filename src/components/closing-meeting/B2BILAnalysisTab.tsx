"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, Factory, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface TeamData {
  team_name: string;
  current_month_weight: number;
  last_month_weight: number;
  yoy_weight: number;
  yoy_growth_rate: number;
  target_weight: number;
  achievement_rate: number;
}

interface BranchILData {
  branch: string;
  current_month_weight: number;
  current_month_amount: number;
  last_month_weight: number;
  last_month_amount: number;
  yoy_weight: number;
  yoy_growth_rate: number;
  target_weight: number;
  achievement_rate: number;
  teams: TeamData[];
}

interface B2BILAnalysis {
  currentMonth: string;
  lastMonth: string;
  currentYear: string;
  lastYear: string;
  branches: BranchILData[];
  b2cIlTotal: {
    weight: number;
    amount: number;
  };
  total: {
    current_month_weight: number;
    current_month_amount: number;
    last_month_weight: number;
    last_month_amount: number;
    yoy_weight: number;
    yoy_growth_rate: number;
    target_weight: number;
    achievement_rate: number;
  };
}

interface B2BILAnalysisProps {
  selectedMonth?: string;
}

export default function B2BILAnalysisTab({ selectedMonth }: B2BILAnalysisProps) {
  const [data, setData] = useState<B2BILAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [editingTargets, setEditingTargets] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = `/api/dashboard/closing-meeting?tab=b2b-il${selectedMonth ? `&month=${selectedMonth}` : ''}`;
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // Expand all branches by default
        const allBranches = new Set(result.data.branches.map((b: BranchILData) => b.branch));
        setExpandedBranches(allBranches);
      }
    } catch (error) {
      console.error('Failed to fetch B2B IL analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "0";
    return num.toLocaleString();
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

  const expandAll = () => {
    const allBranches = new Set(data?.branches.map((b: BranchILData) => b.branch));
    setExpandedBranches(allBranches);
  };

  const collapseAll = () => {
    setExpandedBranches(new Set());
  };

  const handleTargetChange = (key: string, value: string) => {
    const numValue = parseFloat(value.replace(/,/g, '')) || 0;
    const newEditingTargets = new Map(editingTargets);
    newEditingTargets.set(key, numValue);
    setEditingTargets(newEditingTargets);
  };

  const getTargetValue = (key: string, defaultValue: number) => {
    return editingTargets.has(key) ? editingTargets.get(key)! : defaultValue;
  };

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    data.branches.forEach(branch => {
      // Add branch row
      exportData.push({
        '사업소': branch.branch,
        '구분': '합계',
        '당월중량(L)': branch.current_month_weight,
        '전월중량(L)': branch.last_month_weight,
        '전월대비증감(L)': branch.current_month_weight - (branch.last_month_weight ?? 0),
        '전년동월(L)': branch.yoy_weight,
        '전년대비(%)': (branch.yoy_growth_rate ?? 0).toFixed(1),
        '목표(L)': branch.target_weight,
        '달성율(%)': (branch.achievement_rate ?? 0).toFixed(1),
      });

      // Add team rows
      branch.teams.forEach(team => {
        exportData.push({
          '사업소': '',
          '구분': team.team_name,
          '당월중량(L)': team.current_month_weight,
          '전월중량(L)': team.last_month_weight,
          '전월대비증감(L)': team.current_month_weight - (team.last_month_weight ?? 0),
          '전년동월(L)': team.yoy_weight,
          '전년대비(%)': (team.yoy_growth_rate ?? 0).toFixed(1),
          '목표(L)': team.target_weight,
          '달성율(%)': (team.achievement_rate ?? 0).toFixed(1),
        });
      });
    });

    // Add total row
    exportData.push({
      '사업소': '합계',
      '구분': '전체',
      '당월중량(L)': data.total.current_month_weight,
      '전월중량(L)': data.total.last_month_weight,
      '전월대비증감(L)': data.total.current_month_weight - (data.total.last_month_weight ?? 0),
      '전년동월(L)': data.total.yoy_weight,
      '전년대비(%)': (data.total.yoy_growth_rate ?? 0).toFixed(1),
      '목표(L)': data.total.target_weight,
      '달성율(%)': (data.total.achievement_rate ?? 0).toFixed(1),
    });

    const filename = generateFilename('마감회의_B2B_IL분석');
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* B2B IL Summary Card */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
              <Factory className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                B2B IL 실적
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 실적</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {formatNumber(data.total.current_month_weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">판매 금액</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {formatNumber(data.total.current_month_amount)} 원
              </p>
            </div>
          </div>
        </div>

        {/* B2C IL Summary Card (Comparison) */}
        <div className="bg-gradient-to-r from-zinc-50 to-slate-50 dark:from-zinc-950/20 dark:to-slate-950/20 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <Factory className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                B2C IL 실적 (참조)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 실적</p>
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300 mt-1">
                {formatNumber(data.b2cIlTotal.weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">판매 금액</p>
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300 mt-1">
                {formatNumber(data.b2cIlTotal.amount)} 원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Analysis Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">사업소별 B2B IL 분석</h4>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            >
              모두 펼치기
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              모두 접기
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32">사업소</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32">구분</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-indigo-500 uppercase tracking-wider">당월(L)</th>
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
                const isExpanded = expandedBranches.has(branch.branch);
                const momChange = branch.current_month_weight - (branch.last_month_weight ?? 0);
                const momChangeRate = (branch.last_month_weight && branch.last_month_weight > 0)
                  ? (momChange / branch.last_month_weight) * 100
                  : 0;

                return (
                  <Fragment key={branch.branch}>
                    {/* Branch row */}
                    <tr
                      className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => toggleBranch(branch.branch)}
                    >
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          )}
                          {branch.branch}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                        합계
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-700 dark:text-indigo-300 font-semibold">
                        {formatNumber(branch.current_month_weight)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(branch.last_month_weight)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                          momChange >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {momChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {momChange >= 0 ? '+' : ''}{momChangeRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(branch.yoy_weight)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium ${
                          (branch.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(branch.yoy_growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {(branch.yoy_growth_rate ?? 0) >= 0 ? '+' : ''}{(branch.yoy_growth_rate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(
                          branch.teams.reduce((sum, team) =>
                            sum + getTargetValue(`team-${branch.branch}-${team.team_name}`, team.target_weight), 0
                          )
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-bold ${
                          (branch.achievement_rate ?? 0) >= 100
                            ? 'text-green-600'
                            : (branch.achievement_rate ?? 0) >= 80
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {(branch.achievement_rate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                    </tr>

                    {/* Team rows */}
                    {isExpanded && branch.teams.map((team) => {
                      const teamMomChange = team.current_month_weight - (team.last_month_weight ?? 0);
                      const teamMomChangeRate = (team.last_month_weight && team.last_month_weight > 0)
                        ? (teamMomChange / team.last_month_weight) * 100
                        : 0;

                      return (
                        <tr
                          key={`${branch.branch}-${team.team_name}`}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/20"
                        >
                          <td className="py-2 px-4"></td>
                          <td className="py-2 px-4 pl-8 text-zinc-700 dark:text-zinc-300 text-xs">
                            {team.team_name}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400 text-xs">
                            {formatNumber(team.current_month_weight)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                            {formatNumber(team.last_month_weight)}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 text-xs ${
                              teamMomChange >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {teamMomChange >= 0 ? '↑' : '↓'}
                              {teamMomChangeRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                            {formatNumber(team.yoy_weight)}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 text-xs ${
                              (team.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {(team.yoy_growth_rate ?? 0) >= 0 ? '↑' : '↓'}
                              {(team.yoy_growth_rate ?? 0) >= 0 ? '+' : ''}{(team.yoy_growth_rate ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                value={formatNumber(getTargetValue(`team-${branch.branch}-${team.team_name}`, team.target_weight))}
                                onChange={(e) => handleTargetChange(`team-${branch.branch}-${team.team_name}`, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 text-right font-mono bg-transparent border-b border-zinc-300 dark:border-zinc-600 px-1 pb-0.5 text-xs text-zinc-600 dark:text-zinc-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
                              />
                              <Pencil className="w-2.5 h-2.5 text-zinc-400" />
                            </div>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`text-xs font-medium ${
                              (team.achievement_rate ?? 0) >= 100
                                ? 'text-green-600'
                                : (team.achievement_rate ?? 0) >= 80
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                              {(team.achievement_rate ?? 0).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}

              {/* Total Row */}
              <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-bold border-t-2 border-indigo-300 dark:border-indigo-700">
                <td className="py-3 px-4 text-indigo-900 dark:text-indigo-100">합계</td>
                <td className="py-3 px-4 text-indigo-900 dark:text-indigo-100">전체</td>
                <td className="py-3 px-4 text-right font-mono text-indigo-700 dark:text-indigo-300">
                  {formatNumber(data.total.current_month_weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(data.total.last_month_weight)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                    (data.total.current_month_weight - (data.total.last_month_weight ?? 0)) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(data.total.current_month_weight - (data.total.last_month_weight ?? 0)) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {(data.total.last_month_weight && data.total.last_month_weight !== 0) 
                      ? (((data.total.current_month_weight - data.total.last_month_weight) / data.total.last_month_weight * 100).toFixed(1))
                      : '0.0'}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(data.total.yoy_weight)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    (data.total.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(data.total.yoy_growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {(data.total.yoy_growth_rate ?? 0).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(
                    data.branches.reduce((sum, branch) =>
                      sum + branch.teams.reduce((teamSum, team) =>
                        teamSum + getTargetValue(`team-${branch.branch}-${team.team_name}`, team.target_weight), 0
                      ), 0
                    )
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`font-bold ${
                    (data.total.achievement_rate ?? 0) >= 100
                      ? 'text-green-600'
                      : (data.total.achievement_rate ?? 0) >= 80
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}>
                    {(data.total.achievement_rate ?? 0).toFixed(1)}%
                  </span>
                </td>
              </tr>

              {/* B2C IL Comparison Row */}
              <tr className="bg-zinc-50/50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-700 italic text-zinc-500 dark:text-zinc-400">
                <td className="py-3 px-4 font-bold">참조 (B2C)</td>
                <td className="py-3 px-4 font-medium text-xs">B2C IL 합계</td>
                <td className="py-3 px-4 text-right font-mono text-xs">
                  {formatNumber(data.b2cIlTotal.weight)}
                </td>
                <td className="py-3 px-4 text-right font-mono">-</td>
                <td className="py-3 px-4 text-right">-</td>
                <td className="py-3 px-4 text-right font-mono">-</td>
                <td className="py-3 px-4 text-right">-</td>
                <td className="py-3 px-4 text-right font-mono">-</td>
                <td className="py-3 px-4 text-right">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">B2B IL 분석:</p>
        <p>B2B 사업부의 산업용 윤활유(Industrial Lubricants) 판매 실적을 사업소별, 팀별로 분석한 데이터입니다. 사업소를 클릭하면 팀별 상세 데이터를 확인할 수 있습니다.</p>
      </div>
    </div>
  );
}
