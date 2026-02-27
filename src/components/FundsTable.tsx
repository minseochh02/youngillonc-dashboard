import { ArrowUpRight, ArrowDownRight, Wallet, Globe, Landmark, AlertCircle } from "lucide-react";
import DataLogicInfo from "./DataLogicInfo";

interface FundItem {
  category: string;
  prev: number;
  inc: number;
  dec: number;
  current: number;
  currency?: string;
}

interface FundsData {
  krw: FundItem[];
  foreign: FundItem[];
  loans: FundItem[];
}

interface FundsTableProps {
  data: FundsData;
}

const formatValue = (num: number, currency: string = "KRW") => {
  if (num === 0) return "-";
  if (currency === "KRW") {
    return num.toLocaleString();
  }
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function FundsTable({ data }: FundsTableProps) {
  const renderFundSection = (title: string, items: FundItem[], icon: React.ReactNode, themeColor: string) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <div className={`p-1.5 rounded-lg ${themeColor} bg-opacity-10 text-opacity-100`}>
          {icon}
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const isPositive = item.inc > item.dec;
          const changePercent = item.prev > 0 ? ((item.inc - item.dec) / item.prev) * 100 : 0;
          
          return (
            <div key={item.category} className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{item.category}</span>
                {item.inc > 0 || item.dec > 0 ? (
                  <div className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-green-50 text-green-600 dark:bg-green-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>
                    {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                    {Math.abs(changePercent).toFixed(1)}%
                  </div>
                ) : null}
              </div>
              
              <div className="space-y-1">
                <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {item.currency ? `${item.currency} ` : "₩"}{formatValue(item.current, item.currency)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>전일: {formatValue(item.prev, item.currency)}</span>
                  <div className="flex gap-2">
                    {item.inc > 0 && <span className="text-green-500 font-medium">+{formatValue(item.inc, item.currency)}</span>}
                    {item.dec > 0 && <span className="text-red-500 font-medium">-{formatValue(item.dec, item.currency)}</span>}
                  </div>
                </div>
              </div>
              
              {/* Simple progress visual for change */}
              {(item.inc > 0 || item.dec > 0) && (
                <div className="mt-4 w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(Math.max(Math.abs(changePercent), 5), 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-10">
      {data.krw.length > 0 && renderFundSection("현금 및 예금", data.krw, <Wallet className="w-5 h-5 text-blue-500" />, "bg-blue-500")}
      {data.foreign.length > 0 && renderFundSection("외화 자산 (Foreign)", data.foreign, <Globe className="w-5 h-5 text-purple-500" />, "bg-purple-500")}
      {data.loans.length > 0 && renderFundSection("차입금 및 부채 (Liabilities)", data.loans, <Landmark className="w-5 h-5 text-amber-500" />, "bg-amber-500")}

      <DataLogicInfo 
        title="자금현황"
        description="전사 계좌별 잔액 이동을 집계합니다. 현금 시재금(ledger), 보통예금·받을어음(deposits/expenses/promissory_notes) 반영."
        steps={[
          "잔액 흐름: '전일잔액 + 당일증가 - 당일감소 = 금일잔액'. 현금 시재금은 ledger 테이블(계정별 최종 잔액·차변/대변)에서 집계합니다.",
          "보통예금 (당일): deposits(외상매출금 입금) − expenses(지출). 받을어음 (당일): promissory_notes 증감구분=증가 (DB_KNOWLEDGE §5, §7).",
          "금액 컬럼은 DB_KNOWLEDGE §3에 따라 쉼표 제거 후 NUMERIC으로 집계합니다."
        ]}
        footnote="※ 외화 자산·차입금은 데이터 연동 후 표시됩니다."
      />
    </div>
  );
}
