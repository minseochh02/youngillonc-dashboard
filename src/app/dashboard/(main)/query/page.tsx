"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Loader2, ChevronDown, ChevronUp, Clock, Star } from 'lucide-react';
import GenericResultTable from '@/components/GenericResultTable';
import SalesTable from '@/components/SalesTable';
import StarQueryModal from '@/components/StarQueryModal';
import { selectComponent } from '@/lib/component-router';
import { apiFetch } from '@/lib/api';
import { useStarredQueries } from '@/hooks/useStarredQueries';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface SingleResult {
  title: string;
  description?: string;
  rows: any[];
  columns: string[];
  sql: string;
  intent: string;
  componentHint: string;
}

interface QueryResult {
  // New format (array of results)
  results?: SingleResult[];

  // Old format (backward compatibility)
  rows?: any[];
  columns?: string[];
  sql?: string;
  intent?: string;
  componentHint?: string;
}

interface QueryMetadata {
  executionTime: number;
  totalRowCount?: number;
  rowCount?: number;
  queries?: number;
  method: 'template' | 'llm' | 'ai';
  remaining: number;
  errors?: string[];
}

const EXAMPLE_QUERIES = [
  "오늘 창원 매출",
  "이번 달 사업소별 매출 현황",
  "재고가 많은 품목 상위 10개",
  "어제 MB 사업소 수금",
  "모빌 제품 매출 현황",
  "미구매 현황",
  "오늘 매출과 재고"
];

/**
 * Normalize API response to always use results array format
 */
function normalizeQueryResult(data: any): { results: SingleResult[] } {
  // New format (already has results array)
  if (data.results && Array.isArray(data.results)) {
    return { results: data.results };
  }

  // Old format (single result) - convert to array
  return {
    results: [{
      title: '검색 결과',
      rows: data.rows || [],
      columns: data.columns || [],
      sql: data.sql || '',
      intent: data.intent || '',
      componentHint: data.componentHint || 'GenericResultTable'
    }]
  };
}

/**
 * Single result section component
 */
function ResultSection({ result, index }: { result: SingleResult; index: number }) {
  const [showSQL, setShowSQL] = useState(false);

  const handleExport = () => {
    if (!result.rows || result.rows.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    // Convert rows to format with column headers
    const exportData = result.rows.map(row => {
      const formattedRow: Record<string, any> = {};
      result.columns.forEach((col) => {
        formattedRow[col] = row[col];
      });
      return formattedRow;
    });

    const filename = generateFilename(result.title || `result-${index + 1}`);
    exportToExcel(exportData, filename);
  };

  const componentConfig = selectComponent(result.intent, result.rows);
  const transformedData = componentConfig.transform(result.rows);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Title Bar */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {result.title}
        </h2>
        {result.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {result.description}
          </p>
        )}
      </div>

      {/* SQL Toggle */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setShowSQL(!showSQL)}
          className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <span>생성된 SQL 쿼리</span>
          {showSQL ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {showSQL && (
          <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            <pre className="text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap">
              {result.sql}
            </pre>
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {result.rows.length.toLocaleString()}개 결과
          </div>
          <ExcelDownloadButton onClick={handleExport} disabled={!result.rows || result.rows.length === 0} />
        </div>

        {/* Render appropriate table component */}
        {componentConfig.component === 'SalesTable' ? (
          <SalesTable data={transformedData} />
        ) : (
          <GenericResultTable rows={result.rows} columns={result.columns} queryKey={result.intent} />
        )}
      </div>
    </div>
  );
}

function QueryPageContent() {
  const searchParams = useSearchParams();
  const { saveQuery, updateExecutionStats, getQuery } = useStarredQueries();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ results: SingleResult[] } | null>(null);
  const [metadata, setMetadata] = useState<QueryMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStarModal, setShowStarModal] = useState(false);
  const [currentQueryData, setCurrentQueryData] = useState<{
    queryText: string;
    sql: string;
    intent: string;
  } | null>(null);

  // Auto-execute starred queries from URL params
  useEffect(() => {
    const executeStarredId = searchParams.get('executeStarred');
    if (executeStarredId) {
      const starredQuery = getQuery(executeStarredId);
      if (starredQuery) {
        setQuery(starredQuery.queryText);
        executeQuery(starredQuery.queryText);
        updateExecutionStats(executeStarredId);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeQuery(query);
  };

  const executeQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setMetadata(null);

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

      // Normalize result to always use results array format
      const normalizedResult = normalizeQueryResult(data.data);
      setResult(normalizedResult);
      setMetadata(data.metadata);

      // Store current query data for starring (use first result for now)
      if (normalizedResult.results.length > 0) {
        const firstResult = normalizedResult.results[0];
        setCurrentQueryData({
          queryText,
          sql: firstResult.sql,
          intent: firstResult.intent
        });
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
    executeQuery(exampleQuery);
  };

  const renderResults = () => {
    if (!result || !result.results) return null;

    return (
      <div className="space-y-8">
        {result.results.map((singleResult, index) => (
          <ResultSection
            key={index}
            result={singleResult}
            index={index}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            데이터 검색
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            자연어로 원하는 데이터를 요청하세요
          </p>
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
            예시 쿼리:
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
              예시 쿼리를 참고하거나 다른 방식으로 질문해보세요.
            </p>
          </div>
        )}

        {/* Metadata Display */}
        {metadata && (
          <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{metadata.executionTime}ms</span>
            </div>
            <div className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {(metadata.totalRowCount || metadata.rowCount || 0).toLocaleString()}개 결과
            </div>
            {metadata.queries && metadata.queries > 1 && (
              <div className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                {metadata.queries}개 쿼리
              </div>
            )}
            <div className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {metadata.method === 'template' ? '템플릿' : metadata.method === 'ai' ? 'AI 생성' : 'LLM'}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">
              남은 쿼리: {metadata.remaining}
            </div>
          </div>
        )}

        {/* Error Messages */}
        {metadata?.errors && metadata.errors.length > 0 && (
          <div className="rounded-xl border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950 p-4">
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
              일부 쿼리가 실패했습니다:
            </p>
            <ul className="list-disc list-inside text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
              {metadata.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Star Query Button */}
        {currentQueryData && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowStarModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors shadow-sm hover:shadow-md"
            >
              <Star className="w-4 h-4" />
              <span className="font-medium">즐겨찾기 추가</span>
            </button>
          </div>
        )}

        {/* Results Display */}
        {result && renderResults()}

        {/* Empty State */}
        {!loading && !result && !error && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
            <p className="text-zinc-500 dark:text-zinc-400">
              쿼리를 입력하거나 예시 쿼리를 클릭해보세요
            </p>
          </div>
        )}
      </div>

      {/* Star Query Modal */}
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

export default function QueryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      }
    >
      <QueryPageContent />
    </Suspense>
  );
}
