import { useState, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import DataLogicInfo from "./DataLogicInfo";

interface SalesRowData {
  id: string;
  branch: string;
  totalSales: number;
  mobileSalesAmount: number;
  mobileSalesWeight: number;
  flagshipSalesWeight: number;
  mobilePurchaseWeight: number;
  flagshipPurchaseWeight: number;
  isTotal?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'branch' | 'totalSales' | 'mobileSalesAmount' | 'mobileSalesWeight' | 'flagshipSalesWeight' | 'mobilePurchaseWeight' | 'flagshipPurchaseWeight';

interface SortState {
  column: SortColumn | null;
  direction: SortDirection;
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return num.toLocaleString();
};

interface SalesTableProps {
  data: SalesRowData[];
  queryKey?: string;
}

const SORT_STORAGE_KEY = 'sales-table-sort';

function getRowHash(row: SalesRowData): string {
  return row.branch;
}

export default function SalesTable({ data, queryKey }: SalesTableProps) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [customRowOrder, setCustomRowOrder] = useState<number[]>([]);

  // Use data from props, and calculate totals if not provided or to ensure accuracy
  const tableData = data && data.length > 0 ? data : [];
  const maxSales = Math.max(...tableData.filter(d => !d.isTotal).map(d => d.totalSales || 0), 1);

  // Load saved sort preferences on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SortState;
        setSortState(parsed);
      }
    } catch (error) {
      console.warn('Failed to load sort preferences:', error);
    }
  }, []);

  // Save sort preferences to localStorage
  useEffect(() => {
    if (sortState.column) {
      try {
        localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sortState));
      } catch (error) {
        console.warn('Failed to save sort preferences:', error);
      }
    }
  }, [sortState]);

  // Load custom row order with queryKey using row hashes
  useEffect(() => {
    if (tableData.length > 0 && queryKey) {
      const storageKey = `sales-table-row-order:${queryKey}`;
      const currentHashes = tableData.map(row => getRowHash(row));

      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const savedHashes = JSON.parse(saved) as string[];

          // Map saved hashes to current row indices
          const newOrder: number[] = [];
          const usedIndices = new Set<number>();

          // First, add rows in saved order
          for (const hash of savedHashes) {
            const idx = currentHashes.findIndex((h, i) => h === hash && !usedIndices.has(i));
            if (idx !== -1) {
              newOrder.push(idx);
              usedIndices.add(idx);
            }
          }

          // Then add any new rows that weren't in saved order
          currentHashes.forEach((hash, idx) => {
            if (!usedIndices.has(idx)) {
              newOrder.push(idx);
            }
          });

          if (newOrder.length === tableData.length) {
            setCustomRowOrder(newOrder);
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to load row order:', error);
      }

      // Default: sequential order
      setCustomRowOrder(tableData.map((_, idx) => idx));
    } else {
      // No queryKey: reset to sequential
      setCustomRowOrder(tableData.map((_, idx) => idx));
    }
  }, [tableData, queryKey]);

  // Save custom row order when it changes
  useEffect(() => {
    if (customRowOrder.length > 0 && queryKey && tableData.length > 0) {
      const storageKey = `sales-table-row-order:${queryKey}`;
      try {
        const orderedHashes = customRowOrder.map(idx => getRowHash(tableData[idx]));
        localStorage.setItem(storageKey, JSON.stringify(orderedHashes));
      } catch (error) {
        console.warn('Failed to save row order:', error);
      }
    }
  }, [customRowOrder, queryKey]);

  // Handle column header click
  const handleSort = (column: SortColumn) => {
    setSortState(prev => {
      if (prev.column !== column) {
        // New column: start with descending for amounts, ascending for branch
        const isAmount = column !== 'branch';
        return { column, direction: isAmount ? 'desc' : 'asc' };
      } else {
        // Same column: cycle through asc -> desc -> null
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { column: null, direction: null };
        } else {
          const isAmount = column !== 'branch';
          return { column, direction: isAmount ? 'desc' : 'asc' };
        }
      }
    });
  };

  // Move row up in custom order
  const moveRowUp = (displayIndex: number) => {
    if (displayIndex === 0) return;
    setCustomRowOrder(prev => {
      const newOrder = [...prev];
      [newOrder[displayIndex - 1], newOrder[displayIndex]] = [newOrder[displayIndex], newOrder[displayIndex - 1]];
      return newOrder;
    });
  };

  // Move row down in custom order
  const moveRowDown = (displayIndex: number) => {
    if (displayIndex === customRowOrder.length - 1) return;
    setCustomRowOrder(prev => {
      const newOrder = [...prev];
      [newOrder[displayIndex], newOrder[displayIndex + 1]] = [newOrder[displayIndex + 1], newOrder[displayIndex]];
      return newOrder;
    });
  };

  // Sort rows based on current sort state or custom order
  const sortedData = useMemo(() => {
    if (sortState.column && sortState.direction) {
      // Apply column sort
      return [...tableData].sort((a, b) => {
        const aVal = a[sortState.column!];
        const bVal = b[sortState.column!];

        // Handle null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortState.direction === 'asc' ? comparison : -comparison;
      });
    } else if (customRowOrder.length === tableData.length) {
      // Apply custom manual order
      return customRowOrder.map(idx => tableData[idx]);
    } else {
      // Default order
      return tableData;
    }
  }, [tableData, sortState, customRowOrder]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-200/20 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-separate border-spacing-0">
            <thead>
              {/* Primary Category Header */}
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                <th rowSpan={2} className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-2 border-r border-b border-zinc-200 dark:border-zinc-800 w-16">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">순서</span>
                </th>
                <th rowSpan={2} onClick={() => handleSort('branch')} className="group cursor-pointer sticky left-16 z-20 bg-zinc-50 dark:bg-zinc-900 px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <span className="inline-flex items-center gap-1">
                    사업소
                    {sortState.column === 'branch' ? (
                      sortState.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 opacity-0 group-hover:opacity-40" />
                    )}
                  </span>
                </th>
                <th rowSpan={2} onClick={() => handleSort('totalSales')} className="group cursor-pointer px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 font-bold min-w-[160px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <span className="inline-flex items-center gap-1">
                    총매출액
                    {sortState.column === 'totalSales' ? (
                      sortState.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 opacity-0 group-hover:opacity-40" />
                    )}
                  </span>
                </th>
                <th colSpan={3} className="px-4 py-3 border-r border-b border-zinc-200 dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 font-semibold tracking-wide">모빌제품 매출액 및 중량</th>
                <th colSpan={2} className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 font-semibold tracking-wide">모빌제품 구매 중량</th>
              </tr>
              {/* Secondary Header (Sub-categories) */}
              <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th onClick={() => handleSort('mobileSalesAmount')} className="group cursor-pointer px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <span className="inline-flex items-center gap-1">
                    매출액
                    {sortState.column === 'mobileSalesAmount' ? (
                      sortState.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40" />
                    )}
                  </span>
                </th>
                <th onClick={() => handleSort('mobileSalesWeight')} className="group cursor-pointer px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <span className="inline-flex items-center gap-1">
                    판매 중량
                    {sortState.column === 'mobileSalesWeight' ? (
                      sortState.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40" />
                    )}
                  </span>
                </th>
                <th onClick={() => handleSort('flagshipSalesWeight')} className="group cursor-pointer px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <span className="inline-flex items-center gap-1">
                    플래그십
                    {sortState.column === 'flagshipSalesWeight' ? (
                      sortState.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40" />
                    )}
                  </span>
                </th>
                <th onClick={() => handleSort('mobilePurchaseWeight')} className="group cursor-pointer px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <span className="inline-flex items-center gap-1">
                    구매 중량
                    {sortState.column === 'mobilePurchaseWeight' ? (
                      sortState.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40" />
                    )}
                  </span>
                </th>
                <th onClick={() => handleSort('flagshipPurchaseWeight')} className="group cursor-pointer px-3 py-3 border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <span className="inline-flex items-center gap-1">
                    플래그십
                    {sortState.column === 'flagshipPurchaseWeight' ? (
                      sortState.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40" />
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sortedData.map((row, idx) => {
                const isFirstRow = idx === 0;
                const isLastRow = idx === sortedData.length - 1;
                const canManuallyReorder = !sortState.column;

                return (
                <tr
                  key={row.id || idx}
                  className={`
                    group transition-all duration-200
                    ${row.isTotal ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'}
                  `}
                >
                  {/* Row reorder buttons */}
                  <td className={`
                    sticky left-0 z-10 px-2 py-3 border-r border-zinc-200 dark:border-zinc-800
                    ${row.isTotal ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40'}
                  `}>
                    {canManuallyReorder && !row.isTotal ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => moveRowUp(idx)}
                          disabled={isFirstRow}
                          className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="위로 이동"
                        >
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                        </button>
                        <button
                          onClick={() => moveRowDown(idx)}
                          disabled={isLastRow}
                          className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="아래로 이동"
                        >
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-400 dark:text-zinc-600 text-center">
                        {idx + 1}
                      </div>
                    )}
                  </td>
                  <td className={`
                    sticky left-16 z-10 px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-sm font-bold
                    ${row.isTotal ? 'bg-blue-50/30 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40'}
                  `}>
                    {row.branch}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`tabular-nums font-bold ${row.isTotal ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {formatNumber(row.totalSales)}
                      </span>
                      {!row.isTotal && (
                        <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500/50 rounded-full" 
                            style={{ width: `${(row.totalSales / maxSales) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-600 dark:text-zinc-300">
                    {formatNumber(row.mobileSalesAmount)}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-600 dark:text-zinc-300">
                    {formatNumber(row.mobileSalesWeight)}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-500 dark:text-zinc-400">
                    {formatNumber(row.flagshipSalesWeight)}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-amber-600/80 dark:text-amber-400/80">
                    {formatNumber(row.mobilePurchaseWeight)}
                  </td>
                  <td className="px-4 py-4 tabular-nums text-right text-amber-500/70 dark:text-amber-500/50">
                    {formatNumber(row.flagshipPurchaseWeight)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DataLogicInfo 
        title="매출현황"
        description="판매 및 구매 현황 데이터를 기반으로 지사별 핵심 성과 지표를 실시간으로 추출합니다."
        steps={[
          "사업소 통합: '사업소', '지사' 명칭을 제거하고 '화성', '창원' 등 핵심 명칭으로 데이터를 자동 병합합니다.",
          "수치 정밀화: 데이터베이스 내 콤마(,)가 포함된 텍스트 수치를 실제 계산 가능한 숫자로 변환하여 오차 없는 합계를 산출합니다.",
          "Mobil 전용 필터: 품목 그룹 코드가 IL, PVL, MB, CVL, AVI, MAR인 핵심 모빌 브랜드 제품만 선별하여 집계합니다.",
          "플래그십 식별: 내부 관리 코드 'FLA'가 지정된 고부가가치 제품군의 중량을 별도로 분리하여 표시합니다."
        ]}
      />
    </div>
  );
}
