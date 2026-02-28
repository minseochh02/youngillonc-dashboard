import { TrendingUp, Wallet, Box, Star, PlusCircle, AlertCircle } from "lucide-react";
import DataLogicInfo from "./DataLogicInfo";

interface SalesRow {
  category: string;
  prevTotal: number;
  today: number;
  total: number;
  remarks?: string;
}

interface CollectionRow {
  method: string;
  prevTotal: number;
  today: number;
  total: number;
}

interface InventoryRow {
  category: string;
  unit: string;
  prevStock: number;
  in: number;
  out: number;
  stock: number;
}

interface DailyClosingStatusProps {
  division: string;
  date: string;
  salesData: SalesRow[];
  collectionData: CollectionRow[];
  inventoryData: InventoryRow[];
  keyStatus: any[];
  newCustomers: any[];
}

const formatNumber = (num: number) => {
  if (num === 0) return "-";
  return num.toLocaleString();
};

export default function DailyClosingStatus({
  division,
  date,
  salesData,
  collectionData,
  inventoryData,
  keyStatus,
  newCustomers,
}: DailyClosingStatusProps) {
  const totalSales = salesData.reduce((acc, curr) => ({
    prevTotal: acc.prevTotal + curr.prevTotal,
    today: acc.today + curr.today,
    total: acc.total + curr.total,
  }), { prevTotal: 0, today: 0, total: 0 });

  const totalCollection = collectionData.reduce((acc, curr) => ({
    prevTotal: acc.prevTotal + curr.prevTotal,
    today: acc.today + curr.today,
    total: acc.total + curr.total,
  }), { prevTotal: 0, today: 0, total: 0 });

  const totalInventory = inventoryData.reduce((acc, curr) => ({
    prevStock: acc.prevStock + curr.prevStock,
    in: acc.in + curr.in,
    out: acc.out + curr.out,
    stock: acc.stock + curr.stock,
  }), { prevStock: 0, in: 0, out: 0, stock: 0 });

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
        <div>
          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">
            ({division}) 일일매출/수금 마감현황
          </h3>
          <p className="text-sm text-blue-700/70 dark:text-blue-300/60 mt-1">{date}</p>
        </div>
        <div className="flex gap-4 text-xs font-medium uppercase tracking-wider text-blue-800/60 dark:text-blue-200/50">
          <span>[단위: 원, VAT포함]</span>
          <span>[단위: D/M]</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Sales & Collections */}
        <div className="space-y-8">
          {/* Sales Status Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100">판매현황</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-6 py-3 text-left font-bold">구분</th>
                    <th className="px-4 py-3 text-right">전일누계</th>
                    <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">당일</th>
                    <th className="px-4 py-3 text-right font-bold">누계</th>
                    <th className="px-4 py-3 text-right">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {salesData.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-3 font-medium text-zinc-900 dark:text-zinc-100">{row.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{formatNumber(row.prevTotal)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-600 dark:text-blue-400">{formatNumber(row.today)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">{formatNumber(row.total)}</td>
                      <td className="px-4 py-3 text-right text-xs text-zinc-400">{row.remarks || "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50/30 dark:bg-blue-900/5 font-bold border-t border-blue-100/50 dark:border-blue-900/20">
                  <tr>
                    <td className="px-6 py-4 text-blue-900 dark:text-blue-100">매출액 합계</td>
                    <td className="px-4 py-4 text-right tabular-nums text-blue-900/60 dark:text-blue-100/60">{formatNumber(totalSales.prevTotal)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-blue-600 dark:text-blue-400">{formatNumber(totalSales.today)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-blue-900 dark:text-blue-100">{formatNumber(totalSales.total)}</td>
                    <td className="px-4 py-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Collection Status Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-500" />
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100">수금액</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-6 py-3 text-left font-bold">구분</th>
                    <th className="px-4 py-3 text-right">전일누계</th>
                    <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">당일</th>
                    <th className="px-4 py-3 text-right font-bold">누계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {collectionData.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-3 font-medium text-zinc-900 dark:text-zinc-100">{row.method}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{formatNumber(row.prevTotal)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(row.today)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">{formatNumber(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50/30 dark:bg-emerald-900/5 font-bold border-t border-emerald-100/50 dark:border-emerald-900/20">
                  <tr>
                    <td className="px-6 py-4 text-emerald-900 dark:text-emerald-100">수금액 합계</td>
                    <td className="px-4 py-4 text-right tabular-nums text-emerald-900/60 dark:text-emerald-100/60">{formatNumber(totalCollection.prevTotal)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatNumber(totalCollection.today)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-emerald-900 dark:text-emerald-100">{formatNumber(totalCollection.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Inventory & Special */}
        <div className="space-y-8">
          {/* Inventory Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-amber-500" />
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">재고현황</h4>
              </div>
              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-bold">D/M</span>
            </div>
            <div className="overflow-x-auto flex-grow">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-6 py-3 text-left font-bold">구분</th>
                    <th className="px-4 py-3 text-right">전일재고</th>
                    <th className="px-4 py-3 text-right text-blue-600">입고</th>
                    <th className="px-4 py-3 text-right text-rose-600">출고</th>
                    <th className="px-4 py-3 text-right font-bold bg-zinc-50/50 dark:bg-zinc-800/30">기말재고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {inventoryData.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-3 font-medium text-zinc-900 dark:text-zinc-100">{row.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{row.prevStock.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-600">{row.in > 0 ? row.in.toFixed(2) : "-"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-600">{row.out > 0 ? row.out.toFixed(2) : "-"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold bg-zinc-50/30 dark:bg-zinc-800/20">{row.stock.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-amber-50/30 dark:bg-amber-900/5 font-bold border-t border-amber-100/50 dark:border-amber-900/20">
                  <tr>
                    <td className="px-6 py-4 text-amber-900 dark:text-amber-100">재고 합계</td>
                    <td className="px-4 py-4 text-right tabular-nums">{totalInventory.prevStock.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-blue-600">{totalInventory.in.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-rose-600">{totalInventory.out.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-amber-900 dark:text-amber-100 bg-amber-50/50 dark:bg-amber-900/10">{totalInventory.stock.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Special Sections: Flagship & Purchases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
            <h4 className="font-bold">IL (Flagship) 실적</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1">매출 Vol(L)</p>
              <p className="text-xl font-bold">18 L</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1">매입 Vol(L)</p>
              <p className="text-xl font-bold">0 L</p>
            </div>
          </div>
        </div>
        <div className="p-5 bg-zinc-900 dark:bg-zinc-800 rounded-2xl text-white shadow-lg border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <PlusCircle className="w-5 h-5 text-blue-400" />
            <h4 className="font-bold">매입/발주 현황 (Mobil)</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800 dark:bg-zinc-700/50 rounded-xl p-3 border border-zinc-700">
              <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Vol(L)</p>
              <p className="text-xl font-bold">0 L</p>
            </div>
            <div className="bg-zinc-800 dark:bg-zinc-700/50 rounded-xl p-3 border border-zinc-700">
              <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">금액</p>
              <p className="text-xl font-bold">₩0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Tables */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-yellow-400/10 dark:bg-yellow-400/5 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100">주요현황</h4>
          </div>
          <div className="p-4">
            <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left">날짜</th>
                    <th className="px-6 py-3 text-left">상호</th>
                    <th className="px-6 py-3 text-right">금액</th>
                    <th className="px-6 py-3 text-left">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50 text-zinc-400 italic">
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">기록된 주요 현황이 없습니다.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-emerald-400/10 dark:bg-emerald-400/5 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100">신규개척업체</h4>
          </div>
          <div className="p-4">
            <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left">날짜</th>
                    <th className="px-6 py-3 text-left">상호</th>
                    <th className="px-6 py-3 text-left">소재지</th>
                    <th className="px-6 py-3 text-left">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50 text-zinc-400 italic">
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">신규 개척 업체 내역이 없습니다.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <DataLogicInfo 
        title={`${division} 일일 마감`}
        description="영일오엔씨의 엑셀 정산 체계를 시스템화하여 실시간 데이터베이스를 기반으로 각 지표를 자동 산출합니다."
        steps={[
          "매출 자동 분류: 품목그룹1코드를 분석하여 Mobil(IL, PVL, CVL, AVI), Mobil-MB(MB), 블라자(BL), 훅스(FU) 등 엑셀 규격에 맞춰 실적을 분류합니다.",
          "단위 자동 환산: 판매/매입 중량(kg) 데이터를 엑셀 마감 기준인 1 D/M = 200kg 공식을 적용하여 드럼(D/M) 단위로 즉시 변환합니다.",
          "수금 수단 식별: 입금보고서(deposits)의 계좌 필드에서 '카드', '이니시스' 키워드를 감지하여 카드 실적을 분리하고 그 외는 현금(Cash)으로 집계합니다.",
          "실시간 재고 추적: 전일까지의 누적 매입(In)과 매출(Out)을 합산하여 기초 재고를 구하고, 당일 변동분을 실시간 반영하여 기말 재고를 산출합니다.",
          "플래그십(IL) 추출: 내부 관리 코드(품목그룹3코드='FLA')를 기준으로 고부가가치 제품군의 판매 및 매입 Vol(L)을 별도로 모니터링합니다."
        ]}
      />
    </div>
  );
}
