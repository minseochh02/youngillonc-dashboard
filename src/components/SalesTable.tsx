import { useState, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface SalesRowData {
  id: string;
  branch: string;
  totalSales: number;
  mobileSalesAmount: number;
  mobileSalesWeight: number;
  flagshipSalesWeight: number;
  isTotal?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'branch' | 'totalSales' | 'mobileSalesAmount' | 'mobileSalesWeight' | 'flagshipSalesWeight';

interface SortState {
  column: SortColumn | null;
  direction: SortDirection;
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return Math.round(num).toLocaleString();
};

interface SalesTableProps {
  data: SalesRowData[];
}

const SORT_STORAGE_KEY = 'sales-table-sort';

export default function SalesTable({ data }: SalesTableProps) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved) setSortState(JSON.parse(saved));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (sortState.column) localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sortState));
  }, [sortState]);

  const handleSort = (column: SortColumn) => {
    setSortState(prev => {
      if (prev.column !== column) return { column, direction: column === 'branch' ? 'asc' : 'desc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
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
                <div className="flex items-center justify-center gap-1">사업소 <SortIcon col="branch" /></div>
              </th>
              <th onClick={() => handleSort('totalSales')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 text-blue-600 font-bold">
                <div className="flex items-center justify-center gap-1">총매출액 <SortIcon col="totalSales" /></div>
              </th>
              <th onClick={() => handleSort('mobileSalesAmount')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                <div className="flex items-center justify-center gap-1">모빌매출 <SortIcon col="mobileSalesAmount" /></div>
              </th>
              <th onClick={() => handleSort('mobileSalesWeight')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                <div className="flex items-center justify-center gap-1">판매용량 (L) <SortIcon col="mobileSalesWeight" /></div>
              </th>
              <th onClick={() => handleSort('flagshipSalesWeight')} className="cursor-pointer px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                <div className="flex items-center justify-center gap-1">플래그십 (L) <SortIcon col="flagshipSalesWeight" /></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {displayData.map((row, idx) => (
              <tr key={idx} className={`${row.isTotal ? 'bg-blue-50/30 dark:bg-blue-900/10 font-bold' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'}`}>
                <td className="sticky left-0 z-10 px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 bg-inherit font-bold">{row.branch}</td>
                <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums text-blue-600">{formatNumber(row.totalSales)}</td>
                <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">{formatNumber(row.mobileSalesAmount)}</td>
                <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">{formatNumber(row.mobileSalesWeight)}</td>
                <td className="px-4 py-4 text-right tabular-nums">{formatNumber(row.flagshipSalesWeight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
