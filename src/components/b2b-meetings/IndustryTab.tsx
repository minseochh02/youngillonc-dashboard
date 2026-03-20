"use client";

import { useState, useEffect } from 'react';
import { Calendar, Loader2, Building, DollarSign, TrendingUp, Users, Package } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel } from '@/lib/excel-export';

interface IndustryData {
  모빌분류: string;
  산업분류: string;
  업종분류코드: string;
  client_count: number;
  transaction_count: number;
  total_quantity: number;
  total_weight: number;
  total_supply_amount: number;
  total_amount: number;
}

export default function IndustryTab() {
  const [data, setData] = useState<IndustryData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(0, 1); // January 1st of current year
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/api/dashboard/b2b-meetings/industry?startDate=${startDate}&endDate=${endDate}`
      );
      const result = await response.json();
      if (result.success) {
        setData(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch industry data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExcelDownload = () => {
    if (data.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData = data.map(item => ({
      '모빌분류': item.모빌분류 || '-',
      '산업분류': item.산업분류 || '-',
      '업종분류코드': item.업종분류코드 || '-',
      '거래처 수': item.client_count,
      '거래 건수': item.transaction_count,
      '총 수량': item.total_quantity,
      '총 중량': item.total_weight,
      '공급가액': item.total_supply_amount,
      '합계': item.total_amount,
    }));

    const filename = `B2B_산업별_${startDate}_${endDate}.xlsx`;
    exportToExcel(exportData, filename);
  };

  const totals = data.reduce((acc, row) => ({
    clients: acc.clients + (Number(row.client_count) || 0),
    transactions: acc.transactions + (Number(row.transaction_count) || 0),
    quantity: acc.quantity + (Number(row.total_quantity) || 0),
    weight: acc.weight + (Number(row.total_weight) || 0),
    supplyAmount: acc.supplyAmount + (Number(row.total_supply_amount) || 0),
    totalAmount: acc.totalAmount + (Number(row.total_amount) || 0),
  }), {
    clients: 0,
    transactions: 0,
    quantity: 0,
    weight: 0,
    supplyAmount: 0,
    totalAmount: 0,
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100"
          />
          <span className="text-zinc-400">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <ExcelDownloadButton onClick={handleExcelDownload} disabled={data.length === 0 || isLoading} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <Building className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">산업 분류 수</p>
          </div>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {data.length}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-green-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">총 거래처 수</p>
          </div>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {totals.clients.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-orange-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">총 중량</p>
          </div>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {totals.weight.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-purple-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">총 매출액</p>
          </div>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
            ₩{totals.totalAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-zinc-500">데이터를 불러오는 중...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <Building className="w-12 h-12 mb-3 opacity-50" />
            <p>조회된 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    모빌분류
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    산업분류
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    업종분류코드
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    거래처 수
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    거래 건수
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    총 중량
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    공급가액
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    합계
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.map((row, index) => (
                  <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {row.모빌분류 || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {row.산업분류 || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {row.업종분류코드 || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-zinc-900 dark:text-zinc-100">
                      {Number(row.client_count).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-700 dark:text-zinc-300">
                      {Number(row.transaction_count).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-orange-600 dark:text-orange-400">
                      {Number(row.total_weight).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-700 dark:text-zinc-300">
                      ₩{Number(row.total_supply_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-purple-600 dark:text-purple-400">
                      ₩{Number(row.total_amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-zinc-100 dark:bg-zinc-800 font-bold">
                  <td colSpan={3} className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                    합계
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">
                    {totals.clients.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">
                    {totals.transactions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
                    {totals.weight.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">
                    ₩{totals.supplyAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                    ₩{totals.totalAmount.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
