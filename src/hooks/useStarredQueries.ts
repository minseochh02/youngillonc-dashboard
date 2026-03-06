'use client';

import { useState, useEffect } from 'react';

export interface StarredQuery {
  id: string;
  queryText: string;
  queryName: string;
  tags: string[];
  sql: string;
  intent: string;
  createdAt: string;
  lastExecutedAt?: string;
  executionCount: number;
  relativeDateType?: 'today' | 'yesterday' | 'this_month' | 'last_month' | 'absolute';
}

const STORAGE_KEY = 'starred_queries';

/**
 * Detect date pattern from query text
 */
function detectDatePattern(queryText: string): 'today' | 'yesterday' | 'this_month' | 'last_month' | 'absolute' {
  const text = queryText.toLowerCase();

  if (text.includes('오늘')) return 'today';
  if (text.includes('어제')) return 'yesterday';
  if (text.includes('이번 달') || text.includes('이번달')) return 'this_month';
  if (text.includes('지난 달') || text.includes('지난달') || text.includes('저번 달') || text.includes('전달') || text.includes('전전달')) return 'last_month';

  // Check for specific months like "1월", "2월", etc.
  if (/\d+월/.test(text)) return 'absolute';

  return 'absolute'; // default to absolute if no pattern detected
}

export function useStarredQueries() {
  const [queries, setQueries] = useState<StarredQuery[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount and listen for changes
  useEffect(() => {
    const loadQueries = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setQueries(Array.isArray(parsed) ? parsed : []);
        } else {
          setQueries([]);
        }
      } catch (error) {
        console.error('Failed to load starred queries:', error);
        setQueries([]);
      } finally {
        setIsLoaded(true);
      }
    };

    // Initial load
    loadQueries();

    // Listen for custom event when queries are updated
    const handleStorageChange = () => {
      loadQueries();
    };

    window.addEventListener('starred-queries-updated', handleStorageChange);

    return () => {
      window.removeEventListener('starred-queries-updated', handleStorageChange);
    };
  }, []);

  // Save query
  const saveQuery = (data: {
    queryText: string;
    queryName?: string;
    tags?: string[];
    sql: string;
    intent: string;
  }) => {
    const relativeDateType = detectDatePattern(data.queryText);

    const newQuery: StarredQuery = {
      id: crypto.randomUUID(),
      queryText: data.queryText,
      queryName: data.queryName || data.queryText.slice(0, 50),
      tags: data.tags || [],
      sql: data.sql,
      intent: data.intent,
      createdAt: new Date().toISOString(),
      executionCount: 0,
      relativeDateType,
    };

    const updated = [...queries, newQuery];
    setQueries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Notify other components
    window.dispatchEvent(new Event('starred-queries-updated'));

    return newQuery;
  };

  // Remove query
  const removeQuery = (id: string) => {
    const updated = queries.filter(q => q.id !== id);
    setQueries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Notify other components
    window.dispatchEvent(new Event('starred-queries-updated'));
  };

  // Update execution stats
  const updateExecutionStats = (id: string) => {
    const updated = queries.map(q =>
      q.id === id
        ? {
            ...q,
            lastExecutedAt: new Date().toISOString(),
            executionCount: q.executionCount + 1
          }
        : q
    );
    setQueries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Notify other components
    window.dispatchEvent(new Event('starred-queries-updated'));
  };

  // Get query by ID
  const getQuery = (id: string) => queries.find(q => q.id === id);

  // Update query (for editing name/tags)
  const updateQuery = (id: string, updates: Partial<Pick<StarredQuery, 'queryName' | 'tags'>>) => {
    const updated = queries.map(q =>
      q.id === id ? { ...q, ...updates } : q
    );
    setQueries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Notify other components
    window.dispatchEvent(new Event('starred-queries-updated'));
  };

  return {
    queries,
    saveQuery,
    removeQuery,
    updateExecutionStats,
    getQuery,
    updateQuery,
    isLoaded
  };
}
