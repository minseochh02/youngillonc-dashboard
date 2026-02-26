"use client";

import { useState, useEffect } from "react";
import SalesTable from "@/components/SalesTable";
import { Calendar, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const tabs = [
  { id: "sales", label: "매출현황" },
  { id: "production", label: "생산현황" },
  { id: "shipment", label: "출고현황" },
  { id: "inventory", label: "재고현황" },
  { id: "orders", label: "주문현황" },
  { id: "raw-materials", label: "원자재현황" },
  { id: "defects", label: "불량현황" },
];

export default function DailyStatusPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [selectedDate, setSelectedDate] = useState("2026-02-03");
  const [salesData, setSalesData] = useState<any[]>([]);
  const [miscMobil, setMiscMobil] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "sales") {
      fetchSalesData();
    }
  }, [selectedDate, activeTab]);

  const fetchSalesData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/daily-status/sales?date=${selectedDate}`);
      const result = await response.json();
      if (result.success) {
        setMiscMobil(result.miscMobil);
        // Ensure data is an array before reducing
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
          id: 'total', 
          branch: 'Total', 
          totalSales: 0, 
          mobileSalesAmount: 0, 
          mobileSalesWeight: 0, 
          flagshipSalesWeight: 0, 
          mobilePurchaseWeight: 0, 
          flagshipPurchaseWeight: 0,
          isTotal: true 
        });
        
        const dmRow = { 
          id: 'dm', 
          branch: 'D/M계', 
          totalSales: 0, 
          mobileSalesAmount: 0, 
          mobileSalesWeight: 0, 
          flagshipSalesWeight: 0, 
          mobilePurchaseWeight: 0, 
          flagshipPurchaseWeight: 0,
          isTotal: true 
        };

        setSalesData([...data, totalRow, dmRow]);
      }
    } catch (error) {
      console.error("Failed to fetch sales data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totals = salesData.find(d => d.id === 'total') || {
    totalSales: 0,
    mobileSalesAmount: 0,
    mobileSalesWeight: 0,
    flagshipSalesWeight: 0,
    mobilePurchaseWeight: 0,
    flagshipPurchaseWeight: 0,
  };

  const mobileRatio = totals.totalSales > 0 
    ? ((totals.mobileSalesAmount / totals.totalSales) * 100).toFixed(1) 
    : "0.0";

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

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 shadow-sm">
          {isLoading ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> : <Calendar className="w-4 h-4 text-zinc-400" />}
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mr-2">조회일</span>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm bg-transparent border-none focus:ring-0 text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {activeTab === "sales" ? (
          <div className="space-y-6">
            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 매출액</p>
                <p className="text-2xl font-bold mt-2 text-blue-600 dark:text-blue-400">₩{totals.totalSales.toLocaleString()}</p>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-400">
                  <span>전일 대비</span>
                  <span className="text-green-500 font-bold">↑ 4.2%</span>
                </div>
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
                <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">{(totals.mobileSalesWeight + totals.flagshipSalesWeight).toLocaleString()} kg</p>
                <p className="mt-2 text-[10px] text-zinc-400">모빌 + 플래그십 합계</p>
              </div>
              <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 구매 중량</p>
                <p className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-500">{(totals.mobilePurchaseWeight + totals.flagshipPurchaseWeight).toLocaleString()} kg</p>
                <p className="mt-2 text-[10px] text-zinc-400 text-amber-600/60 font-medium italic">실시간 집계 중</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
                  상세 매출 지표
                </h3>
                <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                  Units: KRW / KG
                </div>
              </div>
              {isLoading && salesData.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">데이터를 불러오는 중입니다...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <SalesTable data={salesData} />
                  
                  {miscMobil && miscMobil.count > 0 && (
                    <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      <div className="mt-0.5 text-blue-500">
                        <Loader2 className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">💡 데이터 알림:</span> 
                        <br />
                        분류 체계 외(AA 그룹)에서 발견된 <span className="text-blue-600 dark:text-blue-400 font-medium">Mobil 제품 {miscMobil.count}건</span>이 별도 확인되었습니다. 
                        해당 항목들의 매출액은 <span className="text-zinc-900 dark:text-zinc-100 font-semibold">₩{Number(miscMobil.amount).toLocaleString()}</span>, 
                        중량은 <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{Number(miscMobil.weight).toLocaleString()} kg</span>입니다. 
                        (현재 상단 집계 및 상세 지표에는 포함되지 않았습니다.)
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center min-h-[400px] text-center bg-white dark:bg-zinc-900/50">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4 text-zinc-400">
              📊
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              {tabs.find((t) => t.id === activeTab)?.label} 데이터
            </h3>
            <p className="text-sm text-zinc-500 max-w-xs mt-2">
              선택한 테이블에 대한 상세 데이터를 로드하고 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
