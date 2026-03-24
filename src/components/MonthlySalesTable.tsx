import { useMemo } from 'react';
import DataLogicInfo from "./DataLogicInfo";

interface MonthlySalesRow {
  month: string;
  branch: string;
  totalSales: number;
  totalSalesWeight: number;
  mobileSalesAmount: number;
  mobileSalesWeight: number;
  flagshipSalesAmount: number;
  flagshipSalesWeight: number;
}

interface MonthlySalesTableProps {
  data: MonthlySalesRow[];
  title?: string;
  groupingLabel?: string;
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return Math.round(num).toLocaleString();
};

export default function MonthlySalesTable({ data, title = "매출 실적", groupingLabel = "사업소" }: MonthlySalesTableProps) {
  // Group data by month and sort them
  const months = useMemo(() => Array.from(new Set(data.map(d => d.month))).sort().reverse(), [data]);
  const maxSales = useMemo(() => Math.max(...data.map(d => d.totalSales || 0), 1), [data]);

  return (
    <div className="space-y-8">
      {months.map((month) => {
        const monthData = data.filter(d => d.month === month);
        const monthTotal = monthData.reduce((acc, curr) => ({
          totalSales: acc.totalSales + (Number(curr.totalSales) || 0),
          totalSalesWeight: acc.totalSalesWeight + (Number(curr.totalSalesWeight) || 0),
          mobileSalesAmount: acc.mobileSalesAmount + (Number(curr.mobileSalesAmount) || 0),
          mobileSalesWeight: acc.mobileSalesWeight + (Number(curr.mobileSalesWeight) || 0),
          flagshipSalesAmount: acc.flagshipSalesAmount + (Number(curr.flagshipSalesAmount) || 0),
          flagshipSalesWeight: acc.flagshipSalesWeight + (Number(curr.flagshipSalesWeight) || 0),
        }), { 
          totalSales: 0, totalSalesWeight: 0, 
          mobileSalesAmount: 0, mobileSalesWeight: 0, 
          flagshipSalesAmount: 0, flagshipSalesWeight: 0 
        });

        return (
          <div key={month} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{month.split('-')[1]}월 {title}</span>
              <span className="text-xs text-zinc-400 font-medium">({month.split('-')[0]}년)</span>
            </div>
            
            <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold">
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 w-24 sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900">{groupingLabel}</th>
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 text-blue-600">총 매출액</th>
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800">총판매량 (L)</th>
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800">모빌매출</th>
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800">모빌판매량 (L)</th>
                      <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 text-red-600">플래그십금액</th>
                      <th className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 text-red-600">플래그십용량 (L)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {monthData.map((row) => (
                      <tr key={`${month}-${row.branch}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 font-bold text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40">
                          {row.branch}
                        </td>
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums text-blue-600 font-semibold">
                          {formatNumber(row.totalSales)}
                        </td>
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right">
                          {formatNumber(row.totalSalesWeight)}
                        </td>
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right">
                          {formatNumber(row.mobileSalesAmount)}
                        </td>
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right">
                          {formatNumber(row.mobileSalesWeight)}
                        </td>
                        <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-red-600">
                          {formatNumber(row.flagshipSalesAmount)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-right text-red-600">
                          {formatNumber(row.flagshipSalesWeight)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-50/30 dark:bg-blue-900/10 font-bold">
                    <tr>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-center text-blue-700 dark:text-blue-400 sticky left-0 z-10 bg-inherit">합계</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right text-blue-700 dark:text-blue-400">{formatNumber(monthTotal.totalSales)}</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">{formatNumber(monthTotal.totalSalesWeight)}</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right">{formatNumber(monthTotal.mobileSalesAmount)}</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">{formatNumber(monthTotal.mobileSalesWeight)}</td>
                      <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right text-red-600">{formatNumber(monthTotal.flagshipSalesAmount)}</td>
                      <td className="px-4 py-4 text-right text-red-600">{formatNumber(monthTotal.flagshipSalesWeight)}</td>
                    </tr>
                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/50">
                      <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 sticky left-0 z-10 bg-inherit text-xs">D/M계</td>
                      <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800">-</td>
                      <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800">-</td>
                      <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800 text-right text-xs">{(monthTotal.mobileSalesWeight / 200).toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-xs">{(monthTotal.flagshipSalesWeight / 200).toFixed(1)}</td>
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
