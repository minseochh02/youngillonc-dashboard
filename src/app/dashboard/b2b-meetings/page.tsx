"use client";

import { useState } from 'react';
import IndustryTab from '@/components/b2b-meetings/IndustryTab';
import ClientTab from '@/components/b2b-meetings/ClientTab';
import ProductGroupTab from '@/components/b2b-meetings/ProductGroupTab';
import B2BTeamTab from '@/components/b2b-meetings/B2BTeamTab';
import FPSTab from '@/components/b2b-meetings/FPSTab';
import RegionTab from '@/components/b2b-meetings/RegionTab';
import NewClientTab from '@/components/b2b-meetings/NewClientTab';
import AllProductsTab from '@/components/b2b-meetings/AllProductsTab';
import IndustryDairyTab from '@/components/b2b-meetings/IndustryDairyTab';

const tabs = [
  { id: 'industry', label: '산업별' },
  { id: 'team', label: '팀별' },
  { id: 'product-group', label: '제품군' },
  { id: 'client', label: '거래처별' },
  { id: 'fps', label: 'FPS' },
  { id: 'region', label: '지역' },
  { id: 'new-client', label: '신규거래처' },
  { id: 'industry-dairy', label: '산업유제품' },
  { id: 'all-products', label: '전제품 판매' },
];

export default function B2BMeetingsPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const renderTabContent = () => {
    if (activeTab === 'industry') {
      return <IndustryTab />;
    }

    if (activeTab === 'team') {
      return <B2BTeamTab />;
    }

    if (activeTab === 'client') {
      return <ClientTab />;
    }

    if (activeTab === 'product-group') {
      return <ProductGroupTab />;
    }

    if (activeTab === 'fps') {
      return <FPSTab />;
    }

    if (activeTab === 'region') {
      return <RegionTab />;
    }

    if (activeTab === 'new-client') {
      return <NewClientTab />;
    }

    if (activeTab === 'all-products') {
      return <AllProductsTab />;
    }

    if (activeTab === 'industry-dairy') {
      return <IndustryDairyTab />;
    }

    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
          <p className="text-lg font-medium mb-2">{tabs.find(t => t.id === activeTab)?.label}</p>
          <p className="text-sm">준비 중입니다</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          B2B 회의자료
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          B2B 회의 관련 자료 및 데이터
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
        {renderTabContent()}
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
