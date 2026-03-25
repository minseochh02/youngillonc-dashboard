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
import { Calendar } from 'lucide-react';

const tabs = [
  { id: 'monthly-summary', label: '월간총괄' },
  { id: 'b2c-auto', label: 'B2C AUTO 분석' },
  { id: 'b2b-il', label: 'B2B IL 분석' },
  { id: 'target-achievement', label: '목표 달성율' },
  { id: 'yoy-comparison', label: '전년 대비' },
  { id: 'branch-performance', label: '사업소별 실적' },
  { id: 'goal-setting', label: '목표 설정' },
];

export default function ClosingMeetingPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            마감회의 자료
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            월간 마감회의 관련 자료 및 실적 데이터 (구매 - 판매 = 재고)
          </p>
        </div>

        {/* Month Selector */}
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
