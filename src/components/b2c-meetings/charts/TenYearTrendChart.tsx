"use client";

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDarkMode } from '@/hooks/useDarkMode';

interface TenYearTrendChartProps {
  yearColumns: string[];
  sortedBranches: string[];
  getDisplayName: (businessType: string, branch: string) => string;
  aggregateByYear: (year: string, upToMonth: string) => Map<string, { weight: number; amount: number; quantity: number }>;
  aggregateGoalByYear?: (year: string, upToMonth: string) => Map<string, { goal_weight: number; goal_amount: number }>;
  currentMonthNum: string;
  showGoals?: boolean;
}

export function TenYearTrendChart({
  yearColumns,
  sortedBranches,
  getDisplayName,
  aggregateByYear,
  aggregateGoalByYear,
  currentMonthNum,
  showGoals = false,
}: TenYearTrendChartProps) {
  const isDark = useDarkMode();

  const option = useMemo(() => {
    // Prepare series data for each branch (actual data)
    const series = sortedBranches.map((key) => {
      const [businessType, branch] = key.split('-');
      const data = yearColumns.map((year) => {
        const cap = `${year}-${currentMonthNum}`;
        const agg = aggregateByYear(year, cap);
        return agg.get(key)?.weight ?? 0;
      });

      return {
        name: getDisplayName(businessType, branch),
        type: 'line',
        smooth: true,
        emphasis: {
          focus: 'series',
        },
        areaStyle: {
          opacity: 0.3,
        },
        data,
      };
    });

    // Add goal lines if enabled
    if (showGoals && aggregateGoalByYear) {
      sortedBranches.forEach((key) => {
        const [businessType, branch] = key.split('-');
        const goalData = yearColumns.map((year) => {
          const cap = `${year}-${currentMonthNum}`;
          const agg = aggregateGoalByYear(year, cap);
          return agg.get(key)?.goal_weight ?? 0;
        });

        // Only add goal line if there's any goal data
        if (goalData.some(g => g > 0)) {
          series.push({
            name: `${getDisplayName(businessType, branch)} (목표)`,
            type: 'line',
            smooth: true,
            lineStyle: {
              type: 'dashed',
              width: 2,
            },
            symbol: 'circle',
            symbolSize: 6,
            emphasis: {
              focus: 'series',
            },
            data: goalData,
          });
        }
      });
    }

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: isDark ? '#444' : '#ddd',
        textStyle: {
          color: isDark ? '#fff' : '#000',
        },
        formatter: (params: any) => {
          let result = `<div style="font-weight: bold; margin-bottom: 4px;">${params[0].axisValue}년</div>`;
          params.forEach((param: any) => {
            result += `<div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>${param.marker} ${param.seriesName}</span>
              <span style="font-weight: bold;">${Number(param.value).toLocaleString()} L</span>
            </div>`;
          });
          return result;
        },
      },
      legend: {
        data: series.map(s => s.name),
        top: 0,
        type: 'scroll',
        textStyle: {
          color: isDark ? '#a1a1aa' : '#71717a',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '50px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: yearColumns,
        axisLabel: {
          color: isDark ? '#a1a1aa' : '#71717a',
        },
        axisLine: {
          lineStyle: {
            color: isDark ? '#3f3f46' : '#e4e4e7',
          },
        },
      },
      yAxis: {
        type: 'value',
        name: '중량 (L)',
        nameTextStyle: {
          color: isDark ? '#a1a1aa' : '#71717a',
        },
        axisLabel: {
          color: isDark ? '#a1a1aa' : '#71717a',
          formatter: (value: number) => value.toLocaleString(),
        },
        splitLine: {
          lineStyle: {
            color: isDark ? '#27272a' : '#f4f4f5',
          },
        },
      },
      series,
    };
  }, [yearColumns, sortedBranches, getDisplayName, aggregateByYear, aggregateGoalByYear, currentMonthNum, showGoals, isDark]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          10개년 사업소별 중량 추이 ({yearColumns[0]}~{yearColumns[yearColumns.length - 1]}년)
        </h4>
      </div>
      <div className="p-6">
        <ReactECharts option={option} style={{ height: '400px' }} />
      </div>
    </div>
  );
}
