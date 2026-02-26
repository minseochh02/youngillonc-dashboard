import DataLogicInfo from "./DataLogicInfo";

interface MonthlyCollectionRow {
  month: string;
  branch: string;
  totalCollection: number;
  cash: number;
  notes: number;
  card: number;
}

interface MonthlyCollectionsTableProps {
  data: MonthlyCollectionRow[];
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return num.toLocaleString();
};

export default function MonthlyCollectionsTable({ data }: MonthlyCollectionsTableProps) {
  // Group data by month and sort them descending (latest first)
  const months = Array.from(new Set(data.map(d => d.month))).sort().reverse();
  const maxCollection = Math.max(...data.map(d => d.totalCollection || 0), 1);

  // Helper to find previous month's data for a branch
  const getPrevMonthData = (currentMonth: string, branch: string) => {
    const allMonths = Array.from(new Set(data.map(d => d.month))).sort();
    const monthIdx = allMonths.indexOf(currentMonth);
    if (monthIdx <= 0) return null;
    const prevMonth = allMonths[monthIdx - 1];
    return data.find(d => d.month === prevMonth && d.branch === branch);
  };

  const renderDiff = (current: number, prev: number | undefined) => {
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
          {isPositive ? "↑" : "↓"} {formattedDiff}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {months.map((month) => {
        const monthData = data.filter(d => d.month === month);
        const monthTotal = monthData.reduce((acc, curr) => ({
          totalCollection: acc.totalCollection + curr.totalCollection,
          cash: acc.cash + curr.cash,
          notes: acc.notes + curr.notes,
          card: acc.card + curr.card,
        }), { 
          totalCollection: 0, cash: 0, notes: 0, card: 0
        });

        // Calculate previous month total for subtotal diff
        const allMonths = Array.from(new Set(data.map(d => d.month))).sort();
        const prevMonth = allMonths[allMonths.indexOf(month) - 1];
        const prevMonthTotal = prevMonth ? data.filter(d => d.month === prevMonth).reduce((acc, curr) => ({
          totalCollection: acc.totalCollection + curr.totalCollection,
          cash: acc.cash + curr.cash,
          notes: acc.notes + curr.notes,
          card: acc.card + curr.card,
        }), { 
          totalCollection: 0, cash: 0, notes: 0, card: 0
        }) : null;

        return (
          <div key={month} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{month.split('-')[1]}월 수금 실적</span>
              <span className="text-xs text-zinc-400 font-medium">({month.split('-')[0]}년)</span>
            </div>
            
            <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-wider">
                      <th className="sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900 px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800 w-24 text-center">사업소</th>
                      <th className="px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 min-w-[150px]">총 수금액</th>
                      <th className="px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800">현금</th>
                      <th className="px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800">어음</th>
                      <th className="px-4 py-6 border-b border-zinc-200 dark:border-zinc-800">카드</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {monthData.map((row) => {
                      const prevData = getPrevMonthData(month, row.branch);
                      return (
                        <tr key={`${month}-${row.branch}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                          <td className="sticky left-0 z-10 px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40">
                            {row.branch}
                          </td>
                          <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 relative">
                            <div className="flex flex-col items-end gap-1">
                              <span className="tabular-nums font-bold text-blue-600 dark:text-blue-400">
                                {formatNumber(row.totalCollection)}
                              </span>
                              <div className="w-full h-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500/40 rounded-full" 
                                  style={{ width: `${(row.totalCollection / maxCollection) * 100}%` }}
                                />
                              </div>
                            </div>
                            {renderDiff(row.totalCollection, prevData?.totalCollection)}
                          </td>
                          <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right relative">
                            {formatNumber(row.cash)}
                            {renderDiff(row.cash, prevData?.cash)}
                          </td>
                          <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right relative text-amber-600 dark:text-amber-400">
                            {formatNumber(row.notes)}
                            {renderDiff(row.notes, prevData?.notes)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-right relative">
                            {formatNumber(row.card)}
                            {renderDiff(row.card, prevData?.card)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-blue-50/30 dark:bg-blue-900/10 font-bold">
                    <tr className="group">
                      <td className="sticky left-0 z-10 px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-center text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10">소계</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right text-blue-700 dark:text-blue-400 relative">
                        {formatNumber(monthTotal.totalCollection)}
                        {renderDiff(monthTotal.totalCollection, prevMonthTotal?.totalCollection)}
                      </td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right relative">
                        {formatNumber(monthTotal.cash)}
                        {renderDiff(monthTotal.cash, prevMonthTotal?.cash)}
                      </td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right relative text-amber-700 dark:text-amber-500">
                        {formatNumber(monthTotal.notes)}
                        {renderDiff(monthTotal.notes, prevMonthTotal?.notes)}
                      </td>
                      <td className="px-4 py-4 text-right relative">
                        {formatNumber(monthTotal.card)}
                        {renderDiff(monthTotal.card, prevMonthTotal?.card)}
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
          title="월별 수금"
          description="지사별 월간 수금 현황 및 수단별 집계 추이를 분석합니다."
          steps={[
            "월간 그룹화: 일별 입금 및 어음 내역을 월 단위로 통합하여 지사별 월간 총 수금액을 산출합니다.",
            "성장 추이 추적: 현재 달과 전월 실적을 비교하여 수금액의 증감(↑/↓)을 실시간으로 표시합니다.",
            "수단별 상세 비교: 현금, 어음, 카드 각 항목별로 전월 대비 성과를 호버를 통해 즉시 확인할 수 있습니다.",
            "누적 실적 통합: 회계 연도 기준의 월별 흐름을 한 눈에 파악할 수 있도록 역순으로 배치하였습니다."
          ]}
        />
      )}
      
      {data.length === 0 && (
        <div className="p-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 italic">
          집계된 월별 수금 데이터가 없습니다.
        </div>
      )}
    </div>
  );
}
