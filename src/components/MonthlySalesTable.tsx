import DataLogicInfo from "./DataLogicInfo";

interface MonthlySalesRow {
  month: string;
  branch: string;
  totalSales: number;
  mobileSalesAmount: number;
  mobileSalesWeight: number;
  flagshipSalesWeight: number;
  mobilePurchaseWeight: number;
  flagshipPurchaseWeight: number;
}

interface MonthlySalesTableProps {
  data: MonthlySalesRow[];
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return num.toLocaleString();
};

export default function MonthlySalesTable({ data }: MonthlySalesTableProps) {
  // Group data by month and sort them
  const months = Array.from(new Set(data.map(d => d.month))).sort();
  const maxSales = Math.max(...data.map(d => d.totalSales || 0), 1);

  // Helper to find previous month's data for a branch
  const getPrevMonthData = (currentMonth: string, branch: string) => {
    const monthIdx = months.indexOf(currentMonth);
    if (monthIdx <= 0) return null;
    const prevMonth = months[monthIdx - 1];
    return data.find(d => d.month === prevMonth && d.branch === branch);
  };

  const renderDiff = (current: number, prev: number | undefined, unit: string = "") => {
    if (prev === undefined || prev === 0) return null;
    const diff = current - prev;
    const isPositive = diff > 0;
    if (diff === 0) return null;

    const formattedDiff = Math.abs(diff) >= 10000 
      ? `${(diff / 10000).toFixed(1)}만` 
      : diff.toLocaleString();

    return (
      <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border ${
          isPositive 
            ? "bg-green-50 text-green-600 border-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" 
            : "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
        }`}>
          {isPositive ? "↑" : "↓"} {formattedDiff}{unit}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {[...months].reverse().map((month) => {
        const monthData = data.filter(d => d.month === month);
        const monthTotal = monthData.reduce((acc, curr) => ({
          totalSales: acc.totalSales + curr.totalSales,
          mobileSalesAmount: acc.mobileSalesAmount + curr.mobileSalesAmount,
          mobileSalesWeight: acc.mobileSalesWeight + curr.mobileSalesWeight,
          flagshipSalesWeight: acc.flagshipSalesWeight + curr.flagshipSalesWeight,
          mobilePurchaseWeight: acc.mobilePurchaseWeight + curr.mobilePurchaseWeight,
          flagshipPurchaseWeight: acc.flagshipPurchaseWeight + curr.flagshipPurchaseWeight,
        }), { 
          totalSales: 0, mobileSalesAmount: 0, mobileSalesWeight: 0, 
          flagshipSalesWeight: 0, mobilePurchaseWeight: 0, flagshipPurchaseWeight: 0 
        });

        // Calculate previous month total for subtotal diff
        const prevMonth = months[months.indexOf(month) - 1];
        const prevMonthTotal = prevMonth ? data.filter(d => d.month === prevMonth).reduce((acc, curr) => ({
          totalSales: acc.totalSales + curr.totalSales,
          mobileSalesAmount: acc.mobileSalesAmount + curr.mobileSalesAmount,
          mobileSalesWeight: acc.mobileSalesWeight + curr.mobileSalesWeight,
          flagshipSalesWeight: acc.flagshipSalesWeight + curr.flagshipSalesWeight,
          mobilePurchaseWeight: acc.mobilePurchaseWeight + curr.mobilePurchaseWeight,
          flagshipPurchaseWeight: acc.flagshipPurchaseWeight + curr.flagshipPurchaseWeight,
        }), { 
          totalSales: 0, mobileSalesAmount: 0, mobileSalesWeight: 0, 
          flagshipSalesWeight: 0, mobilePurchaseWeight: 0, flagshipPurchaseWeight: 0 
        }) : null;

        return (
          <div key={month} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{month.split('-')[1]}월 실적</span>
              <span className="text-xs text-zinc-400 font-medium">({month.split('-')[0]}년)</span>
            </div>
            
            <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-wider">
                      <th rowSpan={2} className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 w-24 text-center sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900">사업소</th>
                      <th rowSpan={2} className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 min-w-[150px]">총 매출액</th>
                      <th colSpan={3} className="px-4 py-2 border-r border-b border-zinc-200 dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 font-semibold">모빌제품 매출액 및 중량</th>
                      <th colSpan={2} className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 font-semibold">모빌제품 구매 중량</th>
                    </tr>
                    <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                      <th className="px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800">매출액</th>
                      <th className="px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800">판매중량</th>
                      <th className="px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800">플래그십</th>
                      <th className="px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800">구매중량</th>
                      <th className="px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">플래그십</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {monthData.map((row) => {
                      const prevData = getPrevMonthData(month, row.branch);
                      return (
                        <tr key={`${month}-${row.branch}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                          <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 font-bold text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40">
                            {row.branch}
                          </td>
                          <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 relative">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                                {formatNumber(row.totalSales)}
                              </span>
                              <div className="w-full h-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500/40 rounded-full" 
                                  style={{ width: `${(row.totalSales / maxSales) * 100}%` }}
                                />
                              </div>
                            </div>
                            {renderDiff(row.totalSales, prevData?.totalSales)}
                          </td>
                          <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right relative">
                            {formatNumber(row.mobileSalesAmount)}
                            {renderDiff(row.mobileSalesAmount, prevData?.mobileSalesAmount)}
                          </td>
                          <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right relative">
                            {formatNumber(row.mobileSalesWeight)}
                            {renderDiff(row.mobileSalesWeight, prevData?.mobileSalesWeight, "kg")}
                          </td>
                          <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right relative">
                            {formatNumber(row.flagshipSalesWeight)}
                            {renderDiff(row.flagshipSalesWeight, prevData?.flagshipSalesWeight, "kg")}
                          </td>
                          <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-amber-600/80 dark:text-amber-400/80 relative">
                            {formatNumber(row.mobilePurchaseWeight)}
                            {renderDiff(row.mobilePurchaseWeight, prevData?.mobilePurchaseWeight, "kg")}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-right text-amber-500/70 dark:text-amber-500/50 relative">
                            {formatNumber(row.flagshipPurchaseWeight)}
                            {renderDiff(row.flagshipPurchaseWeight, prevData?.flagshipPurchaseWeight, "kg")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-blue-50/30 dark:bg-blue-900/10 font-bold">
                    <tr className="group">
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-center text-blue-700 dark:text-blue-400 sticky left-0 z-10 bg-blue-50/30 dark:bg-blue-900/10">소계</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right text-blue-700 dark:text-blue-400 relative">
                        {formatNumber(monthTotal.totalSales)}
                        {renderDiff(monthTotal.totalSales, prevMonthTotal?.totalSales)}
                      </td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right relative">
                        {formatNumber(monthTotal.mobileSalesAmount)}
                        {renderDiff(monthTotal.mobileSalesAmount, prevMonthTotal?.mobileSalesAmount)}
                      </td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right relative">
                        {formatNumber(monthTotal.mobileSalesWeight)}
                        {renderDiff(monthTotal.mobileSalesWeight, prevMonthTotal?.mobileSalesWeight, "kg")}
                      </td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right relative">
                        {formatNumber(monthTotal.flagshipSalesWeight)}
                        {renderDiff(monthTotal.flagshipSalesWeight, prevMonthTotal?.flagshipSalesWeight, "kg")}
                      </td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right text-amber-700 dark:text-amber-400 relative">
                        {formatNumber(monthTotal.mobilePurchaseWeight)}
                        {renderDiff(monthTotal.mobilePurchaseWeight, prevMonthTotal?.mobilePurchaseWeight, "kg")}
                      </td>
                      <td className="px-4 py-4 text-right text-amber-700 dark:text-amber-400 relative">
                        {formatNumber(monthTotal.flagshipPurchaseWeight)}
                        {renderDiff(monthTotal.flagshipPurchaseWeight, prevMonthTotal?.flagshipPurchaseWeight, "kg")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })}
      
      {data.length > 0 && (
        <DataLogicInfo 
          title="월별 매출"
          description="지사별 월간 실적 추이 및 이전 달 대비 성장 지표를 분석합니다."
          steps={[
            "월간 그룹화: 데이터베이스의 일별 거래 내역을 연-월 단위로 묶어 지사별 월간 총계를 산출합니다.",
            "성장 추이 추적: 현재 달과 바로 이전 달의 실적을 비교하여 증감액(↑/↓)을 실시간으로 계산합니다.",
            "호버 인사이트: 숫자 위에 마우스를 올리면 이전 달 대비 구체적인 차이 금액 또는 중량이 팝업됩니다.",
            "누적 실적(YTD): 올해 1월부터 현재까지의 모든 데이터를 합산하여 전체적인 사업 흐름을 요약합니다."
          ]}
        />
      )}

      {data.length === 0 && (
        <div className="p-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 italic">
          올해 집계된 데이터가 없습니다.
        </div>
      )}
    </div>
  );
}
