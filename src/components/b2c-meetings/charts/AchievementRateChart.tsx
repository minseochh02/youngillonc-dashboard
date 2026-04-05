"use client";

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDarkMode } from '@/hooks/useDarkMode';

interface AchievementRateChartProps {
  sortedBranches: string[];
  getDisplayName: (businessType: string, branch: string) => string;
  currentYearData: Map<string, { weight: number; amount: number; quantity: number }>;
  goalData: Map<string, { goal_weight: number; goal_amount: number }>;
}

export function AchievementRateChart({
  sortedBranches,
  getDisplayName,
  currentYearData,
  goalData,
}: AchievementRateChartProps) {
  const isDark = useDarkMode();

  const option = useMemo(() => {
    const branchNames = sortedBranches.map((key) => {
      const [businessType, branch] = key.split('-');
      return getDisplayName(businessType, branch);
    });

    // Calculate achievement rates for each branch
    const weightAchievementRates = sortedBranches.map((key) => {
      const actual = currentYearData.get(key)?.weight || 0;
      const goal = goalData.get(key)?.goal_weight || 0;
      return goal > 0 ? (actual / goal) * 100 : 0;
    });

    const amountAchievementRates = sortedBranches.map((key) => {
      const actual = currentYearData.get(key)?.amount || 0;
      const goal = goalData.get(key)?.goal_amount || 0;
      return goal > 0 ? (actual / goal) * 100 : 0;
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: isDark ? '#444' : '#ddd',
        textStyle: {
          color: isDark ? '#fff' : '#000',
        },
        formatter: (params: any) => {
          let result = `<div style="font-weight: bold; margin-bottom: 4px;">${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            const color = param.value >= 100 ? '#16a34a' : param.value >= 80 ? '#ca8a04' : '#dc2626';
            result += `<div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>${param.marker} ${param.seriesName}</span>
              <span style="font-weight: bold; color: ${color};">${param.value.toFixed(1)}%</span>
            </div>`;
          });
          return result;
        },
      },
      legend: {
        data: ['중량 달성율', '금액 달성율'],
        top: 0,
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
        data: branchNames,
        axisLabel: {
          color: isDark ? '#a1a1aa' : '#71717a',
          rotate: 30,
        },
        axisLine: {
          lineStyle: {
            color: isDark ? '#3f3f46' : '#e4e4e7',
          },
        },
      },
      yAxis: {
        type: 'value',
        name: '달성율 (%)',
        nameTextStyle: {
          color: isDark ? '#a1a1aa' : '#71717a',
        },
        axisLabel: {
          color: isDark ? '#a1a1aa' : '#71717a',
          formatter: '{value}%',
        },
        splitLine: {
          lineStyle: {
            color: isDark ? '#27272a' : '#f4f4f5',
          },
        },
        // Add reference lines at 80% and 100%
        splitNumber: 5,
      },
      series: [
        {
          name: '중량 달성율',
          type: 'bar',
          data: weightAchievementRates,
          itemStyle: {
            color: (params: any) => {
              const value = params.value;
              if (value >= 100) return '#16a34a'; // green-600
              if (value >= 80) return '#ca8a04'; // yellow-600
              return '#dc2626'; // red-600
            },
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            fontSize: 10,
            color: isDark ? '#fff' : '#000',
          },
        },
        {
          name: '금액 달성율',
          type: 'bar',
          data: amountAchievementRates,
          itemStyle: {
            color: (params: any) => {
              const value = params.value;
              if (value >= 100) return '#059669'; // emerald-600
              if (value >= 80) return '#d97706'; // amber-600
              return '#ef4444'; // red-500
            },
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            fontSize: 10,
            color: isDark ? '#fff' : '#000',
          },
        },
      ],
      // Add reference lines
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: {
          type: 'dashed',
          color: isDark ? '#52525b' : '#a1a1aa',
        },
        data: [
          {
            yAxis: 100,
            label: {
              formatter: '100% 목표',
              position: 'end',
              color: isDark ? '#71717a' : '#52525b',
            },
          },
          {
            yAxis: 80,
            label: {
              formatter: '80%',
              position: 'end',
              color: isDark ? '#71717a' : '#52525b',
            },
          },
        ],
      },
    };
  }, [sortedBranches, getDisplayName, currentYearData, goalData, isDark]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          사업소별 목표 달성율
        </h4>
      </div>
      <div className="p-6">
        <ReactECharts option={option} style={{ height: '400px' }} />
      </div>
    </div>
  );
}
