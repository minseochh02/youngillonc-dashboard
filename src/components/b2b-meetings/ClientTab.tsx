"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface ProductDataRow {
  품목코드: string;
  품목명: string;
  품목그룹1코드: string;
  품목그룹2코드: string;
  품목그룹3코드: string;
  last_year_weight: number;
  current_year_weight: number;
  change_weight: number;
}

interface ProductData {
  productData: ProductDataRow[];
  currentYear: string;
  lastYear: string;
}

export default function ClientTab() {
  const [data, setData] = useState<ProductData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProductData();
  }, []);

  const fetchProductData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/b2b-meetings?tab=client`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch product data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400 p-8">
        <p>데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  const { currentYear, lastYear, productData } = data;

  // Filter product data based on search term
  const filteredData = productData.filter(row => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      row.품목명?.toLowerCase().includes(search) ||
      row.품목코드?.toLowerCase().includes(search) ||
      row.품목그룹2코드?.toLowerCase().includes(search) ||
      row.품목그룹3코드?.toLowerCase().includes(search)
    );
  });

  // Sort by current year weight (descending)
  const sortedData = [...filteredData].sort((a, b) => b.current_year_weight - a.current_year_weight);

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData = sortedData.map(row => ({
      '품목코드': row.품목코드 || '',
      '품목명': row.품목명 || '',
      '품목그룹2': row.품목그룹2코드 || '',
      '품목그룹3': row.품목그룹3코드 || '',
      [`${lastYear}년(L)`]: row.last_year_weight,
      [`${currentYear}년(L)`]: row.current_year_weight,
      '증감(L)': row.change_weight,
      '증감율(%)': row.last_year_weight > 0
        ? (((row.current_year_weight - row.last_year_weight) / row.last_year_weight) * 100).toFixed(1)
        : 'N/A',
    }));

    const filename = generateFilename('B2B_품목별_판매현황');
    exportToExcel(exportData, filename);
  };

  return (
    <div className="space-y-6">
      {/* Header with Search and Download */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
          <input
            type="text"
            placeholder="품목명, 코드, 그룹으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <ExcelDownloadButton onClick={handleExcelDownload} disabled={!data || isLoading} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">전체 품목</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatNumber(filteredData.length)}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">증가 품목</p>
          <p className="text-2xl font-bold text-green-600">{formatNumber(filteredData.filter(r => r.change_weight > 0).length)}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">감소 품목</p>
          <p className="text-2xl font-bold text-red-600">{formatNumber(filteredData.filter(r => r.change_weight < 0).length)}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">신규 품목</p>
          <p className="text-2xl font-bold text-blue-600">{formatNumber(filteredData.filter(r => r.last_year_weight === 0).length)}</p>
        </div>
      </div>

      {/* Product Data Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">B2B 품목별 판매 현황</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {filteredData.length !== productData.length && `${filteredData.length} / `}
            전체 {productData.length}개 품목
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">품목코드</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">품목명</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">그룹2</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">그룹3</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{lastYear}년(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">{currentYear}년(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">증감(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">증감율</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => {
                const changePercent = row.last_year_weight > 0
                  ? ((row.current_year_weight - row.last_year_weight) / row.last_year_weight) * 100
                  : 0;
                const isIncrease = row.change_weight > 0;
                const isDecrease = row.change_weight < 0;
                const isNew = row.last_year_weight === 0 && row.current_year_weight > 0;

                return (
                  <tr
                    key={`${row.품목코드}-${index}`}
                    className={`border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors ${
                      isNew ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                      {row.품목코드}
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.품목명}
                      {isNew && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          신규
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 text-xs">
                      {row.품목그룹2코드 || '-'}
                    </td>
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 text-xs">
                      {row.품목그룹3코드 || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {formatNumber(Math.round(row.last_year_weight))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 font-semibold">
                      {formatNumber(Math.round(row.current_year_weight))}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-semibold ${
                      isIncrease ? 'text-green-600' : isDecrease ? 'text-red-600' : 'text-zinc-500'
                    }`}>
                      {isIncrease && '+'}{formatNumber(Math.round(row.change_weight))}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.last_year_weight > 0 ? (
                        <span className={`inline-flex items-center gap-1 font-medium text-xs ${
                          isIncrease ? 'text-green-600' : isDecrease ? 'text-red-600' : 'text-zinc-500'
                        }`}>
                          {isIncrease && <TrendingUp className="w-3 h-3" />}
                          {isDecrease && <TrendingDown className="w-3 h-3" />}
                          {Math.abs(changePercent).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>제품: 산업유제품 (품목그룹1코드 = 'IL')</li>
          <li>거래처: NON-AUTO 채널 (B2B)</li>
          <li>중량 단위: 리터(L)</li>
          <li>기간: {lastYear}년 vs {currentYear}년</li>
          <li>정렬: 당해 연도 중량 순</li>
        </ul>
      </div>
    </div>
  );
}
