"use client";

import { useState } from 'react';
import MonthlySummaryTab from '@/components/closing-meeting/MonthlySummaryTab';
import B2CAutoAnalysisTab from '@/components/closing-meeting/B2CAutoAnalysisTab';
import B2BILAnalysisTab from '@/components/closing-meeting/B2BILAnalysisTab';

const tabs = [
  { id: 'monthly-summary', label: '월간총괄' },
  { id: 'b2c-auto', label: 'B2C AUTO 분석' },
  { id: 'b2b-il', label: 'B2B IL 분석' },
];

export default function ClosingMeetingPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          마감회의 자료
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          월간 마감회의 관련 자료 및 실적 데이터 (구매 - 판매 = 재고)
        </p>
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
          <MonthlySummaryTab />
        ) : activeTab === 'b2c-auto' ? (
          <B2CAutoAnalysisTab />
        ) : activeTab === 'b2b-il' ? (
          <B2BILAnalysisTab />
        ) : null}
      </div>
    </div>
  );
}
