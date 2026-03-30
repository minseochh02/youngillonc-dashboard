"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface CustomerDataRow {
  거래처그룹2: string;
  담당자명: string;
  거래처코드: string;
  판매처명: string;
  last_year_weight: number;
  current_year_weight: number;
  change_weight: number;
}

interface CustomerReasonData {
  customerData: CustomerDataRow[];
  currentYear: string;
  lastYear: string;
}

interface CustomerNotes {
  [거래처코드: string]: {
    원인분석: string;
    대응방안: string;
  };
}

interface CustomerReasonTabProps {
  selectedMonth?: string;
}

export default function CustomerReasonTab({ selectedMonth }: CustomerReasonTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<CustomerReasonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState<CustomerNotes>({});

  useEffect(() => {
    fetchCustomerReasonData();
    // Load notes from localStorage
    const savedNotes = localStorage.getItem('customer-reason-notes');
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error('Failed to load notes:', e);
      }
    }
  }, [selectedMonth, includeVat]);

  const fetchCustomerReasonData = async () => {
    setIsLoading(true);
    try {
      const url = withIncludeVat(
        `/api/dashboard/b2c-meetings?tab=customer-reason${selectedMonth ? `&month=${selectedMonth}` : ''}`,
        includeVat
      );
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch customer reason data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const updateNote = (거래처코드: string, field: '원인분석' | '대응방안', value: string) => {
    const newNotes = {
      ...notes,
      [거래처코드]: {
        원인분석: notes[거래처코드]?.원인분석 || '',
        대응방안: notes[거래처코드]?.대응방안 || '',
        [field]: value,
      },
    };
    setNotes(newNotes);
    // Save to localStorage
    localStorage.setItem('customer-reason-notes', JSON.stringify(newNotes));
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

  const { currentYear, lastYear, customerData } = data;

  // Filter customer data based on search term
  const filteredData = customerData.filter(row => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      row.판매처명?.toLowerCase().includes(search) ||
      row.거래처코드?.toLowerCase().includes(search) ||
      row.담당자명?.toLowerCase().includes(search) ||
      row.거래처그룹2?.toLowerCase().includes(search)
    );
  });

  // Sort by absolute change magnitude (largest impact first)
  const sortedData = [...filteredData].sort((a, b) => Math.abs(b.change_weight) - Math.abs(a.change_weight));

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData = sortedData.map(row => ({
      '거래처그룹2': row.거래처그룹2 || '',
      '담당자명': row.담당자명 || '',
      '거래처코드': row.거래처코드,
      '판매처명': row.판매처명,
      [`${lastYear}년(L)`]: row.last_year_weight,
      [`${currentYear}년(L)`]: row.current_year_weight,
      '증감(L)': row.change_weight,
      '증감율(%)': row.last_year_weight > 0
        ? (((row.current_year_weight - row.last_year_weight) / row.last_year_weight) * 100).toFixed(1)
        : 'N/A',
      '원인분석': notes[row.거래처코드]?.원인분석 || '',
      '대응방안': notes[row.거래처코드]?.대응방안 || '',
    }));

    const filename = generateFilename('거래처별_판매현황');
    exportToExcel(exportData, filename);
  };

  const totalCustomers = filteredData.length;
  const increasedCustomers = filteredData.filter(r => r.change_weight > 0).length;
  const decreasedCustomers = filteredData.filter(r => r.change_weight < 0).length;
  const newCustomers = filteredData.filter(r => r.last_year_weight === 0).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Base Summary Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">거래처 현황 요약</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">전체 및 신규 거래처</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">전체 거래처</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totalCustomers)} 개</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                데이터 검색 결과 기준
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">신규 거래처</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(newCustomers)} 개</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년 무실적 거래처
              </p>
            </div>
          </div>
        </div>

        {/* Growth Trends Card */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">판매 증감 트렌드</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">전년 대비 중량 기준</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">증가 거래처</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(increasedCustomers)} 개
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체의 {((increasedCustomers / totalCustomers) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">감소 거래처</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold text-red-600">
                  {formatNumber(decreasedCustomers)} 개
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체의 {((decreasedCustomers / totalCustomers) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Data Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">거래처별 판매 현황</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {filteredData.length !== customerData.length && `${filteredData.length} / `}
            전체 {customerData.length}개 거래처
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">거래처그룹2</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">담당자명</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">거래처코드</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">판매처명</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{lastYear}년(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider">{currentYear}년(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">증감(L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">증감율</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-amber-600 uppercase tracking-wider">원인분석</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-green-600 uppercase tracking-wider">대응방안</th>
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
                    key={`${row.거래처코드}-${index}`}
                    className={`border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors ${
                      isNew ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 text-xs">
                      {row.거래처그룹2 || '-'}
                    </td>
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 text-xs">
                      {row.담당자명 || '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400 text-xs">
                      {row.거래처코드}
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.판매처명}
                      {isNew && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          신규
                        </span>
                      )}
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
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={notes[row.거래처코드]?.원인분석 || ''}
                        onChange={(e) => updateNote(row.거래처코드, '원인분석', e.target.value)}
                        placeholder="원인을 입력하세요..."
                        className="w-full min-w-[200px] px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={notes[row.거래처코드]?.대응방안 || ''}
                        onChange={(e) => updateNote(row.거래처코드, '대응방안', e.target.value)}
                        placeholder="대응방안을 입력하세요..."
                        className="w-full min-w-[200px] px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
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
          <li>제품: (품목그룹1코드)</li>
          <li>거래처: AUTO 채널 (company_type_auto)</li>
          <li>중량 단위: 리터(L)</li>
          <li>기간: {lastYear}년 vs {currentYear}년</li>
          <li>정렬: 증감량 기준 (감소 → 증가)</li>
        </ul>
      </div>
    </div>
  );
}
