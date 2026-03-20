"use client";

import { ChevronDown, ChevronRight } from 'lucide-react';
import QuarterlyTable from './QuarterlyTable';

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

interface CollapsibleSectionProps {
  section: Section;
  targets: Record<string, Record<string, number>>;
  onTargetChange: (category: string, quarter: string, value: number) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function CollapsibleSection({
  section,
  targets,
  onTargetChange,
  isExpanded,
  onToggle
}: CollapsibleSectionProps) {
  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString();
  };

  // Calculate summary stats
  const calculateSummary = () => {
    let totalActual = 0;
    let totalTarget = 0;
    let totalPreviousYear = 0;

    section.data.forEach(item => {
      item.quarters.forEach(q => {
        totalActual += q.actual;
        totalPreviousYear += q.previousYear;
        const target = targets[item.category]?.[q.quarter] || 0;
        totalTarget += target;
      });
    });

    const achievementRate = totalTarget > 0 ? (totalActual / totalTarget * 100) : 0;
    const yoyRate = totalPreviousYear > 0
      ? ((totalActual - totalPreviousYear) / totalPreviousYear * 100)
      : 0;

    return { totalActual, totalTarget, achievementRate, yoyRate };
  };

  const summary = !isExpanded ? calculateSummary() : null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      {/* Header - Clickable */}
      <div
        onClick={onToggle}
        className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            )}
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {section.title}
            </h4>
          </div>

          {/* Summary stats when collapsed */}
          {!isExpanded && summary && (
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">실적</span>
                <span className="font-semibold font-mono text-blue-700 dark:text-blue-300">
                  {formatNumber(summary.totalActual)} L
                </span>
              </div>
              {summary.totalTarget > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">달성율</span>
                  <span className={`font-bold ${
                    summary.achievementRate >= 100
                      ? 'text-green-600 dark:text-green-400'
                      : summary.achievementRate >= 80
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {summary.achievementRate.toFixed(1)}%
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전년대비</span>
                <span className={`font-semibold ${
                  summary.yoyRate > 0
                    ? 'text-green-600 dark:text-green-400'
                    : summary.yoyRate < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                  {summary.yoyRate > 0 ? '+' : ''}{summary.yoyRate.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <>
          {section.id === 'special-plus' ? (
            <div className="p-12 text-center">
              <p className="text-zinc-500 dark:text-zinc-400 text-lg">
                컨텐츠가 추가될 예정입니다
              </p>
            </div>
          ) : section.data.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                데이터가 없습니다
              </p>
            </div>
          ) : (
            <QuarterlyTable
              breakdown={section.data}
              targets={targets}
              onTargetChange={onTargetChange}
            />
          )}
        </>
      )}
    </div>
  );
}
