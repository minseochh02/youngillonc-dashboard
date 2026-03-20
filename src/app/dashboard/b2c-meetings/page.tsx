"use client";

import { useState } from 'react';
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          B2C 회의자료
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          B2C 회의 관련 자료 및 데이터
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
        {activeTab === 'business' ? (
          <BusinessTab />
        ) : activeTab === 'manager-sales' ? (
          <ManagerSalesTab />
        ) : activeTab === 'sales-amount' ? (
          <SalesAmountTab />
        ) : activeTab === 'sales-analysis' ? (
          <SalesAnalysisTab />
        ) : activeTab === 'customer-reason' ? (
          <CustomerReasonTab />
        ) : activeTab === 'new' ? (
          <NewTab />
        ) : activeTab === 'product-status' ? (
          <ProductStatusTab />
        ) : activeTab === 'team-strategy' ? (
          <TeamStrategyTab />
        ) : activeTab === 'team-volume' ? (
          <TeamVolumeTab />
        ) : activeTab === 'team-sales' ? (
          <TeamSalesTab />
        ) : activeTab === 'shopping-mall' ? (
          <ShoppingMallTab />
        ) : (
          <ComingSoonTab label={tabs.find(t => t.id === activeTab)?.label || ''} />
        )}
      </div>
    </div>
  );
}
