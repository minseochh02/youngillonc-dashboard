"use client";

import { useState } from 'react';
import { Calendar } from 'lucide-react';
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
import VatToggle from '@/components/VatToggle';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { generateFilename, type IslandTable, type IslandSheetData } from '@/lib/excel-export';
import { Loader2 } from 'lucide-react';

const tabs = [
  { id: 'industry', label: '산업별' },
  { id: 'team', label: '팀별' },
  { id: 'product-group', label: '제품군' },
  { id: 'client', label: '품목별' },
  { id: 'fps', label: 'FPS' },
  { id: 'region', label: '지역' },
  { id: 'new', label: '신규거래처' },
  { id: 'industry-dairy', label: '산업유제품' },
  { id: 'all-products', label: '전제품 판매' },
];

export default function B2BMeetingsPage() {
  const { includeVat } = useVatInclude();
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleMonthsAvailable = (months: string[], currentMonth: string) => {
    setAvailableMonths(months);
    if (!selectedMonth) {
      setSelectedMonth(currentMonth);
    }
  };

  const handleExcelDownload = async () => {
    if (!selectedMonth) return;
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
        { id: 'new', name: '신규거래처' },
        { id: 'industry-dairy', name: '산업유제품' },
        { id: 'all-products', name: '전제품_판매' },
      ];

      // Fetch all data
      const monthQ = `month=${encodeURIComponent(selectedMonth)}`;
      const results = await Promise.all(
        exportTabs.map(async (tab) => {
          // Special case for industry which has its own route
          const baseUrl =
            tab.id === 'industry'
              ? `/api/dashboard/b2b-meetings/industry?${monthQ}`
              : `/api/dashboard/b2b-meetings?tab=${tab.id}&${monthQ}`;
          const response = await apiFetch(withIncludeVat(baseUrl, includeVat));
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
        } else if (res.id === 'team') {
          const { b2bData, currentYear } = res.data;
          const teamMap = new Map();
          const monthsSet = new Set();
          b2bData.forEach((r: any) => {
            const key = `${r.b2b_office}|${r.b2b_team}|${r.industry}|${r.sector}`;
            if (!teamMap.has(key)) teamMap.set(key, { weight: {}, amount: {} });
            teamMap.get(key).weight[r.year_month] = r.total_weight;
            teamMap.get(key).amount[r.year_month] = r.total_amount;
            monthsSet.add(r.year_month);
          });
          const sortedMonths = Array.from(monthsSet).sort() as string[];
          const monthHeaders = sortedMonths.map(m => `${parseInt(m.split('-')[1])}월`);

          islands.push({
            title: `${currentYear}년 B2B 팀별 산업/섹터 분석 (중량 L)`,
            headers: ['사업소', '팀', '산업', '섹터', ...monthHeaders, '합계'],
            data: Array.from(teamMap.entries()).map(([key, vals]: [any, any]) => {
              const [off, team, ind, sec] = key.split('|');
              const mValues = sortedMonths.map(m => vals.weight[m] || 0);
              return [off, team, ind, sec, ...mValues, mValues.reduce((a, b) => a + b, 0)];
            })
          });
        } else if (res.id === 'product-group') {
          const { productGroupData, currentYear } = res.data;
          const groups = ['Standard', 'Premium', 'Flagship', 'Alliance'];
          const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
          
          islands.push({
            title: '제품군별 월별 매출액',
            headers: ['제품군', ...months.map(m => `${parseInt(m)}월`), '합계'],
            data: groups.map(g => {
              const mValues = months.map(m => {
                const found = (productGroupData || []).find((d: any) => d.product_group === g && d.year_month === `${currentYear}-${m}`);
                return found?.total_amount || 0;
              });
              return [g, ...mValues, mValues.reduce((a, b) => a + b, 0)];
            })
          });
        } else if (res.id === 'client') {
          const { productData, currentYear, lastYear } = res.data;
          islands.push({
            title: `B2B 품목별 비교 (${currentYear} vs ${lastYear})`,
            headers: ['품목코드', '품목명', `${currentYear} 중량`, `${lastYear} 중량`, '증감'],
            data: (productData || []).map((r: any) => [r.품목코드, r.품목명, r.current_year_weight, r.last_year_weight, r.change_weight])
          });
        } else if (res.id === 'fps') {
          const { fpsData } = res.data;
          islands.push({
            title: 'FPS 카테고리별 현황',
            headers: ['카테고리', '연도', '중량(L)', '합계', '수량'],
            data: (fpsData || []).map((r: any) => [r.fps_category, r.year, r.total_weight, r.total_amount, r.total_quantity])
          });
        } else if (res.id === 'region') {
          const { regionData, currentYear, lastYear } = res.data;
          const regions = ['서울경기', '충청', '경남'];
          islands.push({
            title: '지역별 연도 비교',
            headers: ['지역', `${currentYear}년(L)`, `${lastYear}년(L)`, '변화율(%)'],
            data: regions.map(reg => {
              const curr = (regionData || []).filter((d: any) => d.region === reg && String(d.year) === String(currentYear)).reduce((s: number, d: any) => s + (d.total_weight || 0), 0);
              const prev = (regionData || []).filter((d: any) => d.region === reg && String(d.year) === String(lastYear)).reduce((s: number, d: any) => s + (d.total_weight || 0), 0);
              const change = prev === 0 ? 0 : ((curr - prev) / prev) * 100;
              return [reg, curr, prev, change.toFixed(1)];
            })
          });
        } else if (res.id === 'new') {
          const { managerSummary, currentYear, lastYear } = res.data;
          const managers = Array.from(new Set((managerSummary || []).map((m: any) => m.담당자명))).sort();
          
          islands.push({
            title: '담당자별 신규 현황 비교',
            headers: ['담당자', '사업소', `${currentYear}년 거래처수`, `${currentYear}년 중량`, `${lastYear}년 거래처수`, `${lastYear}년 중량`],
            data: managers.map((name: any) => {
              const curr = managerSummary.find((m: any) => m.담당자명 === name && String(m.year) === String(currentYear)) || {};
              const prev = managerSummary.find((m: any) => m.담당자명 === name && String(m.year) === String(lastYear)) || {};
              return [name, curr.branch || prev.branch || '', curr.client_count || 0, curr.total_weight || 0, prev.client_count || 0, prev.total_weight || 0];
            })
          });
        } else if (res.id === 'industry-dairy') {
          const { industryDairyData, currentYear, lastYear } = res.data;
          const items = Array.from(new Set((industryDairyData || []).map((r: any) => `${r.품목코드}|${r.품목명}|${r.youngil_category}`))).sort();
          
          islands.push({
            title: '산업유제품 품목별 현황',
            headers: ['품목코드', '품목명', '영일분류', `${currentYear} 용량`, `${lastYear} 용량`, `${currentYear} 합계`],
            data: items.slice(0, 1000).map((key: any) => {
              const [code, name, cat] = key.split('|');
              const currRows = industryDairyData.filter((r: any) => r.품목코드 === code && String(r.year) === String(currentYear));
              const prevRows = industryDairyData.filter((r: any) => r.품목코드 === code && String(r.year) === String(lastYear));
              
              const currWeight = currRows.reduce((s: number, r: any) => s + (r.total_weight || 0), 0);
              const currAmount = currRows.reduce((s: number, r: any) => s + (r.total_amount || 0), 0);
              const prevWeight = prevRows.reduce((s: number, r: any) => s + (r.total_weight || 0), 0);
              
              return [code, name, cat, currWeight, prevWeight, currAmount];
            })
          });
        } else if (res.id === 'all-products') {
          const { allProductsData } = res.data;
          islands.push({
            title: '전제품 판매 현황 (팀별)',
            headers: ['팀', '연도', '중량(L)', '합계'],
            data: (allProductsData || []).map((r: any) => [r.team, r.year, r.total_weight, r.total_amount])
          });
        }

        if (islands.length > 0) {
          sheets.push({ 
            name: res.name, 
            islands, 
            referenceDate: selectedMonth,
          });
        }
      }

      const { exportMultiSheetIslandTables } = await import('@/lib/excel-export');
      exportMultiSheetIslandTables(sheets, generateFilename(`B2B_Full_Report_${selectedMonth}`));
    } catch (error) {
      console.error('B2B Full Export Error:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'industry') {
      return (
        <IndustryTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
      );
    }

    if (activeTab === 'team') {
      return (
        <B2BTeamTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
      );
    }

    if (activeTab === 'client') {
      return (
        <ClientTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
      );
    }

    if (activeTab === 'product-group') {
      return (
        <ProductGroupTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
      );
    }

    if (activeTab === 'fps') {
      return (
        <FPSTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
      );
    }

    if (activeTab === 'region') {
      return (
        <RegionTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
      );
    }

    if (activeTab === 'new') {
      return (
        <NewClientTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
      );
    }

    if (activeTab === 'all-products') {
      return (
        <AllProductsTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
      );
    }

    if (activeTab === 'industry-dairy') {
      return (
        <IndustryDairyTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
      );
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
          <VatToggle id="vat-b2b-meetings" />
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
