"use client";

import { useState, useEffect } from "react";
import { Calendar, Building2, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Users, Loader2, FileText, LayoutDashboard } from "lucide-react";
import DailySalesCollectionsTable from "@/components/DailySalesCollectionsTable";
import DailyClosingStatus from "@/components/DailyClosingStatus";
import { apiFetch } from "@/lib/api";
import { ExcelDownloadButton } from "@/components/ExcelDownloadButton";
import { exportToExcel, exportIslandTables, type IslandTable } from "@/lib/excel-export";

const divisions = [
  { id: "all", label: "전체", icon: Building2 },
  { id: "changwon", label: "창원", icon: Building2 },
  { id: "hwaseong", label: "화성", icon: Building2 },
  { id: "seoul", label: "서울", icon: Building2 }, // Note: Seoul might be replaced by specific branch names later if requested
  { id: "mb", label: "MB", icon: Building2 },
  { id: "nambu", label: "남부", icon: Building2 },
  { id: "jungbu", label: "중부", icon: Building2 },
  { id: "seobu", label: "서부", icon: Building2 },
  { id: "dongbu", label: "동부", icon: Building2 },
  { id: "jeju", label: "제주", icon: Building2 },
  { id: "busan", label: "부산", icon: Building2 },
];

export default function DailySalesPage() {
  const [activeTab, setActiveTab] = useState(divisions[1].id); // Default to 'changwon'
  const [viewMode, setViewMode] = useState<"table" | "report">("report");
  const [selectedDate, setSelectedDate] = useState("2025-11-01"); // Default to target date
  const [isLoading, setIsLoading] = useState(false);
  const [closingData, setClosingData] = useState<any>(null);
  const [tableData, setTableData] = useState<any[]>([]);

  const activeDivision = divisions.find(d => d.id === activeTab) || divisions[0];

  useEffect(() => {
    fetchData();
  }, [selectedDate, activeTab, viewMode]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const divisionLabel = activeDivision.label;
      
      if (viewMode === "report") {
        const response = await apiFetch(`/api/dashboard/daily-status/sales-collections/closing?date=${selectedDate}&division=${divisionLabel}`);
        const result = await response.json();
        if (result.success) {
          setClosingData({
            salesData: result.salesData,
            collectionData: result.collectionData,
            inventoryData: result.inventoryData,
            flagship: result.flagship,
            purchaseData: result.purchaseData
          });
        }
      } else {
        const response = await apiFetch(`/api/dashboard/daily-status/sales-collections/customer-detail?date=${selectedDate}&division=${divisionLabel}`);
        const result = await response.json();
        if (result.success) {
          setTableData(result.data || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totals = tableData.reduce((acc, curr) => ({
    sales: acc.sales + Number(curr.salesAmount),
    collection: acc.collection + Number(curr.collectionAmount),
    salesMTD: acc.salesMTD + Number(curr.salesMTD || 0),
    collectionMTD: acc.collectionMTD + Number(curr.collectionMTD || 0),
  }), { sales: 0, collection: 0, salesMTD: 0, collectionMTD: 0 });

  const handleExcelDownload = () => {
    const divisionLabel = activeDivision.label;

    if (viewMode === "table") {
      // Table mode - export customer detail
      if (tableData.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
      }

      const exportData = tableData.map(row => ({
        '거래처': row.customerName || '',
        '매출금액': row.salesAmount || 0,
        '수금금액': row.collectionAmount || 0,
        '월 누계 매출': row.salesMTD || 0,
        '월 누계 수금': row.collectionMTD || 0,
        '비고': row.remarks || '',
      }));

      const filename = `daily-sales-table-${divisionLabel}-${selectedDate}.xlsx`;
      exportToExcel(exportData, filename);

    } else {
      // Report mode - export closing status as island tables
      if (!closingData) {
        alert('다운로드할 데이터가 없습니다.');
        return;
      }

      const islands: IslandTable[] = [];

      // 1. Sales Data
      if (closingData.salesData) {
        const headers = ['항목', '금액'];
        const rows = Object.entries(closingData.salesData).map(([key, value]) => [
          key, Number(value) || 0
        ]);
        islands.push({ title: '매출현황', headers, data: rows });
      }

      // 2. Collection Data
      if (closingData.collectionData) {
        const headers = ['항목', '금액'];
        const rows = Object.entries(closingData.collectionData).map(([key, value]) => [
          key, Number(value) || 0
        ]);
        islands.push({ title: '수금현황', headers, data: rows });
      }

      // 3. Inventory Data
      if (closingData.inventoryData) {
        const headers = ['항목', '수량'];
        const rows = Object.entries(closingData.inventoryData).map(([key, value]) => [
          key, Number(value) || 0
        ]);
        islands.push({ title: '재고현황', headers, data: rows });
      }

      // 4. Flagship Data
      if (closingData.flagship) {
        const headers = ['항목', '값'];
        const rows = Object.entries(closingData.flagship).map(([key, value]) => [
          key, value || ''
        ]);
        islands.push({ title: '대표현황', headers, data: rows });
      }

      // 5. Purchase Data
      if (closingData.purchaseData) {
        const headers = ['항목', '금액'];
        const rows = Object.entries(closingData.purchaseData).map(([key, value]) => [
          key, Number(value) || 0
        ]);
        islands.push({ title: '매입현황', headers, data: rows });
      }

      const filename = `daily-sales-report-${divisionLabel}-${selectedDate}.xlsx`;
      exportIslandTables(islands, filename);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            일일매출수금현황
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            사업부별 실시간 매출 및 수금 현황을 분석합니다.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode("report")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "report" ? "bg-white dark:bg-zinc-900 shadow-sm text-blue-600 dark:text-blue-400" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              <FileText className="w-3.5 h-3.5" />
              마감현황
            </button>
            <button 
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "table" ? "bg-white dark:bg-zinc-900 shadow-sm text-blue-600 dark:text-blue-400" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              거래처별
            </button>
          </div>

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

          <ExcelDownloadButton
            onClick={handleExcelDownload}
            disabled={isLoading || (viewMode === "table" ? tableData.length === 0 : !closingData)}
          />
        </div>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {divisions.map((division) => (
            <button
              key={division.id}
              onClick={() => setActiveTab(division.id)}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === division.id 
                  ? "border-blue-500 text-blue-600 dark:text-blue-400" 
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              <division.icon className="w-4 h-4" />
              {division.label}
            </button>
          ))}
        </nav>
      </div>

      {isLoading && !closingData && tableData.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 animate-pulse">데이터를 집계하고 있습니다...</p>
        </div>
      ) : viewMode === "table" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 매출</p>
                  <p className="text-2xl font-bold mt-2 text-blue-600 dark:text-blue-400">₩{totals.sales.toLocaleString()}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">월 누계: ₩{totals.salesMTD.toLocaleString()}</p>
              </div>
            </div>
            <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 수금</p>
                  <p className="text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">₩{totals.collection.toLocaleString()}</p>
                </div>
                <ArrowDownRight className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">월 누계: ₩{totals.collectionMTD.toLocaleString()}</p>
              </div>
            </div>
            <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">거래처 수</p>
                <Users className="w-4 h-4 text-zinc-400" />
              </div>
              <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">{tableData.length}개</p>
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">실적 발생 업체 중심</p>
              </div>
            </div>
            <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">수금율 (월)</p>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">
                {totals.salesMTD > 0 ? ((totals.collectionMTD / totals.salesMTD) * 100).toFixed(1) : "0.0"}%
              </p>
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">금일 수금율: {totals.sales > 0 ? ((totals.collection / totals.sales) * 100).toFixed(1) : "0.0"}%</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full" /> {activeDivision.label} 거래처별 상세
            </h3>
            <DailySalesCollectionsTable 
              data={tableData} 
              divisionName={activeDivision.label} 
            />
          </div>
        </div>
      ) : (
        closingData ? (
          <DailyClosingStatus
            division={activeDivision.label}
            date={selectedDate}
            salesData={closingData.salesData}
            collectionData={closingData.collectionData}
            inventoryData={closingData.inventoryData}
            flagship={closingData.flagship}
            purchaseData={closingData.purchaseData}
            keyStatus={[]}
            newCustomers={[]}
          />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-400 italic">
            데이터가 없습니다.
          </div>
        )
      )}
    </div>
  );
}
