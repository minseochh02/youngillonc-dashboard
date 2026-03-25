"use client";

import { useState, useEffect } from 'react';
import BusinessTab from '@/components/b2c-meetings/BusinessTab';
import ManagerSalesTab from '@/components/b2c-meetings/ManagerSalesTab';
import SalesAmountTab from '@/components/b2c-meetings/SalesAmountTab';
import SalesAnalysisTab from '@/components/b2c-meetings/SalesAnalysisTab';
import CustomerReasonTab from '@/components/b2c-meetings/CustomerReasonTab';
import ShoppingMallTab from '@/components/b2c-meetings/ShoppingMallTab';
import NewTab from '@/components/b2c-meetings/NewTab';
import ProductStatusTab from '@/components/product-status/ProductStatusTab';
import TeamStrategyTab from '@/components/b2c-meetings/TeamStrategyTab';
import TeamVolumeTab from '@/components/b2c-meetings/TeamVolumeTab';
import TeamSalesTab from '@/components/b2c-meetings/TeamSalesTab';
import ComingSoonTab from '@/components/b2c-meetings/ComingSoonTab';
import { apiFetch } from '@/lib/api';
import { Calendar } from 'lucide-react';

const tabs = [
  { id: 'business', label: '사업소별' },
  { id: 'manager-sales', label: '담당자별매출' },
  { id: 'sales-amount', label: '매출액' },
  { id: 'sales-analysis', label: '매출분석-채널' },
  { id: 'customer-reason', label: '거래처별원인' },
  { id: 'new', label: '신규' },
  { id: 'product-status', label: '제품별현황' },
  { id: 'team-strategy', label: '팀및전략딜러' },
  { id: 'team-volume', label: '팀물량' },
  { id: 'team-sales', label: '팀매출액' },
  { id: 'shopping-mall', label: '쇼핑몰판매현황' },
];

export default function B2CMeetingsPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    // Initial fetch to get available months
    const fetchInitialData = async () => {
      try {
        const response = await apiFetch(`/api/dashboard/b2c-meetings?tab=business`);
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
            B2C 회의자료
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            B2C 회의 관련 자료 및 데이터
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
        {activeTab === 'business' ? (
          <BusinessTab selectedMonth={selectedMonth} />
        ) : activeTab === 'manager-sales' ? (
          <ManagerSalesTab selectedMonth={selectedMonth} />
        ) : activeTab === 'sales-amount' ? (
          <SalesAmountTab selectedMonth={selectedMonth} />
        ) : activeTab === 'sales-analysis' ? (
          <SalesAnalysisTab selectedMonth={selectedMonth} />
        ) : activeTab === 'customer-reason' ? (
          <CustomerReasonTab selectedMonth={selectedMonth} />
        ) : activeTab === 'new' ? (
          <NewTab selectedMonth={selectedMonth} />
        ) : activeTab === 'product-status' ? (
          <ProductStatusTab selectedMonth={selectedMonth} />
        ) : activeTab === 'team-strategy' ? (
          <TeamStrategyTab selectedMonth={selectedMonth} />
        ) : activeTab === 'team-volume' ? (
          <TeamVolumeTab selectedMonth={selectedMonth} />
        ) : activeTab === 'team-sales' ? (
          <TeamSalesTab selectedMonth={selectedMonth} />
        ) : activeTab === 'shopping-mall' ? (
          <ShoppingMallTab selectedMonth={selectedMonth} />
        ) : (
          <ComingSoonTab label={tabs.find(t => t.id === activeTab)?.label || ''} />
        )}
      </div>
    </div>
  );
}
