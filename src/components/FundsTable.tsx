import { ArrowUpRight, ArrowDownRight, Wallet, Globe, Landmark, AlertCircle } from "lucide-react";
import DataLogicInfo from "./DataLogicInfo";

interface FundItem {
  category: string;
  prev: number;
  inc: number;
  dec: number;
  current: number;
  currency?: string;
  foreignPrev?: number;
  foreignInc?: number;
  foreignDec?: number;
  foreignCurrent?: number;
  foreignCurrency?: string;
}

interface FundsData {
  krw: FundItem[];
  foreign: FundItem[];
  loans: FundItem[];
}

interface FundsTableProps {
  data: FundsData;
}

const getCurrencySymbol = (currency: string = "KRW") => {
  switch (currency.toUpperCase()) {
    case "USD": return "$";
    case "EUR": return "€";
    case "JPY": return "¥";
    case "GBP": return "£";
    case "KRW": return "";
    default: return currency + " ";
  }
};

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
          const symbol = getCurrencySymbol(item.currency);
          
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
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">현잔</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {symbol}{formatValue(item.current, item.currency)}
                  </div>
                  {item.foreignCurrent !== undefined && (
                    <div className="text-xs font-bold text-blue-500/80 dark:text-blue-400/80 bg-blue-50/50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                      [{getCurrencySymbol(item.foreignCurrency)}{formatValue(item.foreignCurrent, item.foreignCurrency)}]
                    </div>
                  )}
                </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">전잔</span>
                  <div className="flex flex-col items-end">
                    <span className="text-zinc-600 dark:text-zinc-300 font-medium">{symbol}{formatValue(item.prev, item.currency)}</span>
                    {item.foreignPrev !== undefined && (
                      <span className="text-[9px] font-bold text-blue-500/60 dark:text-blue-400/60">
                        [{getCurrencySymbol(item.foreignCurrency)}{formatValue(item.foreignPrev, item.foreignCurrency)}]
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">당입</span>
                  <div className="flex flex-col items-end">
                    <span className="text-green-500 font-bold">+{symbol}{formatValue(item.inc, item.currency)}</span>
                    {item.foreignInc !== undefined && (
                      <span className="text-[9px] font-bold text-green-500/60">
                        [{getCurrencySymbol(item.foreignCurrency)}{formatValue(item.foreignInc, item.foreignCurrency)}]
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">지출</span>
                  <div className="flex flex-col items-end">
                    <span className="text-red-500 font-bold">-{symbol}{formatValue(item.dec, item.currency)}</span>
                    {item.foreignDec !== undefined && (
                      <span className="text-[9px] font-bold text-red-500/60">
                        [{getCurrencySymbol(item.foreignCurrency)}{formatValue(item.foreignDec, item.foreignCurrency)}]
                      </span>
                    )}
                  </div>
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
        description="전사 계좌별 잔액 이동을 집계합니다. 전잔(전일잔액), 당입(당일입금), 지출(당일출금), 현잔(현재잔액)을 표시합니다."
        steps={[
          "잔액 흐름: '전잔 + 당입 - 지출 = 현잔'. 모든 데이터는 ledger 테이블의 계정별 누적 차변/대변 금액에서 집계합니다.",
          "외화 자산: 외화예금 계정의 적요에서 통화(USD, JPY, EUR, GBP)를 자동 판별하여 구분 표시합니다.",
          "받을어음: 외담대(매출채권 관련)와 전자어음을 구분하여 집계하며, 당일 증가는 가이드 로직에 따라 필터링합니다.",
          "금액 컬럼은 DB_KNOWLEDGE §3에 따라 쉼표 제거 후 NUMERIC으로 집계합니다."
        ]}
        footnote="※ 차입금 및 부채 항목은 실시간 연동된 계정별원장 데이터를 표시합니다."
      />
    </div>
  );
}
