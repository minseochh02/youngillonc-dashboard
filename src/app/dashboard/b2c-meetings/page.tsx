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
import { Calendar, Loader2 } from 'lucide-react';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { generateFilename, type IslandTable, type IslandSheetData } from '@/lib/excel-export';

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
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExcelDownload = async () => {
    if (!selectedMonth) return;
    
    setIsExporting(true);
    try {
      const sheets: IslandSheetData[] = [];
      
      // Define tabs to export
      const exportTabs = [
        { id: 'business', name: '사업소별' },
        { id: 'manager-sales', name: '담당자별매출' },
        { id: 'sales-amount', name: '매출액' },
        { id: 'sales-analysis', name: '매출분석-채널' },
        { id: 'customer-reason', name: '거래처별원인' },
        { id: 'new', name: '신규' },
        { id: 'team-strategy', name: '팀및전략딜러' },
        { id: 'team-volume', name: '팀물량' },
        { id: 'team-sales', name: '팀매출액' },
        { id: 'shopping-mall', name: '쇼핑몰판매현황' },
      ];

      // Fetch all data
      const results = await Promise.all(
        exportTabs.map(async (tab) => {
          const response = await apiFetch(`/api/dashboard/b2c-meetings?tab=${tab.id}&month=${selectedMonth}`);
          const result = await response.json();
          return { id: tab.id, name: tab.name, data: result.success ? result.data : null };
        })
      );

      for (const res of results) {
        if (!res.data) continue;
        
        const islands: IslandTable[] = [];
        
        if (res.id === 'business') {
          const { businessData, totalsByYear, currentYear, lastYear } = res.data;
          islands.push({
            title: `${currentYear}년 vs ${lastYear}년 사업소별 중량 비교`,
            headers: ['사업소', `${currentYear}년 중량(L)`, `${lastYear}년 중량(L)`, '변화율(%)'],
            data: businessData.filter((r: any) => r.year === currentYear).map((r: any) => {
              const lastYearMatch = businessData.find((lr: any) => lr.year === lastYear && lr.branch === r.branch && lr.business_type === r.business_type);
              const current = Number(r.total_weight || 0);
              const last = Number(lastYearMatch?.total_weight || 0);
              const change = last === 0 ? 0 : ((current - last) / last) * 100;
              return [r.branch, current, last, change.toFixed(1)];
            })
          });
        } else if (res.id === 'manager-sales') {
          const { summaryData, employeeData } = res.data;
          islands.push({
            title: '채널별 요약',
            headers: ['구분', '카테고리', '연도', '중량(L)', '금액', '수량'],
            data: summaryData.map((r: any) => [r.business_type, r.category, r.year, r.total_weight, r.total_amount, r.total_quantity])
          });
          islands.push({
            title: '담당자별 상세',
            headers: ['팀', '사업소', '담당자', '연도', '채널', '중량(L)', '금액'],
            data: employeeData.slice(0, 100).map((r: any) => [r.team, r.branch, r.employee_name, r.year, r.channel, r.total_weight, r.total_amount])
          });
        } else if (res.id === 'sales-amount') {
          const { channelData, comparisonData, teamData } = res.data;
          islands.push({
            title: '채널별 매출',
            headers: ['채널', '연도', '중량(L)', '금액'],
            data: channelData.map((r: any) => [r.channel, r.year, r.total_weight, r.total_amount])
          });
          islands.push({
            title: 'B2C vs B2B 비교',
            headers: ['구분', '연도', '중량(L)', '금액'],
            data: comparisonData.map((r: any) => [r.business_type, r.year, r.total_weight, r.total_amount])
          });
        } else if (res.id === 'new') {
          const { managerSummary } = res.data;
          islands.push({
            title: '신규 거래처 담당자별 요약',
            headers: ['담당자', '팀', '사업소', '연도', '거래처수', '중량(L)', '금액'],
            data: managerSummary.map((r: any) => [r.담당자명, r.team, r.branch, r.year, r.client_count, r.total_weight, r.total_amount])
          });
        }

        if (islands.length > 0) {
          sheets.push({ name: res.name, islands, referenceDate: selectedMonth });
        }
      }

      const { exportMultiSheetIslandTables } = await import('@/lib/excel-export');
      exportMultiSheetIslandTables(sheets, generateFilename(`B2C_Full_Report_${selectedMonth}`));
    } catch (error) {
      console.error('B2C Full Export Error:', error);
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
            B2C 회의자료
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            B2C 회의 관련 자료 및 데이터
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
