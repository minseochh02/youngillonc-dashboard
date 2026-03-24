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
  flagship?: {
    salesVol: number;
    purchaseVol: number;
    salesMTD: number;
    purchaseMTD: number;
  };
  purchaseData?: {
    todayVolume: number;
    todayAmount: number;
  };
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
  flagship = { salesVol: 0, purchaseVol: 0, salesMTD: 0, purchaseMTD: 0 },
  purchaseData = { todayVolume: 0, todayAmount: 0 }
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
          {/* Sales Status Section */}
          <div className="space-y-4">
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
            <DataLogicInfo 
              title="판매현황"
              description={`${division} 사업소의 브랜드별 매출 실적을 실시간으로 집계합니다.`}
              steps={[
                "브랜드 분류: 품목그룹1코드(IL, PVL, CVL, AVI, MB, BL, FU)를 기준으로 실적을 자동 분류합니다.",
                "지사 필터링: 창고명 매칭 및 특정 예외 업체(예: 창원의 경우 테크젠 주식회사)를 포함하여 정확한 지사 실적을 도출합니다.",
                "특이사항 처리: Mobil-MB(벤츠) 실적은 용량(D/M) 위주로 관리하며, 매출액 합산 시 0으로 처리하는 공식 마감 규칙을 따릅니다.",
                "단위 환산: 비고란의 D/M 수치는 판매 용량(L)을 200L으로 나눈 환산값입니다.",
                "누계 산출: 선택한 날짜가 속한 월의 1일부터 해당일까지의 합계를 산출합니다."
              ]}
            />
          </div>

          {/* Collection Status Section */}
          <div className="space-y-4">
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
            <DataLogicInfo
              title="수금현황"
              description="외상매출금 회수 실적을 수단별로 분류하여 집계합니다."
              steps={[
                "데이터 소스: 계정별원장(ledger) 테이블을 사용하여 일별 세부 수금 데이터를 추출합니다.",
                "현금/카드 분류: 계정명이 '외상매출금'인 대변금액(수금) 중 적요에 '이니시스'가 포함되면 카드, 그 외는 현금으로 분류합니다.",
                "받을어음: 계정명이 '받을어음'인 대변금액(만기입금)을 어음 수금 실적으로 집계합니다.",
                "부서 매칭: 원장의 부서명 필드를 기반으로 각 사업소별 수금 실적을 할당합니다.",
                "누계 산출: 선택한 날짜가 속한 월의 1일부터 해당일까지의 합계를 일별 데이터 기반으로 정확하게 산출합니다."
              ]}
              footnote="※ 참고: 나머지는 현금, 받을어음, 카드결제실시 - 영일오엔씨 마감 기준서 발췌\n※ 모든 수금 데이터는 계정별원장(ledger) 테이블을 사용하여 정확도를 개선하였습니다."
            />
          </div>
        </div>

        {/* Right Column: Inventory & Special */}
        <div className="space-y-8">
          {/* Inventory Status Section */}
          <div className="space-y-4 h-full flex flex-col">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex-grow">
              <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className="w-5 h-5 text-amber-500" />
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100">재고현황</h4>
                </div>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-bold">D/M</span>
              </div>
              <div className="overflow-x-auto">
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
            <DataLogicInfo
              title="재고현황"
              description="사업소별 브랜드 제품 재고를 실시간 입출고 기반으로 산출합니다."
              steps={[
                "기초 재고: 선택한 날짜 전일까지의 모든 매입 중량에서 모든 매출 중량을 차감하여 기초 재고를 계산합니다.",
                "당일 입고: 당일 발생한 구매현황(purchases) 데이터의 중량을 합산합니다. 창고(창고명) 필드를 기준으로 사업소별 실적을 분류합니다.",
                "당일 출고: 당일 발생한 판매현황(sales) 데이터의 중량을 합산합니다.",
                "기말 재고: 기초 재고 + 당일 입고 - 당일 출고 수식을 실시간 적용합니다.",
                "단위 변환: 모든 재고 수치는 L 단위를 200으로 나눈 Drum(D/M) 단위로 통일하여 표시합니다."
              ]}
              footnote="※ 구매현황은 창고를 기준으로 산출되며, 모빌 제품군의 경우 부가세 포함 금액을 사용합니다."
            />
          </div>
        </div>
      </div>

      {/* Special Sections: Flagship & Purchases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
            <h4 className="font-bold text-lg">IL (Flagship) 실적</h4>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-widest text-white/60 font-bold">매출 실적 (L)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] text-white/50 mb-1">당일</p>
                  <p className="text-xl font-bold">{flagship.salesVol} L</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] text-white/50 mb-1">누계</p>
                  <p className="text-xl font-bold">{flagship.salesMTD} L</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-widest text-white/60 font-bold">매입 실적 (L)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] text-white/50 mb-1">당일</p>
                  <p className="text-xl font-bold">{flagship.purchaseVol} L</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] text-white/50 mb-1">누계</p>
                  <p className="text-xl font-bold">{flagship.purchaseMTD} L</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 bg-zinc-900 dark:bg-zinc-800 rounded-2xl text-white shadow-lg border border-zinc-800">
          <div className="flex items-center gap-2 mb-6">
            <PlusCircle className="w-5 h-5 text-blue-400" />
            <h4 className="font-bold text-lg">매입/발주 현황 (Mobil)</h4>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-zinc-800 dark:bg-zinc-700/50 rounded-xl p-4 border border-zinc-700">
              <p className="text-[11px] uppercase tracking-widest text-zinc-400 mb-2 font-bold">당일 입고량</p>
              <p className="text-2xl font-bold">{purchaseData.todayVolume.toLocaleString()} L</p>
            </div>
            <div className="bg-zinc-800 dark:bg-zinc-700/50 rounded-xl p-4 border border-zinc-700">
              <p className="text-[11px] uppercase tracking-widest text-zinc-400 mb-2 font-bold">당일 매입액</p>
              <p className="text-2xl font-bold">₩{purchaseData.todayAmount.toLocaleString()}</p>
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
    </div>
  );
}
