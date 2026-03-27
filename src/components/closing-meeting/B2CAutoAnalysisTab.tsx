"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, Database, ChevronDown, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
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

interface B2CAnalysisProps {
  selectedMonth?: string;
}

export default function B2CAutoAnalysisTab({ selectedMonth }: B2CAnalysisProps) {
  const [data, setData] = useState<B2CAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = `/api/dashboard/closing-meeting?tab=b2c-auto${selectedMonth ? `&month=${selectedMonth}` : ''}`;
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // Expand all branches by default
        const allBranches = new Set(result.data.branches.map((b: BranchData) => b.branch));
        setExpandedBranches(allBranches);
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* B2C Summary Card */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                B2C 실적 요약
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 실적</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {formatNumber(data.total.current_month_weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">목표 달성율</p>
              <p className={`text-2xl font-bold mt-1 ${
                (data.total.achievement_rate ?? 0) >= 100 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {(data.total.achievement_rate ?? 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* B2B Summary Card (Comparison) */}
        <div className="bg-gradient-to-r from-zinc-50 to-slate-50 dark:from-zinc-950/20 dark:to-slate-950/20 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <Database className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                B2B 실적 (참조)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentMonth} 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">B2B 당월 중량</p>
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300 mt-1">
                {formatNumber(data.b2bTotal.weight)} L
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">B2B 당월 금액</p>
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300 mt-1">
                {formatNumber(data.b2bTotal.amount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Analysis Table (Summary) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">품목그룹별 B2C 분석 요약</h4>
          <div className="flex gap-2">
            <ExcelDownloadButton onClick={handleExcelDownload} variant="secondary" />
          </div>
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
                const momChangeRate = cat.last_month_weight > 0
                  ? (momChange / cat.last_month_weight) * 100
                  : 0;

                return (
                  <tr
                    key={cat.category}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                      {cat.category}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                      {formatNumber(cat.current_month_weight)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(cat.current_month_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(cat.last_month_weight)}
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
                      {formatNumber(cat.yoy_weight)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        (cat.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(cat.yoy_growth_rate ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {(cat.yoy_growth_rate ?? 0) >= 0 ? '+' : ''}{(cat.yoy_growth_rate ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(cat.target_weight)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${
                        (cat.achievement_rate ?? 0) >= 100
                          ? 'text-green-600'
                          : (cat.achievement_rate ?? 0) >= 80
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
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

      {/* Hierarchical Analysis Table (Branch > Team > Category) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">지사/팀/품목별 B2C 상세 분석</h4>
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
                const branchMomChangeRate = branch.last_month_weight > 0
                  ? (branchMomChange / branch.last_month_weight) * 100
                  : 0;

                return (
                  <Fragment key={branch.branch}>
                    {/* Branch Row */}
                    <tr
                      className="border-b border-zinc-100 dark:border-zinc-800/60 bg-blue-50/10 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => toggleBranch(branch.branch)}
                    >
                      <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          {isBranchExpanded ? (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          )}
                          {branch.branch}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-500 dark:text-zinc-400 text-xs">
                        지사합계
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                        {formatNumber(branch.current_month_weight)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(branch.last_month_weight)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                          branchMomChange >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {branchMomChange >= 0 ? '+' : ''}{branchMomChangeRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(branch.yoy_weight)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                          (branch.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(branch.yoy_growth_rate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(branch.target_weight)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-bold ${
                          (branch.achievement_rate ?? 0) >= 100 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(branch.achievement_rate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                    </tr>

                    {/* Team Rows */}
                    {isBranchExpanded && branch.teams.map((team) => {
                      const teamKey = `${branch.branch}-${team.team_name}`;
                      const isTeamExpanded = expandedTeams.has(teamKey);
                      const teamMomChange = team.current_month_weight - team.last_month_weight;
                      const teamMomChangeRate = team.last_month_weight > 0
                        ? (teamMomChange / team.last_month_weight) * 100
                        : 0;

                      return (
                        <Fragment key={teamKey}>
                          <tr
                            className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTeam(teamKey);
                            }}
                          >
                            <td className="py-2 px-4"></td>
                            <td className="py-2 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                              <div className="flex items-center gap-2 pl-4">
                                {isTeamExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                                )}
                                {team.team_name}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-blue-600 dark:text-blue-400">
                              {formatNumber(team.current_month_weight)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
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
                            <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                              {formatNumber(team.yoy_weight)}
                            </td>
                            <td className="py-2 px-4 text-right">
                              <span className={`inline-flex items-center gap-1 text-xs ${
                                (team.yoy_growth_rate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {(team.yoy_growth_rate ?? 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                              {formatNumber(team.target_weight)}
                            </td>
                            <td className="py-2 px-4 text-right">
                              <span className={`text-xs font-medium ${
                                (team.achievement_rate ?? 0) >= 100 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {(team.achievement_rate ?? 0).toFixed(1)}%
                              </span>
                            </td>
                          </tr>

                          {/* Category (Product) Rows within Team */}
                          {isTeamExpanded && team.categories.map((cat) => {
                            const catMomChange = cat.current_month_weight - cat.last_month_weight;
                            const catMomChangeRate = cat.last_month_weight > 0
                              ? (catMomChange / cat.last_month_weight) * 100
                              : 0;

                            return (
                              <tr
                                key={`${teamKey}-${cat.category}`}
                                className="border-b border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/20 text-xs"
                              >
                                <td className="py-1.5 px-4"></td>
                                <td className="py-1.5 px-4 pl-12 text-zinc-500 dark:text-zinc-400">
                                  {cat.category}
                                </td>
                                <td className="py-1.5 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                                  {formatNumber(cat.current_month_weight)}
                                </td>
                                <td className="py-1.5 px-4 text-right font-mono text-zinc-500 dark:text-zinc-500">
                                  {formatNumber(cat.last_month_weight)}
                                </td>
                                <td className="py-1.5 px-4 text-right">
                                  <span className={`text-[10px] ${
                                    catMomChange >= 0 ? 'text-green-500' : 'text-red-500'
                                  }`}>
                                    {catMomChangeRate.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-1.5 px-4 text-right font-mono text-zinc-500 dark:text-zinc-500">
                                  {formatNumber(cat.yoy_weight)}
                                </td>
                                <td className="py-1.5 px-4 text-right">
                                  <span className={`text-[10px] ${
                                    (cat.yoy_growth_rate ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'
                                  }`}>
                                    {(cat.yoy_growth_rate ?? 0).toFixed(1)}%
                                  </span>
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

              {/* Total Row */}
              <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold border-t-2 border-blue-300 dark:border-blue-700">
                <td className="py-3 px-4 text-blue-900 dark:text-blue-100">전체 합계</td>
                <td className="py-3 px-4 text-blue-900 dark:text-blue-100">전체</td>
                <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300">
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
                  {formatNumber(data.total.target_weight)}
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">B2C 상세 분석:</p>
        <p>B2C 사업부의 판매 실적을 <strong>지사 &gt; 팀 &gt; 품목그룹</strong> 순으로 상세 분석한 데이터입니다. 지사를 클릭하면 팀이 나타나며, 팀을 클릭하면 품목그룹별 상세 데이터를 확인할 수 있습니다.</p>
      </div>
    </div>
  );
}
