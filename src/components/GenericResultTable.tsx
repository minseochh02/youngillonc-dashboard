/**
 * Generic Result Table Component
 *
 * Universal table component for displaying query results.
 * Follows existing design patterns with dark mode support.
 */

interface GenericResultTableProps {
  rows: any[];
  columns: string[];
  title?: string;
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

export default function GenericResultTable({ rows, columns, title }: GenericResultTableProps) {
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
                {columns.map((col, idx) => (
                  <th
                    key={col}
                    className={`
                      px-4 py-4 text-center font-semibold text-zinc-900 dark:text-zinc-100
                      border-b border-zinc-200 dark:border-zinc-800
                      ${idx === 0 ? 'sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900' : ''}
                      ${idx !== columns.length - 1 ? 'border-r border-zinc-200 dark:border-zinc-800' : ''}
                    `}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="group transition-all duration-200 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                >
                  {columns.map((col, colIdx) => {
                    const type = columnTypes[col];
                    let cellClassName = 'px-4 py-3 ';

                    if (colIdx === 0) {
                      cellClassName += 'sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40 font-medium text-zinc-900 dark:text-zinc-100 ';
                    }

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

                    return (
                      <td key={col} className={cellClassName}>
                        {formatValue(row[col])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {rows.length >= 100 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
          상위 {rows.length}개 결과만 표시됩니다. 더 구체적인 조건을 추가하면 정확한 결과를 얻을 수 있습니다.
        </p>
      )}
    </div>
  );
}
