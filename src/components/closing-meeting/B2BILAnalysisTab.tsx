"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, Factory, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface ProductData {
  product_name: string;
  current_month_weight: number;
  last_month_weight: number;
  yoy_weight: number;
  yoy_growth_rate: number;
  target_weight: number;
  achievement_rate: number;
}

interface TeamILData {
  team_name: string;
  current_month_weight: number;
  current_month_amount: number;
  last_month_weight: number;
  last_month_amount: number;
  yoy_weight: number;
  yoy_growth_rate: number;
  target_weight: number;
  achievement_rate: number;
  products: ProductData[];
}

interface B2BILAnalysis {
  currentMonth: string;
  lastMonth: string;
  currentYear: string;
  lastYear: string;
  teams: TeamILData[];
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

export default function B2BILAnalysisTab() {
  const [data, setData] = useState<B2BILAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [editingTargets, setEditingTargets] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/closing-meeting?tab=b2b-il`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch B2B IL analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const toggleTeam = (team: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(team)) {
      newExpanded.delete(team);
    } else {
      newExpanded.add(team);
    }
    setExpandedTeams(newExpanded);
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

    data.teams.forEach(team => {
      // Add team row
      exportData.push({
        '팀': team.team_name,
        '구분': '합계',
        '당월중량(L)': team.current_month_weight,
        '전월중량(L)': team.last_month_weight,
        '전월대비증감(L)': team.current_month_weight - team.last_month_weight,
        '전년동월(L)': team.yoy_weight,
        '전년대비(%)': team.yoy_growth_rate.toFixed(1),
        '목표(L)': team.target_weight,
        '달성율(%)': team.achievement_rate.toFixed(1),
      });

      // Add product rows
      team.products.forEach(product => {
        exportData.push({
          '팀': '',
          '구분': product.product_name,
          '당월중량(L)': product.current_month_weight,
          '전월중량(L)': product.last_month_weight,
          '전월대비증감(L)': product.current_month_weight - product.last_month_weight,
          '전년동월(L)': product.yoy_weight,
          '전년대비(%)': product.yoy_growth_rate.toFixed(1),
          '목표(L)': product.target_weight,
          '달성율(%)': product.achievement_rate.toFixed(1),
        });
      });
    });

    // Add total row
    exportData.push({
      '팀': '합계',
      '구분': '전체',
      '당월중량(L)': data.total.current_month_weight,
      '전월중량(L)': data.total.last_month_weight,
      '전월대비증감(L)': data.total.current_month_weight - data.total.last_month_weight,
      '전년동월(L)': data.total.yoy_weight,
      '전년대비(%)': data.total.yoy_growth_rate.toFixed(1),
      '목표(L)': data.total.target_weight,
      '달성율(%)': data.total.achievement_rate.toFixed(1),
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
      {/* Header with Download Button */}
      <div className="flex justify-end">
        <ExcelDownloadButton onClick={handleExcelDownload} disabled={!data || isLoading} />
      </div>

      {/* Overall Summary Card */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <Factory className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  B2B IL 전체 실적
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{data.currentMonth}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {formatNumber(data.total.current_month_weight)} L
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">목표</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  {formatNumber(data.total.target_weight)} L
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">달성율</p>
                <p className={`text-2xl font-bold mt-1 ${
                  data.total.achievement_rate >= 100 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {data.total.achievement_rate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전년대비</p>
                <p className={`text-2xl font-bold mt-1 ${
                  data.total.yoy_growth_rate >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.total.yoy_growth_rate >= 0 ? '+' : ''}{data.total.yoy_growth_rate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Analysis Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">팀별 B2B IL 분석</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider w-32">팀</th>
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
              {data.teams.map((team) => {
                const isExpanded = expandedTeams.has(team.team_name);
                const momChange = team.current_month_weight - team.last_month_weight;
                const momChangeRate = team.last_month_weight > 0
                  ? (momChange / team.last_month_weight) * 100
                  : 0;

                return (
                  <>
                    {/* Team row */}
                    <tr
                      key={team.team_name}
                      className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => toggleTeam(team.team_name)}
                    >
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          )}
                          {team.team_name}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                        합계
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-700 dark:text-indigo-300 font-semibold">
                        {formatNumber(team.current_month_weight)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(team.last_month_weight)}
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
                        {formatNumber(team.yoy_weight)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium ${
                          team.yoy_growth_rate >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {team.yoy_growth_rate >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {team.yoy_growth_rate >= 0 ? '+' : ''}{team.yoy_growth_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {formatNumber(
                          team.products.reduce((sum, product) =>
                            sum + getTargetValue(`product-${team.team_name}-${product.product_name}`, product.target_weight), 0
                          )
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-bold ${
                          team.achievement_rate >= 100
                            ? 'text-green-600'
                            : team.achievement_rate >= 80
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {team.achievement_rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>

                    {/* Product rows */}
                    {isExpanded && team.products.map((product) => {
                      const productMomChange = product.current_month_weight - product.last_month_weight;
                      const productMomChangeRate = product.last_month_weight > 0
                        ? (productMomChange / product.last_month_weight) * 100
                        : 0;

                      return (
                        <tr
                          key={`${team.team_name}-${product.product_name}`}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/20"
                        >
                          <td className="py-2 px-4"></td>
                          <td className="py-2 px-4 pl-8 text-zinc-700 dark:text-zinc-300 text-xs">
                            {product.product_name}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400 text-xs">
                            {formatNumber(product.current_month_weight)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                            {formatNumber(product.last_month_weight)}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 text-xs ${
                              productMomChange >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {productMomChange >= 0 ? '↑' : '↓'}
                              {productMomChangeRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                            {formatNumber(product.yoy_weight)}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 text-xs ${
                              product.yoy_growth_rate >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {product.yoy_growth_rate >= 0 ? '↑' : '↓'}
                              {product.yoy_growth_rate >= 0 ? '+' : ''}{product.yoy_growth_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="text"
                                value={formatNumber(getTargetValue(`product-${team.team_name}-${product.product_name}`, product.target_weight))}
                                onChange={(e) => handleTargetChange(`product-${team.team_name}-${product.product_name}`, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 text-right font-mono bg-transparent border-b border-zinc-300 dark:border-zinc-600 px-1 pb-0.5 text-xs text-zinc-600 dark:text-zinc-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
                              />
                              <Pencil className="w-2.5 h-2.5 text-zinc-400" />
                            </div>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`text-xs font-medium ${
                              product.achievement_rate >= 100
                                ? 'text-green-600'
                                : product.achievement_rate >= 80
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                              {product.achievement_rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </>
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
                    (data.total.current_month_weight - data.total.last_month_weight) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(data.total.current_month_weight - data.total.last_month_weight) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {((data.total.current_month_weight - data.total.last_month_weight) / data.total.last_month_weight * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(data.total.yoy_weight)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    data.total.yoy_growth_rate >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {data.total.yoy_growth_rate >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {data.total.yoy_growth_rate >= 0 ? '+' : ''}{data.total.yoy_growth_rate.toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {formatNumber(
                    data.teams.reduce((sum, team) =>
                      sum + team.products.reduce((productSum, product) =>
                        productSum + getTargetValue(`product-${team.team_name}-${product.product_name}`, product.target_weight), 0
                      ), 0
                    )
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`font-bold ${
                    data.total.achievement_rate >= 100
                      ? 'text-green-600'
                      : data.total.achievement_rate >= 80
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}>
                    {data.total.achievement_rate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">B2B IL 분석:</p>
        <p>B2B 사업부의 산업용 윤활유(Industrial Lubricants) 팀별 판매 실적 분석 데이터입니다. 팀을 클릭하면 제품별 상세 데이터를 확인할 수 있습니다.</p>
      </div>
    </div>
  );
}
