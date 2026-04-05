"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface QuarterData {
  quarter: string;
  actual: number;
  previousYear: number;
}

interface BreakdownItem {
  category: string;
  quarters: QuarterData[];
}

interface Section {
  id: string;
  title: string;
  data: BreakdownItem[];
}

interface ProductStatusData {
  sections: Section[];
  currentYear: number;
  lastYear: number;
}

interface TargetData {
  [year: string]: {
    [sectionId: string]: {
      [category: string]: {
        [quarter: string]: number;
      };
    };
  };
}

const STORAGE_KEY = 'product-status-targets';

interface ProductStatusTabProps {
  selectedMonth?: string;
}

type ViewMode = 'yoy' | 'goal';

export default function ProductStatusTab({ selectedMonth }: ProductStatusTabProps) {
  const [data, setData] = useState<ProductStatusData | null>(null);
  const [targets, setTargets] = useState<TargetData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('yoy');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    loadTargets();
  }, [selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const url = `/api/dashboard/product-status${selectedMonth ? `?month=${selectedMonth}` : ''}`;
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch product status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTargets = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setTargets(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load targets from localStorage:', error);
    }
  };

  const saveTarget = (sectionId: string, category: string, quarter: string, value: number) => {
    if (!data) return;

    const year = data.currentYear.toString();
    const newTargets = {
      ...targets,
      [year]: {
        ...targets[year],
        [sectionId]: {
          ...targets[year]?.[sectionId],
          [category]: {
            ...targets[year]?.[sectionId]?.[category],
            [quarter]: value
          }
        }
      }
    };

    setTargets(newTargets);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTargets));
    } catch (error) {
      console.error('Failed to save targets to localStorage:', error);
    }
  };

  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString();
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

  const YoYQuarterCell = ({
    current,
    last,
    accentClass = "text-zinc-900 dark:text-zinc-100",
    compact = false,
  }: {
    current: number;
    last: number;
    accentClass?: string;
    compact?: boolean;
  }) => (
    <div className={`flex flex-col items-end justify-center leading-tight ${compact ? 'gap-0' : 'gap-0.5'}`}>
      <span className={`font-mono font-semibold tabular-nums ${accentClass} ${compact ? 'text-xs' : 'text-sm'}`}>
        {formatNumber(current)}
      </span>
      <span className={`font-mono text-zinc-500 dark:text-zinc-400 tabular-nums ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        전년 {formatNumber(last)}
      </span>
    </div>
  );

  const GoalQuarterCell = ({
    current,
    goal,
    accentClass = "text-zinc-900 dark:text-zinc-100",
    compact = false,
  }: {
    current: number;
    goal: number;
    accentClass?: string;
    compact?: boolean;
  }) => (
    <div className={`flex flex-col items-end justify-center leading-tight ${compact ? 'gap-0' : 'gap-0.5'}`}>
      <span className={`font-mono font-semibold tabular-nums ${accentClass} ${compact ? 'text-xs' : 'text-sm'}`}>
        {formatNumber(current)}
      </span>
      <span className={`font-mono text-zinc-500 dark:text-zinc-400 tabular-nums ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        목표 {formatNumber(goal)}
      </span>
    </div>
  );

  const MetricRateSpan = ({
    percent,
    isPositive,
    compact = false,
  }: {
    percent: number;
    isPositive: boolean;
    compact?: boolean;
  }) => {
    const iconClass = compact ? 'h-2 w-2 shrink-0' : 'h-2.5 w-2.5 shrink-0';
    return (
      <span className={`inline-flex items-center justify-end gap-0.5 font-medium tabular-nums leading-none ${
        isPositive ? 'text-green-600' : 'text-red-600'
      } ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        {isPositive ? <TrendingUp className={iconClass} /> : <TrendingDown className={iconClass} />}
        {percent.toFixed(1)}%
      </span>
    );
  };

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    data.sections.forEach(section => {
      exportData.push({ '구분': section.title });

      if (section.id === 'special-plus' || section.data.length === 0) {
        exportData.push({ '구분': '데이터 없음' });
        exportData.push({});
        return;
      }

      section.data.forEach(item => {
        const row: any = { '구분': item.category };

        item.quarters.forEach(q => {
          const target = targets[data.currentYear]?.[section.id]?.[item.category]?.[q.quarter] || 0;
          const achievement = target > 0 ? (q.actual / target * 100) : 0;
          const yoy = q.previousYear > 0
            ? ((q.actual - q.previousYear) / q.previousYear * 100)
            : 0;

          row[`${q.quarter} 목표`] = target;
          row[`${q.quarter} 실적`] = Math.round(q.actual);
          row[`${q.quarter} 달성율(%)`] = target > 0 ? achievement.toFixed(1) : '-';
          row[`${q.quarter} 전년실적`] = Math.round(q.previousYear);
          row[`${q.quarter} 전년대비(%)`] = q.previousYear > 0 ? yoy.toFixed(1) : '-';
        });

        exportData.push(row);
      });

      exportData.push({});
    });

    const filename = generateFilename('제품별현황');
    exportToExcel(exportData, filename);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-zinc-400">
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

  // Calculate summary metrics
  const totalActual = data.sections.reduce((sum, section) => {
    return sum + section.data.reduce((sectionSum, item) => {
      return sectionSum + item.quarters.reduce((qSum, q) => qSum + q.actual, 0);
    }, 0);
  }, 0);

  const totalPrevious = data.sections.reduce((sum, section) => {
    return sum + section.data.reduce((sectionSum, item) => {
      return sectionSum + item.quarters.reduce((qSum, q) => qSum + q.previousYear, 0);
    }, 0);
  }, 0);

  const totalTargets = data.sections.reduce((sum, section) => {
    return sum + section.data.reduce((sectionSum, item) => {
      return sectionSum + item.quarters.reduce((qSum, q) => {
        const target = targets[data.currentYear]?.[section.id]?.[item.category]?.[q.quarter] || 0;
        return qSum + target;
      }, 0);
    }, 0);
  }, 0);

  const totalYoY = calculateChange(totalActual, totalPrevious);
  const totalAchievement = calculateAchievementRate(totalActual, totalTargets);

  const badgeActive = 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900';
  const badgeInactive = 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700';

  // Filter sections if one is selected
  const displaySections = selectedSection
    ? data.sections.filter(s => s.id === selectedSection)
    : data.sections;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Performance Card */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">총 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentYear}년 분기별 합계</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당해 실적</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totalActual)}</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년: {formatNumber(totalPrevious)}
              </p>
            </div>
          </div>
        </div>

        {/* YoY Performance Card */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              {totalYoY.isPositive ? (
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">전년 대비</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.currentYear} vs {data.lastYear}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">증감율</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${totalYoY.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {totalYoY.isPositive ? '+' : ''}{totalYoY.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                증가량: {formatNumber(totalActual - totalPrevious)}
              </p>
            </div>
          </div>
        </div>

        {/* Goal Achievement Card */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              {totalAchievement.isPositive ? (
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">목표 달성율</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">전체 목표 대비</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                달성율 {totalTargets > 0 ? '' : '(목표 미설정)'}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${totalAchievement.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {totalTargets > 0 ? `${totalAchievement.percent.toFixed(1)}%` : '-'}
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                목표: {formatNumber(totalTargets)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
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

        <div className="hidden sm:block h-5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" aria-hidden />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">섹션</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedSection(null)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedSection === null ? badgeActive : badgeInactive
              }`}
            >
              전체
            </button>
            {data.sections.map(section => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSection(section.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors max-w-[10rem] truncate ${
                  selectedSection === section.id ? badgeActive : badgeInactive
                }`}
                title={section.title}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto">
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={!data || isLoading} />
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          💡 <strong>목표</strong> 열에서 값을 클릭하여 분기별 목표를 입력하세요. 입력한 값은 브라우저에 자동 저장됩니다.
        </p>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            제품별 현황 상세
            <span className="block text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
              {data.currentYear}년 분기별 실적 ({data.lastYear}년 대비)
            </span>
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800/50">
                  구분
                </th>
                <th className="text-right py-3 px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">1분기 목표</th>
                <th className="text-right py-3 px-3 text-xs font-bold text-blue-600 uppercase tracking-wider">
                  1분기 {viewMode === 'yoy' ? '비교' : '실적/목표'}
                </th>
                <th className="text-right py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {viewMode === 'yoy' ? '증감율' : '달성율'}
                </th>
                <th className="text-right py-3 px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">2분기 목표</th>
                <th className="text-right py-3 px-3 text-xs font-bold text-blue-600 uppercase tracking-wider">
                  2분기 {viewMode === 'yoy' ? '비교' : '실적/목표'}
                </th>
                <th className="text-right py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {viewMode === 'yoy' ? '증감율' : '달성율'}
                </th>
                <th className="text-right py-3 px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">3분기 목표</th>
                <th className="text-right py-3 px-3 text-xs font-bold text-blue-600 uppercase tracking-wider">
                  3분기 {viewMode === 'yoy' ? '비교' : '실적/목표'}
                </th>
                <th className="text-right py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {viewMode === 'yoy' ? '증감율' : '달성율'}
                </th>
                <th className="text-right py-3 px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">4분기 목표</th>
                <th className="text-right py-3 px-3 text-xs font-bold text-blue-600 uppercase tracking-wider">
                  4분기 {viewMode === 'yoy' ? '비교' : '실적/목표'}
                </th>
                <th className="text-right py-3 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {viewMode === 'yoy' ? '증감율' : '달성율'}
                </th>
              </tr>
            </thead>
            <tbody>
              {displaySections.map((section, sectionIdx) => (
                <Fragment key={section.id}>
                  {/* Section Header */}
                  <tr className="bg-zinc-100 dark:bg-zinc-800 border-t-2 border-zinc-300 dark:border-zinc-700">
                    <td colSpan={13} className="py-2.5 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                      {section.title}
                    </td>
                  </tr>

                  {/* Section Data */}
                  {section.data.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-4 px-4 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                        데이터 없음
                      </td>
                    </tr>
                  ) : (
                    section.data.map((item, itemIdx) => (
                      <tr
                        key={`${section.id}-${item.category}`}
                        className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100 sticky left-0 z-[1] bg-white dark:bg-zinc-900">
                          {item.category}
                        </td>

                        {item.quarters.map((q) => {
                          const target = targets[data.currentYear]?.[section.id]?.[item.category]?.[q.quarter] || 0;
                          const achievement = calculateAchievementRate(q.actual, target);
                          const yoyChange = calculateChange(q.actual, q.previousYear);
                          const metric = viewMode === 'yoy' ? yoyChange : achievement;

                          return (
                            <Fragment key={q.quarter}>
                              {/* Target Input */}
                              <td className="py-2 px-3 text-right align-middle">
                                <input
                                  type="number"
                                  value={target || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    saveTarget(section.id, item.category, q.quarter, val);
                                  }}
                                  placeholder="목표"
                                  className="w-full max-w-[80px] px-2 py-1 text-xs text-right rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </td>

                              {/* Actual vs Previous/Goal */}
                              <td className="py-2 px-3 text-right align-middle">
                                {viewMode === 'yoy' ? (
                                  <YoYQuarterCell
                                    current={q.actual}
                                    last={q.previousYear}
                                    accentClass="text-blue-700 dark:text-blue-300"
                                    compact
                                  />
                                ) : (
                                  <GoalQuarterCell
                                    current={q.actual}
                                    goal={target}
                                    accentClass="text-blue-700 dark:text-blue-300"
                                    compact
                                  />
                                )}
                              </td>

                              {/* Change/Achievement Rate */}
                              <td className="py-2 px-2 text-right align-middle">
                                <MetricRateSpan
                                  percent={Math.abs(metric.percent)}
                                  isPositive={metric.isPositive}
                                  compact
                                />
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
