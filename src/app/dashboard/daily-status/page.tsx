"use client";

import { useState, useEffect } from "react";
import SalesTable from "@/components/SalesTable";
import MonthlySalesTable from "@/components/MonthlySalesTable";
import CollectionsTable from "@/components/CollectionsTable";
import MonthlyCollectionsTable from "@/components/MonthlyCollectionsTable";
import FundsTable from "@/components/FundsTable";
import InOutTable from "@/components/InOutTable";
import MobilPaymentsTable from "@/components/MobilPaymentsTable";
import { Calendar, Loader2, TrendingUp, Wallet, Landmark, Coins, ArrowLeftRight, CreditCard } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";
import { exportIslandTables, type IslandTable } from "@/lib/excel-export";

const tabs = [
  { id: "sales", label: "매출현황" },
  { id: "monthly", label: "월별매출현황" },
  { id: "collections", label: "외상매출금현황" },
  { id: "monthly-collections", label: "월별외상매출금현황" },
  { id: "funds", label: "자금현황" },
  { id: "in-out", label: "입출금현황" },
  { id: "mobil-payments", label: "모빌결제내역" },
];

export default function DailyStatusPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [selectedDate, setSelectedDate] = useState("2026-02-04");
  const [salesData, setSalesData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [collectionsData, setCollectionsData] = useState<any[]>([]);
  const [monthlyCollectionsData, setMonthlyCollectionsData] = useState<any[]>([]);
  const [fundsData, setFundsData] = useState<any>(null);
  const [inOutData, setInOutData] = useState<any>(null);
  const [mobilPaymentsData, setMobilPaymentsData] = useState<any[]>([]);
  const [miscMobil, setMiscMobil] = useState<any>(null);
  const [monthlyMiscMobil, setMonthlyMiscMobil] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "sales") {
      fetchSalesData();
    } else if (activeTab === "monthly") {
      fetchMonthlyData();
    } else if (activeTab === "collections") {
      fetchCollectionsData();
    } else if (activeTab === "monthly-collections") {
      fetchMonthlyCollectionsData();
    } else if (activeTab === "funds") {
      fetchFundsData();
    } else if (activeTab === "in-out") {
      fetchInOutData();
    } else if (activeTab === "mobil-payments") {
      fetchMobilPaymentsData();
    }
  }, [selectedDate, activeTab]);

  const fetchSalesData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/sales?date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        setMiscMobil(result.miscMobil);
        const rawData = result.data;
        const data = Array.isArray(rawData) ? rawData : [];
        
        const totalRow = data.reduce((acc: any, curr: any) => ({
          ...acc,
          totalSales: (acc.totalSales || 0) + (Number(curr.totalSales) || 0),
          mobileSalesAmount: (acc.mobileSalesAmount || 0) + (Number(curr.mobileSalesAmount) || 0),
          mobileSalesWeight: (acc.mobileSalesWeight || 0) + (Number(curr.mobileSalesWeight) || 0),
          flagshipSalesWeight: (acc.flagshipSalesWeight || 0) + (Number(curr.flagshipSalesWeight) || 0),
          mobilePurchaseWeight: (acc.mobilePurchaseWeight || 0) + (Number(curr.mobilePurchaseWeight) || 0),
          flagshipPurchaseWeight: (acc.flagshipPurchaseWeight || 0) + (Number(curr.flagshipPurchaseWeight) || 0),
        }), { 
          id: 'total', branch: 'Total', totalSales: 0, mobileSalesAmount: 0, 
          mobileSalesWeight: 0, flagshipSalesWeight: 0, mobilePurchaseWeight: 0, 
          flagshipPurchaseWeight: 0, isTotal: true 
        });
        
        const dmRow = { 
          id: 'dm', branch: 'D/M계', totalSales: 0, mobileSalesAmount: 0, 
          mobileSalesWeight: 0, flagshipSalesWeight: 0, mobilePurchaseWeight: 0, 
          flagshipPurchaseWeight: 0, isTotal: true 
        };

        setSalesData([...data, totalRow, dmRow]);
      }
    } catch (error) {
      console.error("Failed to fetch sales data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    setIsLoading(true);
    try {
      const currentYear = selectedDate.split('-')[0];
      const response = await apiFetch(`/api/dashboard/monthly-sales?year=${currentYear}`);
      const result = await response.json();
      if (result.success) {
        setMonthlyData(result.data || []);
        setMonthlyMiscMobil(result.miscMobil);
      }
    } catch (error) {
      console.error("Failed to fetch monthly data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCollectionsData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/collections?date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        setCollectionsData(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch collections data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyCollectionsData = async () => {
    setIsLoading(true);
    try {
      const currentYear = selectedDate.split('-')[0];
      const response = await apiFetch(`/api/dashboard/monthly-collections?year=${currentYear}`);
      const result = await response.json();
      if (result.success) {
        setMonthlyCollectionsData(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch monthly collections data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFundsData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/funds?date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        setFundsData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch funds data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInOutData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/in-out?date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        setInOutData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch in-out data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMobilPaymentsData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/mobil-payments?date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        setMobilPaymentsData(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch mobil payments data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totals = salesData.find(d => d.id === 'total') || {
    totalSales: 0, mobileSalesAmount: 0, mobileSalesWeight: 0, 
    flagshipSalesWeight: 0, mobilePurchaseWeight: 0, flagshipPurchaseWeight: 0,
  };

  const ytdTotals = monthlyData.reduce((acc, curr) => ({
    totalSales: acc.totalSales + Number(curr.totalSales),
    mobileSalesAmount: acc.mobileSalesAmount + Number(curr.mobileSalesAmount),
    mobileSalesWeight: acc.mobileSalesWeight + Number(curr.mobileSalesWeight),
    flagshipSalesWeight: acc.flagshipSalesWeight + Number(curr.flagshipSalesWeight),
    mobilePurchaseWeight: acc.mobilePurchaseWeight + Number(curr.mobilePurchaseWeight),
    flagshipPurchaseWeight: acc.flagshipPurchaseWeight + Number(curr.flagshipPurchaseWeight),
  }), { 
    totalSales: 0, mobileSalesAmount: 0, mobileSalesWeight: 0, 
    flagshipSalesWeight: 0, mobilePurchaseWeight: 0, flagshipPurchaseWeight: 0 
  });

  const mobileRatio = totals.totalSales > 0 
    ? ((totals.mobileSalesAmount / totals.totalSales) * 100).toFixed(1) 
    : "0.0";

  const ytdMobileRatio = ytdTotals.totalSales > 0
    ? ((ytdTotals.mobileSalesAmount / ytdTotals.totalSales) * 100).toFixed(1)
    : "0.0";

  const handleExcelDownload = async () => {
    try {
      setIsLoading(true);

      // Fetch all data if not already loaded
      const allDataPromises = [];

      if (salesData.length === 0) {
        allDataPromises.push(fetchSalesData());
      }
      if (monthlyData.length === 0) {
        allDataPromises.push(fetchMonthlyData());
      }
      if (collectionsData.length === 0) {
        allDataPromises.push(fetchCollectionsData());
      }
      if (monthlyCollectionsData.length === 0) {
        allDataPromises.push(fetchMonthlyCollectionsData());
      }
      if (!fundsData) {
        allDataPromises.push(fetchFundsData());
      }
      if (!inOutData) {
        allDataPromises.push(fetchInOutData());
      }
      if (mobilPaymentsData.length === 0) {
        allDataPromises.push(fetchMobilPaymentsData());
      }

      await Promise.all(allDataPromises);

      // Wait a bit for state to update if we fetched data
      if (allDataPromises.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create island tables for export
      const islands: IslandTable[] = [];

      // 1. 매출현황
      if (salesData.length > 0) {
        const headers = ['사업소', '총매출', '모빌매출금액', '모빌매출용량', '대표매출용량', '모빌매입용량', '대표매입용량'];
        const rows = salesData.map(row => [
          row.branch || '',
          row.totalSales || 0,
          row.mobileSalesAmount || 0,
          row.mobileSalesWeight || 0,
          row.flagshipSalesWeight || 0,
          row.mobilePurchaseWeight || 0,
          row.flagshipPurchaseWeight || 0,
        ]);
        islands.push({ title: '매출현황', headers, data: rows });
      }

      // 2. 월별매출현황
      if (monthlyData.length > 0) {
        const headers = ['월', '총매출', '모빌매출금액', '모빌매출용량', '대표매출용량', '모빌매입용량', '대표매입용량'];
        const rows = monthlyData.map(row => [
          row.month || '',
          row.totalSales || 0,
          row.mobileSalesAmount || 0,
          row.mobileSalesWeight || 0,
          row.flagshipSalesWeight || 0,
          row.mobilePurchaseWeight || 0,
          row.flagshipPurchaseWeight || 0,
        ]);
        islands.push({ title: '월별매출현황', headers, data: rows });
      }

      // 3. 외상매출금현황
      if (collectionsData.length > 0) {
        const headers = ['사업소', '당월매출', '당월수금', '당월잔액', '전월이월', '당월말잔액'];
        const rows = collectionsData.map(row => [
          row.branch || '',
          row.currentSales || 0,
          row.currentCollections || 0,
          row.currentBalance || 0,
          row.previousBalance || 0,
          row.endBalance || 0,
        ]);
        islands.push({ title: '외상매출금현황', headers, data: rows });
      }

      // 4. 월별외상매출금현황
      if (monthlyCollectionsData.length > 0) {
        const headers = ['월', '당월매출', '당월수금', '당월잔액', '전월이월', '당월말잔액'];
        const rows = monthlyCollectionsData.map(row => [
          row.month || '',
          row.currentSales || 0,
          row.currentCollections || 0,
          row.currentBalance || 0,
          row.previousBalance || 0,
          row.endBalance || 0,
        ]);
        islands.push({ title: '월별외상매출금현황', headers, data: rows });
      }

      // 5. 자금현황
      if (fundsData) {
        const headers = ['항목', '금액'];
        const rows = [
          ['현금', fundsData.cash || 0],
          ['예금', fundsData.deposit || 0],
          ['차입금', fundsData.loan || 0],
          ['순자산', fundsData.netAssets || 0],
        ];
        islands.push({ title: '자금현황', headers, data: rows });
      }

      // 6. 입출금현황
      if (inOutData) {
        const headers = ['항목', '금액'];
        const rows = [
          ['입금', inOutData.income || 0],
          ['출금', inOutData.outcome || 0],
          ['잔액', inOutData.balance || 0],
        ];
        islands.push({ title: '입출금현황', headers, data: rows });
      }

      // 7. 모빌결제내역
      if (mobilPaymentsData.length > 0) {
        const headers = ['거래처', '결제금액', '결제일시', '비고'];
        const rows = mobilPaymentsData.map(row => [
          row.customer || '',
          row.amount || 0,
          row.paymentDate || '',
          row.remarks || '',
        ]);
        islands.push({ title: '모빌결제내역', headers, data: rows });
      }

      const filename = `daily-status-${selectedDate}.xlsx`;
      exportIslandTables(islands, filename);

    } catch (error) {
      console.error('Excel export error:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            일일현황
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            실시간 공정 및 작업 현황을 모니터링합니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 shadow-sm">
            {isLoading ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> : <Calendar className="w-4 h-4 text-zinc-400" />}
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mr-2">조회일</span>
            <input
              type="date" value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm bg-transparent border-none focus:ring-0 text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
            />
          </div>

          <ExcelDownloadButton
            onClick={handleExcelDownload}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === "sales" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 매출액</p>
                <p className="text-2xl font-bold mt-2 text-blue-600 dark:text-blue-400">₩{totals.totalSales.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">모빌 판매 비중</p>
                <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">{mobileRatio}%</p>
                <div className="mt-2 w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${mobileRatio}%` }} />
                </div>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 판매 중량</p>
                <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">{(totals.mobileSalesWeight + totals.flagshipSalesWeight).toLocaleString()} L</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 구매 용량</p>
                <p className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-500">{(totals.mobilePurchaseWeight + totals.flagshipPurchaseWeight).toLocaleString()} L</p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full" /> 상세 매출 지표
              </h3>
              {isLoading && salesData.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400"><Loader2 className="w-8 h-8 animate-spin" /><p>로딩 중...</p></div>
              ) : (
                <div className="space-y-4">
                  <SalesTable data={salesData} />
                  {miscMobil && miscMobil.count > 0 && (
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-500">
                      <span className="font-bold">💡 데이터 알림:</span> 분류 외 Mobil 제품 {miscMobil.count}건 발견. 매출 ₩{Number(miscMobil.amount).toLocaleString()}, 용량 {Number(miscMobil.weight).toLocaleString()} L.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "monthly" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">올해 총 매출액 (YTD)</p>
                <p className="text-2xl font-bold mt-2 text-blue-600 dark:text-blue-400">₩{ytdTotals.totalSales.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">YTD 모빌 비중</p>
                <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">{ytdMobileRatio}%</p>
                <div className="mt-2 w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${ytdMobileRatio}%` }} />
                </div>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">YTD 총 판매 중량</p>
                <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">{(ytdTotals.mobileSalesWeight + ytdTotals.flagshipSalesWeight).toLocaleString()} L</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">YTD 총 구매 용량</p>
                <p className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-500">{(ytdTotals.mobilePurchaseWeight + ytdTotals.flagshipPurchaseWeight).toLocaleString()} L</p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-500" /> 지사별 월간 매출 추이</h3>
              {isLoading && monthlyData.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400"><Loader2 className="w-8 h-8 animate-spin" /><p>로딩 중...</p></div>
              ) : <MonthlySalesTable data={monthlyData} />}
            </div>
          </div>
        ) : activeTab === "collections" ? (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Wallet className="w-5 h-5 text-blue-500" /> 지사별 수금 현황 ({selectedDate})</h3>
            {isLoading && collectionsData.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400"><Loader2 className="w-8 h-8 animate-spin" /><p>로딩 중...</p></div>
            ) : <CollectionsTable data={collectionsData} />}
          </div>
        ) : activeTab === "monthly-collections" ? (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Landmark className="w-5 h-5 text-blue-500" /> 지사별 월간 수금 추이</h3>
            {isLoading && monthlyCollectionsData.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400"><Loader2 className="w-8 h-8 animate-spin" /><p>로딩 중...</p></div>
            ) : <MonthlyCollectionsTable data={monthlyCollectionsData} />}
          </div>
        ) : activeTab === "funds" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Coins className="w-5 h-5 text-blue-500" /> 전사 자금 흐름 ({selectedDate})
              </h3>
              <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                Corporate Funds Status
              </div>
            </div>
            {isLoading && !fundsData ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400"><Loader2 className="w-8 h-8 animate-spin" /><p>자금 현황을 집계하고 있습니다...</p></div>
            ) : fundsData ? (
              <FundsTable data={fundsData} />
            ) : (
              <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center bg-white dark:bg-zinc-900/50">
                <p className="text-zinc-400 italic text-sm">해당 날짜의 자금 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        ) : activeTab === "in-out" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-500" /> 일일 입출금 내역 ({selectedDate})
              </h3>
              <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                Daily Cash Flow
              </div>
            </div>
            {isLoading && !inOutData ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400"><Loader2 className="w-8 h-8 animate-spin" /><p>입출금 내역을 불러오고 있습니다...</p></div>
            ) : inOutData ? (
              <InOutTable data={inOutData} />
            ) : (
              <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center bg-white dark:bg-zinc-900/50">
                <p className="text-zinc-400 italic text-sm">해당 날짜의 입출금 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-500" /> 모빌 매입 결제 내역 ({selectedDate})
              </h3>
              <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                Mobil Korea Payments
              </div>
            </div>
            {isLoading && mobilPaymentsData.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400"><Loader2 className="w-8 h-8 animate-spin" /><p>결제 내역을 불러오고 있습니다...</p></div>
            ) : (
              <MobilPaymentsTable data={mobilPaymentsData} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
