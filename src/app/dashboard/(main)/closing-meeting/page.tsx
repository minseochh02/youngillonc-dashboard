"use client";

import { useState, useEffect } from 'react';
import MonthlySummaryTab from '@/components/closing-meeting/MonthlySummaryTab';
import B2CAutoAnalysisTab from '@/components/closing-meeting/B2CAutoAnalysisTab';
import B2BILAnalysisTab from '@/components/closing-meeting/B2BILAnalysisTab';
import TargetAchievementTab from '@/components/closing-meeting/TargetAchievementTab';
import YearOverYearTab from '@/components/closing-meeting/YearOverYearTab';
import BranchPerformanceTab from '@/components/closing-meeting/BranchPerformanceTab';
import GoalSettingTab from '@/components/closing-meeting/GoalSettingTab';
import { apiFetch } from '@/lib/api';
import { Calendar, Loader2 } from 'lucide-react';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { generateFilename, type IslandTable, type IslandSheetData } from '@/lib/excel-export';

const tabs = [
  { id: 'monthly-summary', label: '월간총괄' },
  { id: 'b2c-auto', label: 'B2C 분석' },
  { id: 'b2b-il', label: 'B2B 분석' },
  { id: 'target-achievement', label: '목표 달성율' },
  { id: 'yoy-comparison', label: '전년 대비' },
  { id: 'branch-performance', label: '사업소별 실적' },
  { id: 'goal-setting', label: '목표 설정' },
];

export default function ClosingMeetingPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Initial fetch to get available months
    const fetchInitialData = async () => {
      try {
        const response = await apiFetch(`/api/dashboard/closing-meeting?tab=monthly-summary`);
        const result = await response.json();
        if (result.success && result.data.availableMonths) {
          setAvailableMonths(result.data.availableMonths);
          // Set to latest month by default
          setSelectedMonth(result.data.availableMonths[result.data.availableMonths.length - 1]);
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };
    fetchInitialData();
  }, []);

  const handleExcelDownload = async () => {
    if (!selectedMonth) return;
    
    setIsExporting(true);
    try {
      const sheets: IslandSheetData[] = [];
      
      const exportTabs = [
        { id: 'monthly-summary', name: '월간총괄' },
        { id: 'b2c-auto', name: 'B2C분석' },
        { id: 'b2b-il', name: 'B2B_IL분석' },
        { id: 'target-achievement', name: '목표달성율' },
        { id: 'yoy-comparison', name: '전년대비비교' },
        { id: 'branch-performance', name: '사업소별실적' },
      ];

      const results = await Promise.all(
        exportTabs.map(async (tab) => {
          const response = await apiFetch(`/api/dashboard/closing-meeting?tab=${tab.id}&month=${selectedMonth}`);
          const result = await response.json();
          return { id: tab.id, name: tab.name, data: result.success ? result.data : null };
        })
      );

      for (const res of results) {
        if (!res.data) continue;
        const islands: IslandTable[] = [];

        if (res.id === 'monthly-summary') {
          const { monthlyData, yearToDate } = res.data;
          const monthlyIslands: any[] = [];
          
          // 1. Summary Table
          islands.push({
            title: '월별 총괄 실적 요약 (L)',
            headers: ['월', '매입중량', '매출중량', '재고변동', '목표중량', '달성율(%)', '전년비성장(%)'],
            data: [
              ['연누계', yearToDate.purchase_weight, yearToDate.sales_weight, yearToDate.inventory_weight, yearToDate.target_weight, yearToDate.achievement_rate.toFixed(1), '-'],
              ...monthlyData.map((r: any) => [
                r.month, r.purchase_weight, r.sales_weight, r.inventory_weight, r.target_weight, 
                r.achievement_rate.toFixed(1), r.yoy_growth_rate.toFixed(1)
              ])
            ]
          });

          // 2. Category Breakdown for current month
          const currentMonth = monthlyData.find((m: any) => m.month === selectedMonth);
          if (currentMonth) {
            islands.push({
              title: `${selectedMonth} 카테고리별 세부 실적`,
              headers: ['카테고리', '매입중량', '매출중량', '재고변동', '목표중량', '달성율(%)'],
              data: currentMonth.breakdown.map((c: any) => [
                c.category, c.purchase_weight, c.sales_weight, c.inventory_weight, c.target_weight, c.achievement_rate.toFixed(1)
              ])
            });
          }
        } else if (res.id === 'b2c-auto') {
          const { categories, total, b2bTotal } = res.data;
          
          const dataRows: any[] = categories.map((c: any) => [
            c.category, 
            c.current_month_weight, 
            c.current_month_amount, 
            c.target_weight, 
            c.achievement_rate.toFixed(1)
          ]);

          islands.push({
            title: `B2C 분석 (품목그룹별)`,
            headers: ['카테고리', '당월중량(L)', '당월금액', '목표중량(L)', '달성율(%)'],
            data: [
              ...dataRows,
              ['전체합계', total.current_month_weight, total.current_month_amount, total.target_weight, total.achievement_rate.toFixed(1)]
            ]
          });

          if (b2bTotal) {
            islands.push({
              title: `B2B 실적 (참고용)`,
              headers: ['구분', '중량(L)', '금액'],
              data: [['B2B 합계', b2bTotal.weight, b2bTotal.amount]]
            });
          }
        } else if (res.id === 'b2b-il') {
          const { categories, branches, total, b2cTotal } = res.data;
          
          const catRows: any[] = categories.map((c: any) => [
            c.category, 
            c.current_month_weight, 
            c.current_month_amount, 
            c.target_weight, 
            c.achievement_rate.toFixed(1)
          ]);

          islands.push({
            title: `B2B 분석 (품목그룹별)`,
            headers: ['카테고리', '당월중량(L)', '당월금액', '목표중량(L)', '달성율(%)'],
            data: [
              ...catRows,
              ['전체합계', total.current_month_weight, total.current_month_amount, total.target_weight, total.achievement_rate.toFixed(1)]
            ]
          });

          if (b2cTotal) {
            islands.push({
              title: `B2C 실적 (참고용)`,
              headers: ['구분', '중량(L)', '금액'],
              data: [['B2C 합계', b2cTotal.weight, b2cTotal.amount]]
            });
          }
        } else if (res.id === 'target-achievement') {
          const { branches, total } = res.data;
          islands.push({
            title: '사업소별 목표 달성 현황',
            headers: ['사업소', '목표중량(L)', '실적중량(L)', '달성율(%)', '차이'],
            data: [
              ...branches.map((b: any) => [b.branch, b.target_weight, b.actual_weight, b.achievement_rate.toFixed(1), b.gap]),
              ['합계', total.target_weight, total.actual_weight, total.achievement_rate.toFixed(1), total.gap]
            ]
          });
        } else if (res.id === 'yoy-comparison') {
          const { branches, total, currentYear, lastYear } = res.data;
          islands.push({
            title: `사업소별 전년 대비 실적 비교 (${currentYear} vs ${lastYear})`,
            headers: ['사업소', `${currentYear}년 중량`, `${lastYear}년 중량`, '증감율(%)', '증감량'],
            data: [
              ...branches.map((b: any) => [b.branch, b.current_year_weight, b.last_year_weight, b.growth_rate.toFixed(1), b.growth_amount]),
              ['합계', total.current_year_weight, total.last_year_weight, total.growth_rate.toFixed(1), total.growth_amount]
            ]
          });
        } else if (res.id === 'branch-performance') {
          const { branches, currentMonth, lastMonth } = res.data;
          const dataRows: any[] = [];
          
          branches.forEach((b: any) => {
            // Branch Total Row
            dataRows.push([b.branch, '사업소 합계', '-', b.current_month_weight, b.current_month_amount, b.last_month_weight, b.last_month_amount]);
            
            if (b.teams) {
              b.teams.forEach((t: any) => {
                // Team Row
                dataRows.push(['', t.team_name, '팀 합계', t.current_month_weight, t.current_month_amount, t.last_month_weight, t.last_month_amount]);
                
                if (t.employees) {
                  t.employees.forEach((e: any) => {
                    // Employee Row
                    dataRows.push(['', '', e.employee, e.current_month_weight, e.current_month_amount, e.last_month_weight, e.last_month_amount]);
                  });
                }
              });
            }
          });

          islands.push({
            title: `사업소별 전월 대비 실적 상세 (${currentMonth} vs ${lastMonth})`,
            headers: ['사업소', '팀', '사원', `${currentMonth} 중량`, `${currentMonth} 금액`, `${lastMonth} 중량`, `${lastMonth} 금액`],
            data: dataRows
          });
        }

        if (islands.length > 0) {
          sheets.push({ name: res.name, islands, referenceDate: selectedMonth });
        }
      }

      const { exportMultiSheetIslandTables } = await import('@/lib/excel-export');
      exportMultiSheetIslandTables(sheets, generateFilename(`Closing_Meeting_Report_${selectedMonth}`));
    } catch (error) {
      console.error('Closing Meeting Full Export Error:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            마감회의 자료
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            월간 마감회의 관련 자료 및 실적 데이터
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-3">
          {isExporting && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer pr-4"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {month.split('-')[0]}년 {month.split('-')[1]}월
                </option>
              ))}
            </select>
          </div>
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={isExporting || !selectedMonth} />
        </div>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'monthly-summary' ? (
          <MonthlySummaryTab selectedMonth={selectedMonth} />
        ) : activeTab === 'b2c-auto' ? (
          <B2CAutoAnalysisTab selectedMonth={selectedMonth} />
        ) : activeTab === 'b2b-il' ? (
          <B2BILAnalysisTab selectedMonth={selectedMonth} />
        ) : activeTab === 'target-achievement' ? (
          <TargetAchievementTab selectedMonth={selectedMonth} />
        ) : activeTab === 'yoy-comparison' ? (
          <YearOverYearTab selectedMonth={selectedMonth} />
        ) : activeTab === 'branch-performance' ? (
          <BranchPerformanceTab selectedMonth={selectedMonth} />
        ) : activeTab === 'goal-setting' ? (
          <GoalSettingTab />
        ) : null}
      </div>
    </div>
  );
}
