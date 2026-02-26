import { ArrowDownLeft, ArrowUpRight, Plus, Minus, Calculator, Receipt, Building2 } from "lucide-react";
import DataLogicInfo from "./DataLogicInfo";

interface InOutItem {
  type: string;
  source: string;
  amount: number;
  detail: string;
}

interface InOutData {
  deposits: InOutItem[];
  withdrawals: InOutItem[];
}

interface InOutTableProps {
  data: InOutData;
}

const formatNumber = (num: number) => {
  if (num === 0) return "-";
  return num.toLocaleString();
};

export default function InOutTable({ data }: InOutTableProps) {
  const totalIn = data.deposits.reduce((sum, item) => sum + item.amount, 0);
  const totalOut = data.withdrawals.reduce((sum, item) => sum + item.amount, 0);
  const netFlow = totalIn - totalOut;

  const renderPanel = (title: string, items: InOutItem[], isDeposit: boolean) => (
    <div className="flex-1 flex flex-col gap-4">
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${isDeposit ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800' : 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-800'}`}>
        <div className="flex items-center gap-2">
          {isDeposit ? <ArrowDownLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />}
          <span className="font-bold text-zinc-900 dark:text-zinc-100">{title}</span>
        </div>
        <div className={`text-lg font-black tabular-nums ${isDeposit ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
          ₩{formatNumber(isDeposit ? totalIn : totalOut)}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left w-24">구분</th>
                <th className="px-4 py-3 text-left">거래처/지출처</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3 text-left">세부내역</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-3 align-top">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                      item.type.includes('외상') ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                      item.type.includes('미수금') ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100 align-top">
                    {item.source}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums align-top ${isDeposit ? 'text-zinc-900 dark:text-zinc-100' : 'text-red-600 dark:text-red-400'}`}>
                    {formatNumber(item.amount)}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 dark:text-zinc-500 leading-relaxed max-w-[150px] truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:max-w-none transition-all duration-300">
                    {item.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Executive Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-blue-600 rounded-3xl text-white shadow-lg shadow-blue-200 dark:shadow-none flex flex-col gap-1">
          <div className="flex items-center gap-2 text-blue-100 text-xs font-bold uppercase tracking-widest">
            <Plus className="w-3 h-3" /> 총 입금 (Inflow)
          </div>
          <div className="text-3xl font-black tabular-nums mt-1">₩{formatNumber(totalIn)}</div>
        </div>
        <div className="p-6 bg-zinc-900 rounded-3xl text-white shadow-lg shadow-zinc-200 dark:shadow-none flex flex-col gap-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
            <Minus className="w-3 h-3" /> 총 지출 (Outflow)
          </div>
          <div className="text-3xl font-black tabular-nums mt-1">₩{formatNumber(totalOut)}</div>
        </div>
        <div className={`p-6 rounded-3xl shadow-lg flex flex-col gap-1 ${netFlow >= 0 ? 'bg-white text-zinc-900 border-2 border-green-500 shadow-green-100' : 'bg-red-50 text-red-900 border-2 border-red-500 shadow-red-100'} dark:bg-zinc-900 dark:text-white`}>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest">
            <Calculator className="w-3 h-3" /> 순현금흐름 (Net)
          </div>
          <div className="text-3xl font-black tabular-nums mt-1">
            {netFlow >= 0 ? "+" : "-"}₩{formatNumber(Math.abs(netFlow))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {renderPanel("입금 내역 (Receipts)", data.deposits, true)}
        {renderPanel("지출 내역 (Payments)", data.withdrawals, false)}
      </div>

      <DataLogicInfo 
        title="입출금현황"
        description="전사 계좌 및 현금 시재의 모든 실시간 입출금 내역을 대조하여 가계부를 자동 생성합니다."
        steps={[
          "데이터 이원화: 입금(매출 수금, 미수금 등)과 지출(매입 결제, 경비 지출 등)을 좌우로 분리하여 자금의 출처와 용도를 한눈에 파악합니다.",
          "계정별 필터링: 외상매출금, 미수금, 선급금 등 회계 분류 코드별로 색상 배지를 부여하여 중요도를 시각화합니다.",
          "상세 내역 매핑: 단순 금액 외에도 입금 계좌 정보나 지출 사유(윤활유대, 용차운임 등)를 함께 표시하여 전표의 실체를 증명합니다.",
          "일일 수지 정산: 당일 발생한 모든 입금과 출금의 차액(Net Flow)을 계산하여 자금 유동성을 즉시 확인합니다."
        ]}
      />
    </div>
  );
}
