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
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { apiFetch } from '@/lib/api';
import { generateFilename, type IslandTable, type IslandSheetData } from '@/lib/excel-export';
import { Loader2 } from 'lucide-react';

const tabs = [
  { id: 'industry', label: '산업별' },
  { id: 'team', label: '팀별' },
  { id: 'product-group', label: '제품군' },
  { id: 'client', label: '품목별' },
  { id: 'fps', label: 'FPS' },
  { id: 'region', label: '지역' },
  { id: 'new-client', label: '신규거래처' },
  { id: 'industry-dairy', label: '산업유제품' },
  { id: 'all-products', label: '전제품 판매' },
];

export default function B2BMeetingsPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [isExporting, setIsExporting] = useState(false);

  const handleExcelDownload = async () => {
    setIsExporting(true);
    try {
      const sheets: IslandSheetData[] = [];
      const exportTabs = [
        { id: 'industry', name: '산업별' },
        { id: 'team', name: '팀별' },
        { id: 'product-group', name: '제품군' },
        { id: 'client', name: '품목별' },
        { id: 'fps', name: 'FPS' },
        { id: 'region', name: '지역' },
        { id: 'new-client', name: '신규거래처' },
        { id: 'industry-dairy', name: '산업유제품' },
        { id: 'all-products', name: '전제품 판매' },
      ];

      // Fetch all data
      const results = await Promise.all(
        exportTabs.map(async (tab) => {
          // Special case for industry which has its own route
          const url = tab.id === 'industry' 
            ? `/api/dashboard/b2b-meetings/industry`
            : `/api/dashboard/b2b-meetings?tab=${tab.id}`;
          const response = await apiFetch(url);
          const result = await response.json();
          return { id: tab.id, name: tab.name, data: result.success ? result.data : null };
        })
      );

      for (const res of results) {
        if (!res.data) continue;
        const islands: IslandTable[] = [];

        if (res.id === 'industry') {
          const data = res.data;
          islands.push({
            title: 'B2B 산업별 판매 현황',
            headers: ['모빌분류', '산업분류', '영일분류', '거래처수', '중량(L)', '합계'],
            data: data.map((r: any) => [r.모빌분류, r.산업분류, r.영일분류, r.client_count, r.total_weight, r.total_amount])
          });
        } else if (res.id === 'client') {
          const { productData, currentYear, lastYear } = res.data;
          islands.push({
            title: `B2B 품목별 비교 (${currentYear} vs ${lastYear})`,
            headers: ['품목코드', '품목명', `${currentYear} 중량`, `${lastYear} 중량`, '증감'],
            data: productData.map((r: any) => [r.품목코드, r.품목명, r.current_year_weight, r.last_year_weight, r.change_weight])
          });
        } else if (res.id === 'fps') {
          const { fpsData } = res.data;
          islands.push({
            title: 'FPS 카테고리별 현황',
            headers: ['카테고리', '연도', '중량(L)', '합계', '수량'],
            data: fpsData.map((r: any) => [r.fps_category, r.year, r.total_weight, r.total_amount, r.total_quantity])
          });
        } else if (res.id === 'all-products') {
          const { allProductsData } = res.data;
          islands.push({
            title: '전제품 판매 현황 (팀별)',
            headers: ['팀', '연도', '중량(L)', '합계'],
            data: allProductsData.map((r: any) => [r.team, r.year, r.total_weight, r.total_amount])
          });
        }

        if (islands.length > 0) {
          sheets.push({ 
            name: res.name, 
            islands, 
            referenceDate: new Date().toISOString().split('T')[0] 
          });
        }
      }

      const { exportMultiSheetIslandTables } = await import('@/lib/excel-export');
      exportMultiSheetIslandTables(sheets, generateFilename('B2B_Full_Report'));
    } catch (error) {
      console.error('B2B Full Export Error:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            B2B 회의자료
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            B2B 회의 관련 자료 및 데이터
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isExporting && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={isExporting} />
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
