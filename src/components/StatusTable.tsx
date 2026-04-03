import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface StatusRowData {
  branch: string;
  amount: number;
  weight: number;
  mobileAmount: number;
  mobileWeight: number;
  flagshipAmount: number;
  flagshipWeight: number;
  isTotal?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'branch' | 'amount' | 'weight' | 'mobileAmount' | 'mobileWeight' | 'flagshipAmount' | 'flagshipWeight';

interface SortState {
  column: SortColumn | null;
  direction: SortDirection;
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return Math.round(num).toLocaleString();
};

interface StatusTableProps {
  data: any[];
  title: string;
  type: 'sales' | 'purchase';
  groupingLabel: string;
  amountKey: string;
  weightKey: string;
  mobileAmountKey: string;
  mobileWeightKey: string;
  flagshipAmountKey: string;
  flagshipWeightKey: string;
}

export default function StatusTable({ 
  data, 
  title, 
  type, 
  groupingLabel,
  amountKey,
  weightKey,
  mobileAmountKey,
  mobileWeightKey,
  flagshipAmountKey,
  flagshipWeightKey
}: StatusTableProps) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });

  const mappedData = useMemo(() => {
    return data.map(d => ({
      branch: d.branch,
      amount: Number(d[amountKey]) || 0,
      weight: Number(d[weightKey]) || 0,
      mobileAmount: Number(d[mobileAmountKey]) || 0,
      mobileWeight: Number(d[mobileWeightKey]) || 0,
      flagshipAmount: Number(d[flagshipAmountKey]) || 0,
      flagshipWeight: Number(d[flagshipWeightKey]) || 0,
      isTotal: d.isTotal
    }));
  }, [data, amountKey, weightKey, mobileAmountKey, mobileWeightKey, flagshipAmountKey, flagshipWeightKey]);

  const handleSort = (column: SortColumn) => {
    setSortState(prev => {
      if (prev.column !== column) return { column, direction: 'desc' };
      if (prev.direction === 'desc') return { column, direction: 'asc' };
      return { column: null, direction: null };
    });
  };

  const sortedData = useMemo(() => {
    const dataToSort = mappedData.filter(d => !d.isTotal);
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
  }, [mappedData, sortState]);

  const displayData = useMemo(() => {
    const totals = mappedData.filter(d => d.isTotal);
    return [...sortedData, ...totals];
  }, [sortedData, mappedData]);

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortState.column !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortState.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  const accentColor = type === 'sales' ? 'text-blue-600' : 'text-amber-600';
  const bgColor = type === 'sales' ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'bg-amber-50/30 dark:bg-amber-900/10';

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">{title}</h4>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-separate border-spacing-0">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                <th onClick={() => handleSort('branch')} className="cursor-pointer sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-bold">
                  <div className="flex items-center justify-center gap-1">{groupingLabel} <SortIcon col="branch" /></div>
                </th>
                <th onClick={() => handleSort('amount')} className={`cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 ${accentColor} font-bold`}>
                  <div className="flex items-center justify-center gap-1">총액 <SortIcon col="amount" /></div>
                </th>
                <th onClick={() => handleSort('weight')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                  <div className="flex items-center justify-center gap-1">총량 (L) <SortIcon col="weight" /></div>
                </th>
                <th onClick={() => handleSort('mobileAmount')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                  <div className="flex items-center justify-center gap-1">모빌금액 <SortIcon col="mobileAmount" /></div>
                </th>
                <th onClick={() => handleSort('mobileWeight')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                  <div className="flex items-center justify-center gap-1">모빌량 (L) <SortIcon col="mobileWeight" /></div>
                </th>
                <th onClick={() => handleSort('flagshipAmount')} className="cursor-pointer px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 font-semibold text-red-600">
                  <div className="flex items-center justify-center gap-1">플래그십금액 <SortIcon col="flagshipAmount" /></div>
                </th>
                <th onClick={() => handleSort('flagshipWeight')} className="cursor-pointer px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-red-600">
                  <div className="flex items-center justify-center gap-1">플래그십량 (L) <SortIcon col="flagshipWeight" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {displayData.map((row, idx) => (
                <tr key={idx} className={`${row.isTotal ? `${bgColor} font-bold` : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'}`}>
                  <td className="sticky left-0 z-10 px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 bg-inherit font-bold text-left">{row.branch}</td>
                  <td className={`px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums ${accentColor}`}>{formatNumber(row.amount)}</td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">{formatNumber(row.weight)}</td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">{formatNumber(row.mobileAmount)}</td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">{formatNumber(row.mobileWeight)}</td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums text-red-600">{formatNumber(row.flagshipAmount)}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-red-600">{formatNumber(row.flagshipWeight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
