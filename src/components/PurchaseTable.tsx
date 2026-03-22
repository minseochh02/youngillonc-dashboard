import { useState, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface PurchaseRowData {
  branch: string;
  totalPurchases: number;
  mobilePurchaseAmount: number;
  mobilePurchaseWeight: number;
  flagshipPurchaseWeight: number;
  isTotal?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'branch' | 'totalPurchases' | 'mobilePurchaseAmount' | 'mobilePurchaseWeight' | 'flagshipPurchaseWeight';

interface SortState {
  column: SortColumn | null;
  direction: SortDirection;
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return Math.round(num).toLocaleString();
};

export default function PurchaseTable({ data }: { data: PurchaseRowData[] }) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });

  const handleSort = (column: SortColumn) => {
    setSortState(prev => {
      if (prev.column !== column) return { column, direction: 'desc' };
      if (prev.direction === 'desc') return { column, direction: 'asc' };
      return { column: null, direction: null };
    });
  };

  const sortedData = useMemo(() => {
    const dataToSort = data.filter(d => !d.isTotal);
    if (sortState.column && sortState.direction) {
      return [...dataToSort].sort((a, b) => {
        const aVal = a[sortState.column!];
        const bVal = b[sortState.column!];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const comp = typeof aVal === 'number' && typeof bVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
        return sortState.direction === 'asc' ? comp : -comp;
      });
    }
    return dataToSort;
  }, [data, sortState]);

  const displayData = useMemo(() => {
    const totals = data.filter(d => d.isTotal);
    return [...sortedData, ...totals];
  }, [sortedData, data]);

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortState.column !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortState.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-center border-separate border-spacing-0">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900">
              <th onClick={() => handleSort('branch')} className="cursor-pointer sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-bold">
                <div className="flex items-center justify-center gap-1">창고 그룹 (계층그룹 기준) <SortIcon col="branch" /></div>
              </th>
              <th onClick={() => handleSort('totalPurchases')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 text-amber-600 font-bold">
                <div className="flex items-center justify-center gap-1">총매입액 <SortIcon col="totalPurchases" /></div>
              </th>
              <th onClick={() => handleSort('mobilePurchaseAmount')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                <div className="flex items-center justify-center gap-1">모빌매입 <SortIcon col="mobilePurchaseAmount" /></div>
              </th>
              <th onClick={() => handleSort('mobilePurchaseWeight')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                <div className="flex items-center justify-center gap-1">매입용량 (L) <SortIcon col="mobilePurchaseWeight" /></div>
              </th>
              <th onClick={() => handleSort('flagshipPurchaseWeight')} className="cursor-pointer px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                <div className="flex items-center justify-center gap-1">플래그십 (L) <SortIcon col="flagshipPurchaseWeight" /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {displayData.map((row, idx) => (
              <tr key={idx} className={`${row.isTotal ? 'bg-amber-50/30 dark:bg-amber-900/10 font-bold' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'}`}>
                <td className="sticky left-0 z-10 px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 bg-inherit font-bold text-left">{row.branch}</td>
                <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums text-amber-600">{formatNumber(row.totalPurchases)}</td>
                <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">{formatNumber(row.mobilePurchaseAmount)}</td>
                <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">{formatNumber(row.mobilePurchaseWeight)}</td>
                <td className="px-4 py-4 text-right tabular-nums">{formatNumber(row.flagshipPurchaseWeight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
