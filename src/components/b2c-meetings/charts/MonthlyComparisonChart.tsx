"use client";

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDarkMode } from '@/hooks/useDarkMode';

interface BusinessDataRow {
  branch: string;
  business_type: string;
  year: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
  goal_weight?: number;
  goal_amount?: number;
}

interface MonthlyComparisonChartProps {
  businessData: BusinessDataRow[];
  currentYear: string;
  lastYear: string;
  currentMonthNum: string;
  sortedBranches: string[];
  getDisplayName: (businessType: string, branch: string) => string;
  showGoals?: boolean;
}

export function MonthlyComparisonChart({
  businessData,
  currentYear,
  lastYear,
  currentMonthNum,
  sortedBranches,
  getDisplayName,
  showGoals = false,
}: MonthlyComparisonChartProps) {
  const isDark = useDarkMode();

  const option = useMemo(() => {
    const selectedMonthNum = parseInt(currentMonthNum);
    const months = Array.from({ length: selectedMonthNum }, (_, i) => `${i + 1}월`);

    // Prepare series for each branch (current year and last year)
    const series: any[] = [];

    sortedBranches.forEach((key) => {
      const [businessType, branch] = key.split('-');
      const branchName = getDisplayName(businessType, branch);

      // Current year data
      const currentYearData = months.map((_, i) => {
        const month = String(i + 1).padStart(2, '0');
        const yearMonth = `${currentYear}-${month}`;
        const row = businessData.find(
          (r) => r.year_month === yearMonth && `${r.business_type}-${r.branch}` === key
        );
        return Math.round(Number(row?.total_weight || 0));
      });

      // Last year data
      const lastYearData = months.map((_, i) => {
        const month = String(i + 1).padStart(2, '0');
        const yearMonth = `${lastYear}-${month}`;
        const row = businessData.find(
          (r) => r.year_month === yearMonth && `${r.business_type}-${r.branch}` === key
        );
        return Math.round(Number(row?.total_weight || 0));
      });

      series.push(
        {
          name: `${branchName} (${currentYear})`,
          type: 'bar',
          stack: currentYear,
          emphasis: {
            focus: 'series',
          },
          data: currentYearData,
        },
        {
          name: `${branchName} (${lastYear})`,
          type: 'bar',
          stack: lastYear,
          emphasis: {
            focus: 'series',
          },
          data: lastYearData,
        }
      );
    });

    // Add goal line if enabled
    if (showGoals) {
      // Calculate total monthly goals
      const monthlyGoals = months.map((_, i) => {
        const month = String(i + 1).padStart(2, '0');
        const yearMonth = `${currentYear}-${month}`;
        const totalGoal = businessData
          .filter((r) => r.year_month === yearMonth)
          .reduce((sum, r) => sum + Number(r.goal_weight || 0), 0);
        return Math.round(totalGoal);
      });

      // Only add goal line if there's any goal data
      if (monthlyGoals.some(g => g > 0)) {
        series.push({
          name: '목표',
          type: 'line',
          lineStyle: {
            type: 'dashed',
            width: 3,
            color: '#f59e0b', // amber-500
          },
          symbol: 'diamond',
          symbolSize: 8,
          itemStyle: {
            color: '#f59e0b',
          },
          emphasis: {
            focus: 'series',
          },
          data: monthlyGoals,
          z: 10, // Ensure line is on top
        });
      }
    }

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
            result += `<div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>${param.marker} ${param.seriesName}</span>
              <span style="font-weight: bold;">${Number(param.value).toLocaleString()} L</span>
            </div>`;
          });
          return result;
        },
      },
      legend: {
        data: series.map((s) => s.name),
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
        top: '80px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: months,
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
  }, [businessData, currentYear, lastYear, currentMonthNum, sortedBranches, getDisplayName, showGoals, isDark]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          월별 중량 비교 ({lastYear} vs {currentYear})
        </h4>
      </div>
      <div className="p-6">
        <ReactECharts option={option} style={{ height: '400px' }} />
      </div>
    </div>
  );
}
