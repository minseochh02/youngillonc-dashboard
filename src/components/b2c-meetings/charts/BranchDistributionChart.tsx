"use client";

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDarkMode } from '@/hooks/useDarkMode';

interface BranchDistributionChartProps {
  sortedBranches: string[];
  getDisplayName: (businessType: string, branch: string) => string;
  currentYearData: Map<string, { weight: number; amount: number; quantity: number }>;
  totalCurrentWeight: number;
}

export function BranchDistributionChart({
  sortedBranches,
  getDisplayName,
  currentYearData,
  totalCurrentWeight,
}: BranchDistributionChartProps) {
  const isDark = useDarkMode();

  const option = useMemo(() => {
    const data = sortedBranches.map((key) => {
      const [businessType, branch] = key.split('-');
      const branchData = currentYearData.get(key) || { weight: 0, amount: 0, quantity: 0 };
      const percentage = totalCurrentWeight > 0 ? (branchData.weight / totalCurrentWeight) * 100 : 0;

      return {
        name: getDisplayName(businessType, branch),
        value: branchData.weight,
        percentage: percentage.toFixed(1),
      };
    });

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: isDark ? '#444' : '#ddd',
        textStyle: {
          color: isDark ? '#fff' : '#000',
        },
        formatter: (params: any) => {
          return `<div>
            <div style="font-weight: bold; margin-bottom: 4px;">${params.name}</div>
            <div>중량: <span style="font-weight: bold;">${Number(params.value).toLocaleString()} L</span></div>
            <div>비율: <span style="font-weight: bold;">${params.data.percentage}%</span></div>
          </div>`;
        },
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'center',
        textStyle: {
          color: isDark ? '#a1a1aa' : '#71717a',
        },
        formatter: (name: string) => {
          const item = data.find((d) => d.name === name);
          return `${name} (${item?.percentage || 0}%)`;
        },
      },
      series: [
        {
          name: '사업소별 분포',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: isDark ? '#18181b' : '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
              color: isDark ? '#fff' : '#000',
              formatter: (params: any) => {
                return `{name|${params.name}}\n{value|${Number(params.value).toLocaleString()} L}\n{percent|${params.data.percentage}%}`;
              },
              rich: {
                name: {
                  fontSize: 14,
                  fontWeight: 'bold',
                  lineHeight: 22,
                },
                value: {
                  fontSize: 16,
                  fontWeight: 'bold',
                  lineHeight: 24,
                },
                percent: {
                  fontSize: 12,
                  color: isDark ? '#a1a1aa' : '#71717a',
                  lineHeight: 20,
                },
              },
            },
          },
          labelLine: {
            show: false,
          },
          data,
        },
      ],
    };
  }, [sortedBranches, getDisplayName, currentYearData, totalCurrentWeight, isDark]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          사업소별 중량 비율 분포
        </h4>
      </div>
      <div className="p-6">
        <ReactECharts option={option} style={{ height: '400px' }} />
      </div>
    </div>
  );
}
