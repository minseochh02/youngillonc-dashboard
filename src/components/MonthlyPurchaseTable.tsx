import { useMemo } from 'react';

interface MonthlyPurchaseRow {
  month: string;
  branch: string;
  totalPurchases: number;
  mobilePurchaseAmount: number;
  mobilePurchaseWeight: number;
  flagshipPurchaseWeight: number;
}

interface MonthlyPurchaseTableProps {
  data: MonthlyPurchaseRow[];
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return Math.round(num).toLocaleString();
};

export default function MonthlyPurchaseTable({ data }: MonthlyPurchaseTableProps) {
  const months = useMemo(() => Array.from(new Set(data.map(d => d.month))).sort().reverse(), [data]);

  return (
    <div className="space-y-8">
      {months.map((month) => {
        const monthData = data.filter(d => d.month === month);
        const monthTotal = monthData.reduce((acc, curr) => ({
          totalPurchases: acc.totalPurchases + (Number(curr.totalPurchases) || 0),
          mobilePurchaseAmount: acc.mobilePurchaseAmount + (Number(curr.mobilePurchaseAmount) || 0),
          mobilePurchaseWeight: acc.mobilePurchaseWeight + (Number(curr.mobilePurchaseWeight) || 0),
          flagshipPurchaseWeight: acc.flagshipPurchaseWeight + (Number(curr.flagshipPurchaseWeight) || 0),
        }), { totalPurchases: 0, mobilePurchaseAmount: 0, mobilePurchaseWeight: 0, flagshipPurchaseWeight: 0 });

        return (
          <div key={month} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{month.split('-')[1]}월 매입 실적</span>
              <span className="text-xs text-zinc-400 font-medium">({month.split('-')[0]}년)</span>
            </div>
            
            <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold">
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 w-24 sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900 text-left">창고 그룹 (계층그룹 기준)</th>
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 text-amber-600">총 매입액</th>
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800">모빌매입</th>
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800">매입용량 (L)</th>
                      <th className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800">플래그십 (L)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {monthData.map((row) => (
                      <tr key={`${month}-${row.branch}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 font-bold text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40 text-left">
                          {row.branch}
                        </td>
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums text-amber-600 font-semibold">
                          {formatNumber(row.totalPurchases)}
                        </td>
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right">
                          {formatNumber(row.mobilePurchaseAmount)}
                        </td>
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right">
                          {formatNumber(row.mobilePurchaseWeight)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-right">
                          {formatNumber(row.flagshipPurchaseWeight)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-amber-50/30 dark:bg-amber-900/10 font-bold">
                    <tr>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-center text-amber-700 dark:text-amber-400 sticky left-0 z-10 bg-inherit">합계</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right text-amber-700 dark:text-amber-400">{formatNumber(monthTotal.totalPurchases)}</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right">{formatNumber(monthTotal.mobilePurchaseAmount)}</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right">{formatNumber(monthTotal.mobilePurchaseWeight)}</td>
                      <td className="px-4 py-4 text-right">{formatNumber(monthTotal.flagshipPurchaseWeight)}</td>
                    </tr>
                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/50">
                      <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 sticky left-0 z-10 bg-inherit text-xs">D/M계</td>
                      <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800">-</td>
                      <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800">-</td>
                      <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800 text-right text-xs">{(monthTotal.mobilePurchaseWeight / 200).toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-xs">{(monthTotal.flagshipPurchaseWeight / 200).toFixed(1)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
