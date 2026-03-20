"use client";

interface QuarterData {
  quarter: string;
  actual: number;
  previousYear: number;
}

interface BreakdownItem {
  category: string;
  quarters: QuarterData[];
}

interface QuarterlyTableProps {
  breakdown: BreakdownItem[];
  targets: Record<string, Record<string, number>>; // { category: { quarter: target } }
  onTargetChange: (category: string, quarter: string, value: number) => void;
}

export default function QuarterlyTable({ breakdown, targets, onTargetChange }: QuarterlyTableProps) {
  const formatNumber = (num: number) => {
    return Math.round(num).toLocaleString();
  };

  const getAchievementColor = (achievement: number) => {
    if (achievement >= 100) return 'text-green-600 dark:text-green-400';
    if (achievement >= 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getYoYColor = (yoy: number) => {
    if (yoy > 0) return 'text-green-600 dark:text-green-400';
    if (yoy < 0) return 'text-red-600 dark:text-red-400';
    return 'text-zinc-500 dark:text-zinc-400';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-800/50">
          <tr>
            <th rowSpan={2} className="py-3 px-4 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider align-bottom">
              구분
            </th>
            {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
              <th key={q} colSpan={5} className="py-2 px-4 text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {q}
              </th>
            ))}
          </tr>
          <tr>
            {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
              <>
                <th className="py-2 px-3 text-center text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
                  목표
                </th>
                <th className="py-2 px-3 text-right text-xs font-bold text-blue-500 uppercase tracking-wider">
                  실적
                </th>
                <th className="py-2 px-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  달성율
                </th>
                <th className="py-2 px-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  전년
                </th>
                <th className="py-2 px-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  전년대비
                </th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {breakdown.map((item) => (
            <tr
              key={item.category}
              className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
            >
              <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                {item.category}
              </td>
              {item.quarters.map(q => {
                const target = targets[item.category]?.[q.quarter] || 0;
                const achievement = target > 0 ? (q.actual / target * 100) : 0;
                const yoy = q.previousYear > 0
                  ? ((q.actual - q.previousYear) / q.previousYear * 100)
                  : 0;

                return (
                  <>
                    {/* Target (Editable) */}
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={target || ''}
                        onChange={(e) => onTargetChange(item.category, q.quarter, Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-2 py-1 text-right bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-zinc-800 dark:text-zinc-200 font-mono"
                      />
                    </td>
                    {/* Actual */}
                    <td className="py-3 px-3 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                      {formatNumber(q.actual)}
                    </td>
                    {/* Achievement % */}
                    <td className="py-3 px-3 text-right">
                      <span className={`font-bold ${getAchievementColor(achievement)}`}>
                        {target > 0 ? `${achievement.toFixed(1)}%` : '-'}
                      </span>
                    </td>
                    {/* Previous Year */}
                    <td className="py-3 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(q.previousYear)}
                    </td>
                    {/* YoY % */}
                    <td className="py-3 px-3 text-right font-mono">
                      <span className={getYoYColor(yoy)}>
                        {q.previousYear > 0 ? `${yoy > 0 ? '+' : ''}${yoy.toFixed(1)}%` : '-'}
                      </span>
                    </td>
                  </>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
