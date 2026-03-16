"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Loader2, ChevronDown, ChevronUp, Clock, Star, Calendar } from 'lucide-react';
import GenericResultTable from '@/components/GenericResultTable';
import SalesTable from '@/components/SalesTable';
import StarQueryModal from '@/components/StarQueryModal';
import { selectComponent } from '@/lib/component-router';
import { apiFetch } from '@/lib/api';
import { useStarredQueries, type StarredQuery } from '@/hooks/useStarredQueries';
import { regenerateSQLDates } from '@/lib/date-regenerator';
import { extractDatesFromSQL, formatDateRangeDisplay } from '@/lib/date-extractor';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface QueryResult {
  rows: any[];
  columns: string[];
  sql: string;
  intent: string;
  componentHint: string;
}

interface QueryMetadata {
  executionTime: number;
  rowCount: number;
  method: 'template' | 'llm';
  remaining: number;
}

const EXAMPLE_QUERIES = [
  "오늘 창원 매출",
  "이번 달 사업소별 매출 현황",
  "재고가 많은 품목 상위 10개",
  "어제 MB 사업소 수금",
  "모빌 제품 매출 현황",
  "미구매 현황"
];

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const { saveQuery, updateExecutionStats, getQuery } = useStarredQueries();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [metadata, setMetadata] = useState<QueryMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSQL, setShowSQL] = useState(false);
  const [showStarModal, setShowStarModal] = useState(false);
  const [currentQueryData, setCurrentQueryData] = useState<{
    queryText: string;
    sql: string;
    intent: string;
  } | null>(null);
  const [currentDateRange, setCurrentDateRange] = useState<string | null>(null);
  const [baseDate, setBaseDate] = useState<string>(''); // Base date for relative calculations
  const [lastExecutedStarredQuery, setLastExecutedStarredQuery] = useState<StarredQuery | null>(null);

  // Auto-execute starred queries from URL params
  useEffect(() => {
    const executeStarredId = searchParams.get('executeStarred');
    if (executeStarredId) {
      const starredQuery = getQuery(executeStarredId);
      if (starredQuery) {
        setQuery(starredQuery.queryText);
        setLastExecutedStarredQuery(starredQuery);
        executeStoredSQL(starredQuery);
        updateExecutionStats(executeStarredId);
      }
    } else {
      // Reset page when navigating to /dashboard without template
      setLastExecutedStarredQuery(null);
      setQuery('');
      setResult(null);
      setMetadata(null);
      setError(null);
      setCurrentDateRange(null);
      setCurrentQueryData(null);
      setShowSQL(false);
    }
  }, [searchParams]);

  // Re-execute query when base date changes
  useEffect(() => {
    if (lastExecutedStarredQuery && result) {
      // Re-execute the last starred query with new base date
      executeStoredSQL(lastExecutedStarredQuery);
    }
  }, [baseDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLastExecutedStarredQuery(null); // Clear starred query when manually executing
    await executeQuery(query);
  };

  const executeQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setMetadata(null);
    setCurrentDateRange(null);

    try {
      const response = await apiFetch('/api/dashboard/nl-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: queryText })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || '쿼리 실행 중 오류가 발생했습니다.');
        return;
      }

      setResult(data.data);
      setMetadata(data.metadata);

      // Store current query data for starring
      setCurrentQueryData({
        queryText,
        sql: data.data.sql,
        intent: data.data.intent
      });

      // Extract and display date range
      const dates = extractDatesFromSQL(data.data.sql);
      if (dates) {
        setCurrentDateRange(formatDateRangeDisplay(dates.start, dates.end));
      } else {
        setCurrentDateRange(null);
      }

    } catch (err: any) {
      console.error('Query execution error:', err);
      setError('서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const executeStoredSQL = async (starredQuery: StarredQuery) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMetadata(null);
    setCurrentDateRange(null);

    // Regenerate dates based on the base date (or today if not set)
    const updatedSQL = regenerateSQLDates(
      starredQuery.sql,
      starredQuery.relativeDateType,
      baseDate || undefined
    );

    try {
      const response = await apiFetch('/api/dashboard/nl-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: updatedSQL,
          intent: starredQuery.intent
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || '쿼리 실행 중 오류가 발생했습니다.');
        return;
      }

      setResult(data.data);
      setMetadata(data.metadata);

      // Store current query data with updated SQL
      setCurrentQueryData({
        queryText: starredQuery.queryText,
        sql: updatedSQL,
        intent: starredQuery.intent
      });

      // Extract and display date range from updated SQL
      const dates = extractDatesFromSQL(updatedSQL);
      if (dates) {
        setCurrentDateRange(formatDateRangeDisplay(dates.start, dates.end));
      } else {
        setCurrentDateRange(null);
      }

    } catch (err: any) {
      console.error('Query execution error:', err);
      setError('서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
    setLastExecutedStarredQuery(null); // Clear starred query when executing example
    executeQuery(exampleQuery);
  };

  const handleExcelDownload = () => {
    if (!result || !result.rows || result.rows.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    // Convert rows to format with column headers
    const exportData = result.rows.map(row => {
      const formattedRow: Record<string, any> = {};
      result.columns.forEach((col, index) => {
        formattedRow[col] = row[index] ?? row[col];
      });
      return formattedRow;
    });

    const filename = generateFilename('query-result');
    exportToExcel(exportData, filename);
  };

  const renderResults = () => {
    if (!result) return null;

    const componentConfig = selectComponent(result.intent, result.rows);
    const transformedData = componentConfig.transform(result.rows);

    if (componentConfig.component === 'SalesTable') {
      return <SalesTable data={transformedData} queryKey={result.intent} />;
    } else {
      return <GenericResultTable rows={result.rows} columns={result.columns} queryKey={result.intent} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {lastExecutedStarredQuery ? lastExecutedStarredQuery.queryName : '템플릿 추가'}
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          {lastExecutedStarredQuery ? lastExecutedStarredQuery.queryText : 'AI에게 무엇이든 물어보세요'}
        </p>
      </div>

      {/* Base Date Selector */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <Calendar className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          기준일:
        </span>
        <input
          type="date"
          value={baseDate}
          onChange={(e) => setBaseDate(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        {baseDate && (
          <button
            onClick={() => setBaseDate('')}
            disabled={loading}
            className="text-xs px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            오늘로 초기화
          </button>
        )}
        <span className="text-xs text-zinc-500">
          {baseDate
            ? `"오늘", "지난 달" 등이 ${baseDate}을 기준으로 계산됩니다`
            : '"오늘", "지난 달" 등이 오늘을 기준으로 계산됩니다'}
        </span>
        {lastExecutedStarredQuery && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            • 기준일 변경 시 자동 재실행
          </span>
        )}
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 오늘 창원 매출"
            className="w-full h-24 px-4 py-3 pr-12 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-3 bottom-3 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white transition-colors disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {/* Example Queries */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          예시:
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((exampleQuery) => (
            <button
              key={exampleQuery}
              onClick={() => handleExampleClick(exampleQuery)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exampleQuery}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            다른 방식으로 질문해보세요.
          </p>
        </div>
      )}

      {/* Metadata Display */}
      {metadata && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            {currentDateRange && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                baseDate
                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  : 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
              }`}>
                <Calendar className="w-4 h-4" />
                <span>{currentDateRange}</span>
                {baseDate && (
                  <span className="text-xs">(기준: {baseDate})</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{metadata.executionTime}ms</span>
            </div>
            <div className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {(metadata.rowCount ?? 0).toLocaleString()}개 결과
            </div>
            {/* <div className="text-xs text-zinc-500 dark:text-zinc-500">
              남은 쿼리: {metadata.remaining}
            </div> */}
          </div>
          <ExcelDownloadButton
            onClick={handleExcelDownload}
            disabled={!result || !result.rows || result.rows.length === 0}
          />
        </div>
      )}

      {/* Save as Template Button */}
      {currentQueryData && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowStarModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors shadow-sm hover:shadow-md"
          >
            <Star className="w-4 h-4" />
            <span className="font-medium">템플릿 추가</span>
          </button>
        </div>
      )}

      {/* SQL Display (Collapsible) */}
      {result && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
          <button
            onClick={() => setShowSQL(!showSQL)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span>생성된 SQL 쿼리</span>
            {showSQL ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {showSQL && (
            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
              <pre className="text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap">
                {result.sql}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-4">
          {renderResults()}
        </div>
      )}

      {/* Empty State */}
      {!loading && !result && !error && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
          <Search className="w-12 h-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
          <p className="text-zinc-500 dark:text-zinc-400">
            쿼리를 입력하거나 예시 쿼리를 클릭해보세요
          </p>
        </div>
      )}

      {/* Template Modal */}
      {showStarModal && currentQueryData && (
        <StarQueryModal
          isOpen={showStarModal}
          onClose={() => setShowStarModal(false)}
          queryText={currentQueryData.queryText}
          sql={currentQueryData.sql}
          intent={currentQueryData.intent}
          onSave={(name, tags) => {
            saveQuery({
              queryText: currentQueryData.queryText,
              queryName: name,
              tags,
              sql: currentQueryData.sql,
              intent: currentQueryData.intent,
            });
            setShowStarModal(false);
          }}
        />
      )}
    </div>
  );
}
