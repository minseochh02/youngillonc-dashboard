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
import CumulativeViewTab, {
  type MeetingTabFilterOption,
} from '@/components/closing-meeting/CumulativeViewTab';
import VatToggle from '@/components/VatToggle';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
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
  { id: 'cumulative-view', label: '누적 보기' },
  { id: 'shopping-mall', label: '쇼핑몰판매현황' },
];

/** 누적 보기 탭: 다른 탭의 필터 관점을 드롭다운으로 안내 (데이터는 동일 API·표, 사업소만 상세 행 필터) */
const B2C_CUMULATIVE_TAB_FILTERS: MeetingTabFilterOption[] = [
  {
    id: 'default',
    label: '통합 누적 (기본)',
    description:
      '품목군(MB~기타)별로 재고·sell-in·B2C/B2B 합계와 사업소·팀이 한 표에 모두 포함된 기본 누적입니다.',
  },
  {
    id: 'business',
    label: '사업소별',
    description:
      '사업소별 탭과 같이 담당자 사원분류(전체사업소) 기준 사업소 축으로 읽을 때 참고하세요. 사업소를 고르면 해당 사업소 소계·팀 행만 표시됩니다.',
  },
  {
    id: 'manager-sales',
    label: '담당자별매출',
    description:
      '담당자별매출 탭과 같이 사업소·채널(Fleet/LCC 등) 관점이 필요할 때 참고합니다. 사업소 필터로 한 사업소의 팀/담당 행만 볼 수 있습니다.',
  },
  {
    id: 'sales-amount',
    label: '매출액',
    description:
      '매출액 탭과 같이 금액·채널별 매출을 볼 때의 필터(거래처그룹2·업종코드 등)는 본 누적 표와 다릅니다. 중량·품목군 누적만 제공합니다.',
  },
  {
    id: 'sales-analysis',
    label: '매출분석-채널',
    description:
      '매출분석-채널 탭은 AUTO 채널·PVL/CVL 조합입니다. 본 표는 품목군·사업소·팀 중량 누적이므로 채널 세분과 1:1로 맞지 않을 수 있습니다.',
  },
  {
    id: 'customer-reason',
    label: '거래처별원인',
    description:
      '거래처별원인 탭은 거래처 단위 증감입니다. 본 표는 품목군·사업소·팀 집계로 동일하지 않을 수 있습니다.',
  },
  {
    id: 'new',
    label: '신규',
    description: '신규 거래처 탭은 신규일 기준 거래처만 다룹니다. 본 표는 전체 매출 누적입니다.',
  },
  {
    id: 'product-status',
    label: '제품별현황',
    description:
      '제품별현황 탭은 분기별 재고·판매 등 별도 API입니다. 본 표는 마감회의와 동일한 품목군 누적 중량입니다.',
  },
  {
    id: 'team-strategy',
    label: '팀및전략딜러',
    description:
      '팀·전략딜러·남부지사 등 전략 뷰와 함께 볼 때 참고하세요. 사업소 필터로 팀 상세를 좁힐 수 있습니다.',
  },
  {
    id: 'team-volume',
    label: '팀물량',
    description:
      '팀물량 탭은 팀·담당자·월별 물량입니다. 본 표는 동일 품목군·사업소·팀의 연도 누적·당월 열을 제공합니다.',
  },
  {
    id: 'team-sales',
    label: '팀매출액',
    description:
      '팀매출액 탭은 금액·월별입니다. 본 표는 중량 기준 누적이며, 사업소 필터로 팀 행에 집중할 수 있습니다.',
  },
  {
    id: 'shopping-mall',
    label: '쇼핑몰판매현황',
    description:
      '쇼핑몰 탭은 shopping_sales 등 별도 소스입니다. 본 표는 일반 매출·매입 집계와 다릅니다.',
  },
];

export default function B2CMeetingsPage() {
  const { includeVat } = useVatInclude();
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [showAllYears, setShowAllYears] = useState(false);

  const handleMonthsAvailable = (months: string[], currentMonth: string) => {
    setAvailableMonths(months);
    if (!selectedMonth) {
      setSelectedMonth(currentMonth);
    }
  };

  // Filter months to show only current year by default
  const currentYear = new Date().getFullYear();
  const displayedMonths = showAllYears
    ? availableMonths
    : availableMonths.filter(month => month.startsWith(String(currentYear)));

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
        { id: 'product-status', name: '제품별현황' },
        { id: 'team-strategy', name: '팀및전략딜러' },
        { id: 'team-volume', name: '팀물량' },
        { id: 'team-sales', name: '팀매출액' },
        { id: 'shopping-mall', name: '쇼핑몰판매현황' },
      ];

      // Fetch all data
      const results = await Promise.all([
        ...exportTabs.map(async (tab) => {
          const response = await apiFetch(
            withIncludeVat(`/api/dashboard/b2c-meetings?tab=${tab.id}&month=${selectedMonth}`, includeVat)
          );
          const result = await response.json();
          return { id: tab.id, name: tab.name, data: result.success ? result.data : null };
        }),
        // Explicitly fetch product-status from its dedicated API
        (async () => {
          const response = await apiFetch(`/api/dashboard/product-status?month=${selectedMonth}`);
          const result = await response.json();
          return { id: 'product-status', name: '제품별현황', data: result.success ? result.data : null };
        })()
      ]);

      for (const res of results) {
        if (!res.data) continue;
        
        const islands: IslandTable[] = [];
        
        if (res.id === 'business') {
          const { businessData, currentYear, lastYear } = res.data;
          if (businessData) {
            islands.push({
              title: `${currentYear}년 vs ${lastYear}년 사업소별 중량 비교`,
              headers: ['사업소', `${currentYear}년 중량(L)`, `${lastYear}년 중량(L)`, '변화율(%)'],
              data: businessData.filter((r: any) => r.year === String(currentYear)).map((r: any) => {
                const lastYearMatch = businessData.find((lr: any) => lr.year === String(lastYear) && lr.branch === r.branch && lr.business_type === r.business_type);
                const current = Number(r.total_weight || 0);
                const last = Number(lastYearMatch?.total_weight || 0);
                const change = last === 0 ? 0 : ((current - last) / last) * 100;
                return [r.branch, current, last, change.toFixed(1)];
              })
            });
          }
        } else if (res.id === 'manager-sales') {
          const { summaryData, employeeData } = res.data;
          if (summaryData) {
            islands.push({
              title: '채널별 요약',
              headers: ['구분', '카테고리', '연도', '중량(L)', '금액', '수량'],
              data: summaryData.map((r: any) => [r.business_type, r.category, r.year, r.total_weight, r.total_amount, r.total_quantity])
            });
          }
          if (employeeData) {
            islands.push({
              title: '담당자별 상세',
              headers: ['팀', '사업소', '담당자', '연도', '채널', '중량(L)', '금액'],
              data: employeeData.slice(0, 500).map((r: any) => [r.team, r.branch, r.employee_name, r.year, r.channel, r.total_weight, r.total_amount])
            });
          }
        } else if (res.id === 'sales-amount') {
          const { channelData, comparisonData } = res.data;
          if (channelData) {
            islands.push({
              title: '채널별 매출',
              headers: ['채널', '연도', '중량(L)', '금액'],
              data: channelData.map((r: any) => [r.channel, r.year, r.total_weight, r.total_amount])
            });
          }
          if (comparisonData) {
            islands.push({
              title: 'B2C vs B2B 비교',
              headers: ['구분', '연도', '중량(L)', '금액'],
              data: comparisonData.map((r: any) => [r.business_type, r.year, r.total_weight, r.total_amount])
            });
          }
        } else if (res.id === 'sales-analysis') {
          const { currentYear, lastYear, channelData } = res.data;
          if (channelData) {
            const allChannels = Array.from(new Set(channelData.map((row: any) => row.channel))).sort();
            
            const getChannelData = (channel: string, productGroup: string, year: string) => {
              const found = channelData.find((row: any) => row.channel === channel && row.product_group === productGroup && row.year === String(year));
              return found || { total_weight: 0, total_amount: 0, total_quantity: 0 };
            };

            const getChannelTotal = (channel: string, year: string) => {
              return channelData
                .filter((row: any) => row.channel === channel && row.year === String(year))
                .reduce((acc: any, row: any) => ({
                  total_weight: acc.total_weight + (Number(row.total_weight) || 0),
                  total_amount: acc.total_amount + (Number(row.total_amount) || 0),
                }), { total_weight: 0, total_amount: 0 });
            };

            islands.push({
              title: 'AUTO 채널별 매출액 (거래처그룹2)',
              headers: ['채널', `PVL 중량(${currentYear})`, `CVL 중량(${currentYear})`, `합계 중량(${currentYear})`, `PVL 매출(${currentYear})`, `CVL 매출(${currentYear})`, `합계 매출(${currentYear})`, '변화율(%)'],
              data: allChannels.map((channel: any) => {
                const pvlCurrent = getChannelData(channel, 'PVL', currentYear);
                const cvlCurrent = getChannelData(channel, 'CVL', currentYear);
                const totalCurrent = getChannelTotal(channel, currentYear);
                const totalLast = getChannelTotal(channel, lastYear);
                const change = totalLast.total_amount === 0 ? 0 : ((totalCurrent.total_amount - totalLast.total_amount) / totalLast.total_amount) * 100;
                return [channel, pvlCurrent.total_weight, cvlCurrent.total_weight, totalCurrent.total_weight, pvlCurrent.total_amount, cvlCurrent.total_amount, totalCurrent.total_amount, change.toFixed(1)];
              })
            });
          }
        } else if (res.id === 'customer-reason') {
          const { currentYear, lastYear, customerData } = res.data;
          if (customerData) {
            const sortedData = [...customerData].sort((a, b) => Math.abs(b.change_weight || 0) - Math.abs(a.change_weight || 0));
            
            islands.push({
              title: '거래처별 판매 현황 및 원인분석',
              headers: ['거래처그룹2', '담당자명', '거래처코드', '판매처명', `${lastYear}년(L)`, `${currentYear}년(L)`, '증감(L)', '증감율(%)'],
              data: sortedData.slice(0, 1000).map((row: any) => [
                row.거래처그룹2 || '',
                row.담당자명 || '',
                row.거래처코드,
                row.판매처명,
                Math.round(row.last_year_weight || 0),
                Math.round(row.current_year_weight || 0),
                Math.round(row.change_weight || 0),
                row.last_year_weight > 0 ? (((row.current_year_weight - row.last_year_weight) / row.last_year_weight) * 100).toFixed(1) : 'N/A'
              ])
            });
          }
        } else if (res.id === 'new') {
          const { managerSummary } = res.data;
          if (managerSummary) {
            islands.push({
              title: '신규 거래처 담당자별 요약',
              headers: ['담당자', '팀', '사업소', '연도', '거래처수', '중량(L)', '금액'],
              data: managerSummary.map((r: any) => [r.담당자명, r.team, r.branch, r.year, r.client_count, r.total_weight, r.total_amount])
            });
          }
        } else if (res.id === 'product-status') {
          const { sections, currentYear, lastYear } = res.data;
          if (sections) {
            sections.forEach((section: any) => {
              if (!section.data || section.data.length === 0) return;
              islands.push({
                title: section.title,
                headers: ['카테고리', 'Q1(현재)', 'Q1(전년)', 'Q2(현재)', 'Q2(전년)', 'Q3(현재)', 'Q3(전년)', 'Q4(현재)', 'Q4(전년)'],
                data: section.data.map((row: any) => [
                  row.category,
                  ...row.quarters.flatMap((q: any) => [Math.round(q.actual || 0), Math.round(q.previousYear || 0)])
                ])
              });
            });
          }
        } else if (res.id === 'team-strategy') {
          const { currentYear, lastYear, teamData, nambujisaData, strategicDealers } = res.data;
          
          if (teamData) {
            const teamsList = Array.from(new Set(teamData.map((row: any) => row.team))).sort();
            const teamAgg = (team: string, year: string, group: string) => 
              teamData.filter((r: any) => r.team === team && String(r.year) === String(year) && r.product_group === group)
                     .reduce((sum: number, r: any) => sum + (Number(r.total_weight) || 0), 0);

            islands.push({
              title: 'PVL/CVL 팀별 분석',
              headers: [
                '팀명',
                `${currentYear} PV`,
                `${lastYear} PV`,
                'PV 변화율(%)',
                `${currentYear} CV`,
                `${lastYear} CV`,
                'CV 변화율(%)'
              ],
              data: teamsList.map((team: any) => {
                const pvC = teamAgg(team, currentYear, 'PVL');
                const pvL = teamAgg(team, lastYear, 'PVL');
                const cvC = teamAgg(team, currentYear, 'CVL');
                const cvL = teamAgg(team, lastYear, 'CVL');
                const pvPct = pvL === 0 ? 0 : ((pvC - pvL) / pvL) * 100;
                const cvPct = cvL === 0 ? 0 : ((cvC - cvL) / cvL) * 100;
                return [
                  team,
                  pvC,
                  pvL,
                  Number(pvPct.toFixed(1)),
                  cvC,
                  cvL,
                  Number(cvPct.toFixed(1))
                ];
              })
            });
          }

          if (nambujisaData) {
            const nambu = (type: string, year: string) => nambujisaData.find((r: any) => r.type === type && String(r.year) === String(year))?.total_weight || 0;
            islands.push({
              title: '남부지사 매입/매출',
              headers: ['구분', currentYear, lastYear],
              data: [
                ['매입', nambu('purchase', currentYear), nambu('purchase', lastYear)],
                ['매출', nambu('sales', currentYear), nambu('sales', lastYear)]
              ]
            });
          }

          if (strategicDealers) {
            const dealersMap = new Map();
            strategicDealers.forEach((row: any) => {
              if (!dealersMap.has(row.dealer_name)) dealersMap.set(row.dealer_name, { current: 0, last: 0 });
              const d = dealersMap.get(row.dealer_name);
              if (String(row.year) === String(currentYear)) d.current += (Number(row.total_weight) || 0);
              else if (String(row.year) === String(lastYear)) d.last += (Number(row.total_weight) || 0);
            });

            islands.push({
              title: '전략딜러 현황',
              headers: ['판매처명', `${currentYear} 용량(L)`, `${lastYear} 용량(L)`, '변화율(%)'],
              data: Array.from(dealersMap.entries()).map(([name, val]: [any, any]) => {
                const change = val.last === 0 ? 0 : ((val.current - val.last) / val.last) * 100;
                return [name, val.current, val.last, change.toFixed(1)];
              })
            });
          }
        } else if (res.id === 'team-volume' || res.id === 'team-sales') {
          const { volumeData, salesData, currentYear } = res.data;
          const rows = volumeData || salesData;
          if (rows) {
            const teamMap = new Map();
            const monthsSet = new Set();
            rows.forEach((r: any) => {
              const key = `${r.team}|${r.employee_name}|${r.product_group}`;
              if (!teamMap.has(key)) teamMap.set(key, {});
              teamMap.get(key)[r.year_month] = (Number(r.total_weight) || Number(r.total_amount) || 0);
              monthsSet.add(r.year_month);
            });

            const sortedMonths = Array.from(monthsSet).sort() as string[];
            const monthHeaders = sortedMonths.map(m => `${parseInt(m.split('-')[1])}월`);

            islands.push({
              title: res.id === 'team-volume' ? `${currentYear}년 팀별 담당자별 물량` : `${currentYear}년 팀별 담당자별 매출액`,
              headers: ['팀명', '담당자명', '그룹', ...monthHeaders, '합계'],
              data: Array.from(teamMap.entries()).map(([key, monthVals]: [any, any]) => {
                const [team, emp, group] = key.split('|');
                const values = sortedMonths.map(m => monthVals[m] || 0);
                const total = values.reduce((a, b) => a + b, 0);
                return [team, emp, group, ...values, total];
              })
            });
          }
        } else if (res.id === 'shopping-mall') {
          const { salesData, regions, currentYear, lastYear } = res.data;
          if (regions && salesData) {
            islands.push({
              title: '쇼핑몰 매출 현황 (업종 28800)',
              headers: ['지역', `거래건수(${currentYear})`, `거래건수(${lastYear})`, `중량(${currentYear})`, `중량(${lastYear})`, `합계(${currentYear})`, `합계(${lastYear})`],
              data: regions.map((reg: any) => {
                const curr = salesData.find((r: any) => r.region === reg && String(r.year) === String(currentYear)) || {};
                const prev = salesData.find((r: any) => r.region === reg && String(r.year) === String(lastYear)) || {};
                return [reg, curr.transaction_count || 0, prev.transaction_count || 0, curr.total_weight || 0, prev.total_weight || 0, curr.total_amount || 0, prev.total_amount || 0];
              })
            });
          }
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
          <VatToggle id="vat-b2c-meetings" />
          {isExporting && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer pr-4"
            >
              {displayedMonths.map((month) => (
                <option key={month} value={month}>
                  {month.split('-')[0]}년 {month.split('-')[1]}월
                </option>
              ))}
            </select>
          </div>
          {!showAllYears && availableMonths.length > displayedMonths.length && (
            <button
              onClick={() => setShowAllYears(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap"
            >
              전체 년도 보기
            </button>
          )}
          {showAllYears && (
            <button
              onClick={() => setShowAllYears(false)}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap"
            >
              {currentYear}년만 보기
            </button>
          )}
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
          <BusinessTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
        ) : activeTab === 'manager-sales' ? (
          <ManagerSalesTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
        ) : activeTab === 'sales-amount' ? (
          <SalesAmountTab selectedMonth={selectedMonth} onMonthsAvailable={handleMonthsAvailable} />
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
        ) : activeTab === 'cumulative-view' ? (
          <CumulativeViewTab
            selectedMonth={selectedMonth}
            onMonthsAvailable={handleMonthsAvailable}
            cumulativeChannel="b2c"
            meetingTabFilterOptions={B2C_CUMULATIVE_TAB_FILTERS}
          />
        ) : activeTab === 'shopping-mall' ? (
          <ShoppingMallTab selectedMonth={selectedMonth} />
        ) : (
          <ComingSoonTab label={tabs.find(t => t.id === activeTab)?.label || ''} />
        )}
      </div>
    </div>
  );
}
