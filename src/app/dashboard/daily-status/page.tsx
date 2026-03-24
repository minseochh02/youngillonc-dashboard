"use client";

import { useState, useEffect } from "react";
import MonthlySalesTable from "@/components/MonthlySalesTable";
import MonthlyPurchaseTable from "@/components/MonthlyPurchaseTable";
import CollectionsTable from "@/components/CollectionsTable";
import MonthlyCollectionsTable from "@/components/MonthlyCollectionsTable";
import FundsTable from "@/components/FundsTable";
import InOutTable from "@/components/InOutTable";
import MobilPaymentsTable from "@/components/MobilPaymentsTable";
import StatusTable from "@/components/StatusTable";
import { Calendar, Loader2, TrendingUp, Wallet, Landmark, Coins, ArrowLeftRight, CreditCard, ShoppingCart, BarChart3, Building2, Warehouse } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";
import { exportIslandTables, type IslandTable } from "@/lib/excel-export";

const tabs = [
  { id: "sales", label: "매출/매입현황" },
  { id: "monthly", label: "월별매출현황" },
  { id: "collections", label: "외상매출금현황" },
  { id: "monthly-collections", label: "월별외상매출금현황" },
  { id: "funds", label: "자금현황" },
  { id: "in-out", label: "입출금현황" },
];

export default function DailyStatusPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [salesView, setSalesView] = useState<'office' | 'warehouse'>('office');
  const [purchaseView, setPurchaseView] = useState<'office' | 'warehouse'>('warehouse');
  const [monthlySalesView, setMonthlySalesView] = useState<'office' | 'warehouse'>('office');
  const [monthlyPurchaseView, setMonthlyPurchaseView] = useState<'office' | 'warehouse'>('warehouse');
  const [selectedDate, setSelectedDate] = useState("2026-02-04");
  const [includeVat, setIncludeVat] = useState(false);
  
  const [salesData, setSalesData] = useState<any[]>([]);
  const [salesByWarehouse, setSalesByWarehouse] = useState<any[]>([]);
  const [purchaseData, setPurchaseData] = useState<any[]>([]);
  const [purchaseByOffice, setPurchaseByOffice] = useState<any[]>([]);
  
  const [monthlySalesData, setMonthlySalesData] = useState<any[]>([]);
  const [monthlySalesByWarehouse, setMonthlySalesByWarehouse] = useState<any[]>([]);
  const [monthlyPurchaseData, setMonthlyPurchaseData] = useState<any[]>([]);
  const [monthlyPurchaseByOffice, setMonthlyPurchaseByOffice] = useState<any[]>([]);
  
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
      fetchSalesAndPurchaseData();
      fetchMobilPaymentsData();
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
  }, [selectedDate, activeTab, includeVat]);

  const fetchSalesAndPurchaseData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/sales?date=${selectedDate}&includeVat=${includeVat}`);
      const result = await response.json();
      if (result.success) {
        setMiscMobil(result.miscMobil);
        
        // Helper to add total row
        const addTotalRow = (data: any[], type: 'sales' | 'purchase') => {
          const raw = Array.isArray(data) ? data : [];
          const total = raw.reduce((acc: any, curr: any) => ({
            amount: acc.amount + (Number(type === 'sales' ? curr.totalSales : curr.totalPurchases) || 0),
            weight: acc.weight + (Number(type === 'sales' ? curr.totalSalesWeight : curr.totalPurchaseWeight) || 0),
            mobileAmount: acc.mobileAmount + (Number(type === 'sales' ? curr.mobileSalesAmount : curr.mobilePurchaseAmount) || 0),
            mobileWeight: acc.mobileWeight + (Number(type === 'sales' ? curr.mobileSalesWeight : curr.mobilePurchaseWeight) || 0),
            flagshipAmount: acc.flagshipAmount + (Number(type === 'sales' ? curr.flagshipSalesAmount : curr.flagshipPurchaseAmount) || 0),
            flagshipWeight: acc.flagshipWeight + (Number(type === 'sales' ? curr.flagshipSalesWeight : curr.flagshipPurchaseWeight) || 0),
          }), { amount: 0, weight: 0, mobileAmount: 0, mobileWeight: 0, flagshipAmount: 0, flagshipWeight: 0 });

          const totalRow = { 
            id: 'total', branch: '합계', isTotal: true,
            [type === 'sales' ? 'totalSales' : 'totalPurchases']: total.amount,
            [type === 'sales' ? 'totalSalesWeight' : 'totalPurchaseWeight']: total.weight,
            [type === 'sales' ? 'mobileSalesAmount' : 'mobilePurchaseAmount']: total.mobileAmount,
            [type === 'sales' ? 'mobileSalesWeight' : 'mobilePurchaseWeight']: total.mobileWeight,
            [type === 'sales' ? 'flagshipSalesAmount' : 'flagshipPurchaseAmount']: total.flagshipAmount,
            [type === 'sales' ? 'flagshipSalesWeight' : 'flagshipPurchaseWeight']: total.flagshipWeight
          };
          return [...raw, totalRow];
        };

        setSalesData(addTotalRow(result.salesData, 'sales'));
        setSalesByWarehouse(addTotalRow(result.salesByWarehouse, 'sales'));
        setPurchaseData(addTotalRow(result.purchaseData, 'purchase'));
        setPurchaseByOffice(addTotalRow(result.purchaseByOffice, 'purchase'));
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    setIsLoading(true);
    try {
      const currentYear = selectedDate.split('-')[0];
      const response = await apiFetch(`/api/dashboard/monthly-sales?year=${currentYear}&includeVat=${includeVat}`);
      const result = await response.json();
      if (result.success) {
        setMonthlySalesData(result.salesData || []);
        setMonthlySalesByWarehouse(result.salesByWarehouse || []);
        setMonthlyPurchaseData(result.purchaseData || []);
        setMonthlyPurchaseByOffice(result.purchaseByOffice || []);
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

  const sTotals = salesData.find(d => d.id === 'total') || { 
    totalSales: 0, totalSalesWeight: 0, 
    mobileSalesAmount: 0, mobileSalesWeight: 0, 
    flagshipSalesAmount: 0, flagshipSalesWeight: 0 
  };
  const pTotals = purchaseData.find(d => d.id === 'total') || { 
    totalPurchases: 0, totalPurchaseWeight: 0, 
    mobilePurchaseAmount: 0, mobilePurchaseWeight: 0, 
    flagshipPurchaseAmount: 0, flagshipPurchaseWeight: 0 
  };

  const msTotals = monthlySalesData.reduce((acc, curr) => ({
    totalSales: acc.totalSales + (Number(curr.totalSales) || 0),
    totalSalesWeight: acc.totalSalesWeight + (Number(curr.totalSalesWeight) || 0),
    mobileSalesAmount: acc.mobileSalesAmount + (Number(curr.mobileSalesAmount) || 0),
    mobileSalesWeight: acc.mobileSalesWeight + (Number(curr.mobileSalesWeight) || 0),
    flagshipSalesAmount: acc.flagshipSalesAmount + (Number(curr.flagshipSalesAmount) || 0),
    flagshipSalesWeight: acc.flagshipSalesWeight + (Number(curr.flagshipSalesWeight) || 0),
  }), { 
    totalSales: 0, totalSalesWeight: 0, 
    mobileSalesAmount: 0, mobileSalesWeight: 0, 
    flagshipSalesAmount: 0, flagshipSalesWeight: 0 
  });

  const mpTotals = monthlyPurchaseData.reduce((acc, curr) => ({
    totalPurchases: acc.totalPurchases + (Number(curr.totalPurchases) || 0),
    totalPurchaseWeight: acc.totalPurchaseWeight + (Number(curr.totalPurchaseWeight) || 0),
    mobilePurchaseAmount: acc.mobilePurchaseAmount + (Number(curr.mobilePurchaseAmount) || 0),
    mobilePurchaseWeight: acc.mobilePurchaseWeight + (Number(curr.mobilePurchaseWeight) || 0),
    flagshipPurchaseAmount: acc.flagshipPurchaseAmount + (Number(curr.flagshipPurchaseAmount) || 0),
    flagshipPurchaseWeight: acc.flagshipPurchaseWeight + (Number(curr.flagshipPurchaseWeight) || 0),
  }), { 
    totalPurchases: 0, totalPurchaseWeight: 0, 
    mobilePurchaseAmount: 0, mobilePurchaseWeight: 0, 
    flagshipPurchaseAmount: 0, flagshipPurchaseWeight: 0 
  });

  const mobileRatio = sTotals.totalSales > 0 
    ? ((sTotals.mobileSalesAmount / sTotals.totalSales) * 100).toFixed(1) 
    : "0.0";

  const ytdMobileRatio = msTotals.totalSales > 0
    ? ((msTotals.mobileSalesAmount / msTotals.totalSales) * 100).toFixed(1)
    : "0.0";

  const handleExcelDownload = async () => {
    try {
      setIsLoading(true);
      // Simplified for brevity, same logic as before but with updated data sets
      const islands: IslandTable[] = [];
      if (salesData.length > 0) {
        islands.push({ 
          title: '매출현황', 
          headers: ['사업소', '총매출액', '총판매량(L)', '모빌매출', '모빌판매량(L)', '플래그십매출', '플래그십판매량(L)'], 
          data: salesData.map(r => [
            r.branch, 
            r.totalSales, 
            r.totalSalesWeight,
            r.mobileSalesAmount, 
            r.mobileSalesWeight, 
            r.flagshipSalesAmount,
            r.flagshipSalesWeight
          ]) 
        });
      }
      if (purchaseData.length > 0) {
        islands.push({ 
          title: '매입현황', 
          headers: ['창고/그룹', '총매입액', '총매입량(L)', '모빌매입', '모빌매입량(L)', '플래그십매입', '플래그십매입량(L)'], 
          data: purchaseData.map(r => [
            r.branch, 
            r.totalPurchases, 
            r.totalPurchaseWeight,
            r.mobilePurchaseAmount, 
            r.mobilePurchaseWeight, 
            r.flagshipPurchaseAmount,
            r.flagshipPurchaseWeight
          ]) 
        });
      }
      if (salesByWarehouse.length > 0) {
        islands.push({ 
          title: '매출현황(창고)', 
          headers: ['창고', '총매출액', '총판매량(L)', '모빌매출', '모빌판매량(L)', '플래그십매출', '플래그십판매량(L)'], 
          data: salesByWarehouse.map(r => [r.branch, r.totalSales, r.totalSalesWeight, r.mobileSalesAmount, r.mobileSalesWeight, r.flagshipSalesAmount, r.flagshipSalesWeight]) 
        });
      }
      if (purchaseByOffice.length > 0) {
        islands.push({ 
          title: '매입현황(사업소)', 
          headers: ['사업소', '총매입액', '총매입량(L)', '모빌매입', '모빌매입량(L)', '플래그십매입', '플래그십매입량(L)'], 
          data: purchaseByOffice.map(r => [r.branch, r.totalPurchases, r.totalPurchaseWeight, r.mobilePurchaseAmount, r.mobilePurchaseWeight, r.flagshipPurchaseAmount, r.flagshipPurchaseWeight]) 
        });
      }
      if (mobilPaymentsData.length > 0) {
        islands.push({ 
          title: '모빌결제내역', 
          headers: ['사업소', 'IL', 'AUTO', 'MBK', '합계'], 
          data: mobilPaymentsData.map(r => [r.branch, r.il, r.auto, r.mbk, r.total]) 
        });
      }
      if (monthlySalesData.length > 0) {
        islands.push({ 
          title: '월별매출현황', 
          headers: ['월', '사업소', '총매출액', '총판매량(L)', '모빌매출', '모빌판매량(L)', '플래그십매출', '플래그십판매량(L)'], 
          data: monthlySalesData.map(r => [
            r.month, 
            r.branch, 
            r.totalSales, 
            r.totalSalesWeight,
            r.mobileSalesAmount, 
            r.mobileSalesWeight, 
            r.flagshipSalesAmount,
            r.flagshipSalesWeight
          ]) 
        });
      }
      if (monthlyPurchaseData.length > 0) {
        islands.push({ 
          title: '월별매입현황', 
          headers: ['월', '창고/그룹', '총매입액', '총매입량(L)', '모빌매입', '모빌매입량(L)', '플래그십매입', '플래그십매입량(L)'], 
          data: monthlyPurchaseData.map(r => [
            r.month, 
            r.branch, 
            r.totalPurchases, 
            r.totalPurchaseWeight,
            r.mobilePurchaseAmount, 
            r.mobilePurchaseWeight, 
            r.flagshipPurchaseAmount,
            r.flagshipPurchaseWeight
          ]) 
        });
      }
      if (monthlySalesByWarehouse.length > 0) {
        islands.push({ 
          title: '월별매출현황(창고)', 
          headers: ['월', '창고', '총매출액', '총판매량(L)', '모빌매출', '모빌판매량(L)', '플래그십매출', '플래그십판매량(L)'], 
          data: monthlySalesByWarehouse.map(r => [r.month, r.branch, r.totalSales, r.totalSalesWeight, r.mobileSalesAmount, r.mobileSalesWeight, r.flagshipSalesAmount, r.flagshipSalesWeight]) 
        });
      }
      if (monthlyPurchaseByOffice.length > 0) {
        islands.push({ 
          title: '월별매입현황(사업소)', 
          headers: ['월', '사업소', '총매입액', '총매입량(L)', '모빌매입', '모빌매입량(L)', '플래그십매입', '플래그십매입량(L)'], 
          data: monthlyPurchaseByOffice.map(r => [r.month, r.branch, r.totalPurchases, r.totalPurchaseWeight, r.mobilePurchaseAmount, r.mobilePurchaseWeight, r.flagshipPurchaseAmount, r.flagshipPurchaseWeight]) 
        });
      }
      exportIslandTables(islands, `daily-status-${selectedDate}.xlsx`);
    } catch (error) {
      console.error('Excel export error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">일일현황</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">실시간 공정 및 작업 현황을 모니터링합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 shadow-sm">
            <input
              type="checkbox" id="includeVat" checked={includeVat}
              onChange={(e) => setIncludeVat(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-zinc-100 border-zinc-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="includeVat" className="text-sm font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer">VAT 포함</label>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 shadow-sm">
            {isLoading ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> : <Calendar className="w-4 h-4 text-zinc-400" />}
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mr-2">조회일</span>
            <input
              type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm bg-transparent border-none focus:ring-0 text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
            />
          </div>
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={isLoading} />
        </div>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === "sales" ? (
          <div className="space-y-10">
            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">총 매출액</p>
                <p className="text-2xl font-bold mt-2 text-blue-600">₩{sTotals.totalSales.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">총 매입액</p>
                <p className="text-2xl font-bold mt-2 text-amber-600">₩{pTotals.totalPurchases.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">모빌 판매 비중</p>
                <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">{mobileRatio}%</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">당일 수지 (매출-매입)</p>
                <p className={`text-2xl font-bold mt-2 ${(sTotals.totalSales - pTotals.totalPurchases) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ₩{(sTotals.totalSales - pTotals.totalPurchases).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-blue-500" /> 매출 현황
                </h3>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button 
                    onClick={() => setSalesView('office')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${salesView === 'office' ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> 사업소별
                  </button>
                  <button 
                    onClick={() => setSalesView('warehouse')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${salesView === 'warehouse' ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  >
                    <Warehouse className="w-3.5 h-3.5" /> 창고별
                  </button>
                </div>
              </div>
              <StatusTable 
                data={salesView === 'office' ? salesData : salesByWarehouse} 
                title={salesView === 'office' ? "사업소별 매출" : "창고별 매출"}
                type="sales"
                groupingLabel={salesView === 'office' ? "사업소" : "창고"}
                amountKey="totalSales"
                weightKey="totalSalesWeight"
                mobileAmountKey="mobileSalesAmount"
                mobileWeightKey="mobileSalesWeight"
                flagshipAmountKey="flagshipSalesAmount"
                flagshipWeightKey="flagshipSalesWeight"
              />
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-amber-500" /> 매입 현황
                </h3>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button 
                    onClick={() => setPurchaseView('office')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${purchaseView === 'office' ? 'bg-white dark:bg-zinc-700 text-amber-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> 사업소별
                  </button>
                  <button 
                    onClick={() => setPurchaseView('warehouse')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${purchaseView === 'warehouse' ? 'bg-white dark:bg-zinc-700 text-amber-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  >
                    <Warehouse className="w-3.5 h-3.5" /> 창고별
                  </button>
                </div>
              </div>
              <StatusTable 
                data={purchaseView === 'office' ? purchaseByOffice : purchaseData} 
                title={purchaseView === 'office' ? "사업소별 매입" : "창고별 매입"}
                type="purchase"
                groupingLabel={purchaseView === 'office' ? "사업소" : "창고 그룹"}
                amountKey="totalPurchases"
                weightKey="totalPurchaseWeight"
                mobileAmountKey="mobilePurchaseAmount"
                mobileWeightKey="mobilePurchaseWeight"
                flagshipAmountKey="flagshipPurchaseAmount"
                flagshipWeightKey="flagshipPurchaseWeight"
              />
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-indigo-500" /> 모빌 결제 내역
                </h3>
              </div>
              <MobilPaymentsTable data={mobilPaymentsData} />
            </div>

            {miscMobil && miscMobil.count > 0 && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-500">
                <span className="font-bold">💡 데이터 알림:</span> 분류 외 Mobil 제품 {miscMobil.count}건 발견. 매출 ₩{Number(miscMobil.amount).toLocaleString()}, 용량 {Number(miscMobil.weight).toLocaleString()} L.
              </div>
            )}
          </div>
        ) : activeTab === "monthly" ? (
          <div className="space-y-10">
            {/* Monthly Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">올해 총 매출액</p>
                <p className="text-2xl font-bold mt-2 text-blue-600">₩{msTotals.totalSales.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">올해 총 매입액</p>
                <p className="text-2xl font-bold mt-2 text-amber-600">₩{mpTotals.totalPurchases.toLocaleString()}</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">YTD 모빌 비중</p>
                <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">{ytdMobileRatio}%</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">연간 수지 (매출-매입)</p>
                <p className={`text-2xl font-bold mt-2 ${(msTotals.totalSales - mpTotals.totalPurchases) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ₩{(msTotals.totalSales - mpTotals.totalPurchases).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Monthly Sales Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-blue-500" /> 월별 매출 현황
                </h3>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button 
                    onClick={() => setMonthlySalesView('office')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${monthlySalesView === 'office' ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> 사업소별
                  </button>
                  <button 
                    onClick={() => setMonthlySalesView('warehouse')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${monthlySalesView === 'warehouse' ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  >
                    <Warehouse className="w-3.5 h-3.5" /> 창고별
                  </button>
                </div>
              </div>
              <MonthlySalesTable 
                data={monthlySalesView === 'office' ? monthlySalesData : monthlySalesByWarehouse} 
                title={monthlySalesView === 'office' ? "사업소별 매출" : "창고별 매출"}
                groupingLabel={monthlySalesView === 'office' ? "사업소" : "창고"}
              />
            </div>

            {/* Monthly Purchase Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-amber-500" /> 월별 매입 현황
                </h3>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button 
                    onClick={() => setMonthlyPurchaseView('office')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${monthlyPurchaseView === 'office' ? 'bg-white dark:bg-zinc-700 text-amber-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> 사업소별
                  </button>
                  <button 
                    onClick={() => setMonthlyPurchaseView('warehouse')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${monthlyPurchaseView === 'warehouse' ? 'bg-white dark:bg-zinc-700 text-amber-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  >
                    <Warehouse className="w-3.5 h-3.5" /> 창고별
                  </button>
                </div>
              </div>
              <MonthlyPurchaseTable 
                data={monthlyPurchaseView === 'office' ? monthlyPurchaseByOffice : monthlyPurchaseData} 
                title={monthlyPurchaseView === 'office' ? "사업소별 매입" : "창고별 매입"}
                groupingLabel={monthlyPurchaseView === 'office' ? "사업소" : "창고 그룹"}
              />
            </div>
          </div>
        ) : activeTab === "collections" ? (
          <div className="space-y-6">
            <CollectionsTable data={collectionsData} />
          </div>
        ) : activeTab === "monthly-collections" ? (
          <div className="space-y-6">
            <MonthlyCollectionsTable data={monthlyCollectionsData} />
          </div>
        ) : activeTab === "funds" ? (
          <div className="space-y-6">
            {fundsData ? <FundsTable data={fundsData} /> : <p>데이터가 없습니다.</p>}
          </div>
        ) : activeTab === "in-out" ? (
          <div className="space-y-6">
            {inOutData ? <InOutTable data={inOutData} /> : <p>데이터가 없습니다.</p>}
          </div>
        ) : (
          <div className="space-y-6">
            <MobilPaymentsTable data={mobilPaymentsData} />
          </div>
        )}
      </div>
    </div>
  );
}
