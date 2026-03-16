/**
 * Generic Result Table Component
 *
 * Universal table component for displaying query results.
 * Follows existing design patterns with dark mode support.
 */

import { useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronUp, ChevronDown } from 'lucide-react';

interface GenericResultTableProps {
  rows: any[];
  columns: string[];
  title?: string;
  queryKey?: string; // Unique identifier for this query (e.g., SQL or intent)
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (value === 0) return '-';

  // Check if it's a number
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  // Check if it's a string that looks like a number
  if (typeof value === 'string') {
    const numValue = parseFloat(value.replace(/,/g, ''));
    if (!isNaN(numValue) && value.match(/^[\d,.-]+$/)) {
      return numValue.toLocaleString();
    }
  }

  return String(value);
};

const getColumnType = (columnName: string, values: any[]): 'amount' | 'date' | 'flag' | 'text' => {
  const lowerName = columnName.toLowerCase();

  // Amount columns
  if (lowerName.includes('금액') || lowerName.includes('매출') || lowerName.includes('수량') ||
      lowerName.includes('중량') || lowerName.includes('단가') || lowerName.includes('합계') ||
      lowerName.includes('액') ||
      lowerName.includes('amount') || lowerName.includes('sales') || lowerName.includes('price')) {
    return 'amount';
  }

  // Date columns
  if (lowerName.includes('일자') || lowerName.includes('날짜') || lowerName.includes('date')) {
    return 'date';
  }

  // Flag columns (boolean-like)
  const firstValue = values.find(v => v !== null && v !== undefined);
  if (firstValue !== undefined && (firstValue === 0 || firstValue === 1 || firstValue === true || firstValue === false)) {
    return 'flag';
  }

  return 'text';
};

const SORT_STORAGE_KEY = 'table-sort-preferences';

// Create a unique hash for a row based on stable identifier columns (first column only)
// This ensures the hash doesn't change when amounts/numbers update
function getRowHash(row: any, columns: string[]): string {
  // Use only the first column as the stable identifier
  return String(row[columns[0]] ?? '');
}

export default function GenericResultTable({ rows, columns, title, queryKey }: GenericResultTableProps) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [customRowOrder, setCustomRowOrder] = useState<number[]>([]);

  // Load saved sort preferences on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SortState;
        // Only apply if the saved column exists in current columns
        if (parsed.column && columns.includes(parsed.column)) {
          setSortState(parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load sort preferences:', error);
    }
  }, [columns]);

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
    if (rows.length > 0 && queryKey) {
      const storageKey = `table-row-order:${queryKey}`;
      const currentHashes = rows.map(row => getRowHash(row, columns));

      console.log('🔍 Loading order for queryKey:', queryKey);
      console.log('Current hashes:', currentHashes);

      try {
        const saved = localStorage.getItem(storageKey);
        console.log('Saved data:', saved);

        if (saved) {
          const savedHashes = JSON.parse(saved) as string[];
          console.log('Saved hashes:', savedHashes);

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

          console.log('Computed new order:', newOrder);

          if (newOrder.length === rows.length) {
            setCustomRowOrder(newOrder);
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to load row order:', error);
      }

      // Default: sequential order
      console.log('Using default sequential order');
      setCustomRowOrder(rows.map((_, idx) => idx));
    } else {
      // No queryKey: reset to sequential
      setCustomRowOrder(rows.map((_, idx) => idx));
    }
  }, [rows, queryKey, columns]);

  // Save custom row order when it changes (save as hashes, not indices)
  useEffect(() => {
    if (customRowOrder.length > 0 && queryKey && rows.length > 0) {
      const storageKey = `table-row-order:${queryKey}`;
      try {
        // Save row hashes in the custom order
        const orderedHashes = customRowOrder.map(idx => getRowHash(rows[idx], columns));
        console.log('💾 Saving order for queryKey:', queryKey);
        console.log('Order being saved:', orderedHashes);
        localStorage.setItem(storageKey, JSON.stringify(orderedHashes));
      } catch (error) {
        console.warn('Failed to save row order:', error);
      }
    }
  }, [customRowOrder, queryKey]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">조건에 맞는 데이터가 없습니다.</p>
      </div>
    );
  }

  // Determine column types based on data
  const columnTypes = columns.reduce((acc, col) => {
    const columnValues = rows.map(row => row[col]);
    acc[col] = getColumnType(col, columnValues);
    return acc;
  }, {} as Record<string, string>);

  // Handle column header click
  const handleSort = (column: string) => {
    setSortState(prev => {
      if (prev.column !== column) {
        // New column: start with descending for amounts, ascending for others
        const isAmount = columnTypes[column] === 'amount';
        return { column, direction: isAmount ? 'desc' : 'asc' };
      } else {
        // Same column: cycle through asc -> desc -> null
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { column: null, direction: null };
        } else {
          const isAmount = columnTypes[column] === 'amount';
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
  const sortedRows = useMemo(() => {
    if (sortState.column && sortState.direction) {
      // Apply column sort
      return [...rows].sort((a, b) => {
        const aVal = a[sortState.column!];
        const bVal = b[sortState.column!];

        // Handle null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Convert to numbers if possible
        const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/,/g, ''));
        const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/,/g, ''));

        let comparison = 0;
        if (!isNaN(aNum) && !isNaN(bNum)) {
          comparison = aNum - bNum;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortState.direction === 'asc' ? comparison : -comparison;
      });
    } else if (customRowOrder.length === rows.length) {
      // Apply custom manual order
      return customRowOrder.map(idx => rows[idx]);
    } else {
      // Default order
      return rows;
    }
  }, [rows, sortState, customRowOrder]);

  return (
    <div className="space-y-4">
      {title && (
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-200/20 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                {/* Row reorder column header */}
                <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-2 py-4 border-b border-r border-zinc-200 dark:border-zinc-800 w-16">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">순서</span>
                </th>
                {columns.map((col, idx) => {
                  const isSorted = sortState.column === col;
                  const sortIcon = isSorted ? (
                    sortState.direction === 'asc' ? (
                      <ArrowUp className="w-4 h-4 inline-block ml-1" />
                    ) : (
                      <ArrowDown className="w-4 h-4 inline-block ml-1" />
                    )
                  ) : (
                    <ArrowUpDown className="w-4 h-4 inline-block ml-1 opacity-0 group-hover:opacity-40" />
                  );

                  return (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className={`
                        group cursor-pointer select-none
                        px-4 py-4 text-center font-semibold text-zinc-900 dark:text-zinc-100
                        border-b border-zinc-200 dark:border-zinc-800
                        hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors
                        ${idx !== columns.length - 1 ? 'border-r border-zinc-200 dark:border-zinc-800' : ''}
                      `}
                    >
                      <span className="inline-flex items-center">
                        {col}
                        {sortIcon}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sortedRows.map((row, rowIdx) => {
                const isFirstRow = rowIdx === 0;
                const isLastRow = rowIdx === sortedRows.length - 1;
                const canManuallyReorder = !sortState.column; // Only allow manual reorder when no column sort is active

                return (
                  <tr
                    key={rowIdx}
                    className="group transition-all duration-200 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                  >
                    {/* Row reorder buttons */}
                    <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40 px-2 py-3 border-r border-zinc-200 dark:border-zinc-800">
                      {canManuallyReorder ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => moveRowUp(rowIdx)}
                            disabled={isFirstRow}
                            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="위로 이동"
                          >
                            <ChevronUp className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                          </button>
                          <button
                            onClick={() => moveRowDown(rowIdx)}
                            disabled={isLastRow}
                            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="아래로 이동"
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-400 dark:text-zinc-600 text-center">
                          {rowIdx + 1}
                        </div>
                      )}
                    </td>
                    {columns.map((col, colIdx) => {
                      const type = columnTypes[col];
                      let cellClassName = 'px-4 py-3 ';

                      if (colIdx !== columns.length - 1) {
                        cellClassName += 'border-r border-zinc-200 dark:border-zinc-800 ';
                      }

                      // Type-specific styling
                      if (type === 'amount') {
                        cellClassName += 'text-right tabular-nums text-blue-600 dark:text-blue-400';
                      } else if (type === 'date') {
                        cellClassName += 'text-center tabular-nums text-zinc-600 dark:text-zinc-300';
                      } else if (type === 'flag') {
                        cellClassName += 'text-center text-emerald-600 dark:text-emerald-400';
                      } else {
                        cellClassName += 'text-left text-zinc-700 dark:text-zinc-300';
                      }

                      if (colIdx === 0) {
                        cellClassName += ' font-medium text-zinc-900 dark:text-zinc-100';
                      }

                      return (
                        <td key={col} className={cellClassName}>
                          {formatValue(row[col])}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sortedRows.length >= 100 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
          상위 {sortedRows.length}개 결과만 표시됩니다. 더 구체적인 조건을 추가하면 정확한 결과를 얻을 수 있습니다.
        </p>
      )}
    </div>
  );
}
