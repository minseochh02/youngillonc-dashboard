"use client";

import { useState, useEffect } from 'react';
import { Calendar, Filter, Loader2, TrendingUp, Building2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface DailySalesData {
  product_name: string;
  product_code: string;
  category: string;
  sales_quantity: number;
  sales_weight: number;
  supply_amount: number;
  total_amount: number;
  unit_price: number;
  purchase_quantity: number;
  purchase_supply_amount: number;
  dsp_amount: number;
  dsp_quantity: number;
  dsp_unit_price: number;
  asp_amount: number;
  asp_quantity: number;
  asp_unit_price: number;
  other_costs: number;
  profit_dsp: number;
  profit_asp: number;
  profit_rate_dsp: number;
  profit_rate_asp: number;
}

const BRANCHES = ['all', 'MB', '화성', '창원', '남부', '중부', '서부', '동부', '제주', '부산'];

export default function B2BDailySalesAnalysisPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [branch, setBranch] = useState('all');
  const [data, setData] = useState<DailySalesData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    fetchData();
  }, [date, branch]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ date, branch });
      const response = await apiFetch(`/api/dashboard/b2b-daily-sales?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data || []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('Failed to fetch B2B daily sales data:', error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExcelDownload = () => {
    if (data.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData = data.map(row => ({
      '품목명': row.product_name,
      '품목코드': row.product_code,
      '카테고리': row.category,
      '수량': row.sales_quantity,
      '단가': row.unit_price,
      '공급가': row.supply_amount,
      'DSP': row.dsp_unit_price,
      'ASP': row.asp_unit_price,
      '기타비용': row.other_costs,
      '매출이익(DSP)': row.profit_dsp,
      '매출이익(ASP)': row.profit_asp,
      '이익율(DSP) %': row.profit_rate_dsp,
      '이익율(ASP) %': row.profit_rate_asp
    }));

    const filename = generateFilename(`B2B일일매출분석_${date}_${branch}`);
    exportToExcel(exportData, filename);
  };

  // Calculate totals
  const totals = data.reduce((acc, row) => ({
    sales_quantity: acc.sales_quantity + row.sales_quantity,
    supply_amount: acc.supply_amount + row.supply_amount,
    dsp_amount: acc.dsp_amount + row.dsp_amount,
    asp_amount: acc.asp_amount + row.asp_amount,
    other_costs: acc.other_costs + row.other_costs,
    profit_dsp: acc.profit_dsp + row.profit_dsp,
    profit_asp: acc.profit_asp + row.profit_asp,
  }), {
    sales_quantity: 0,
    supply_amount: 0,
    dsp_amount: 0,
    asp_amount: 0,
    other_costs: 0,
    profit_dsp: 0,
    profit_asp: 0,
  });

  const avg_profit_rate_dsp = totals.supply_amount > 0
    ? (totals.profit_dsp / totals.supply_amount) * 100
    : 0;
  const avg_profit_rate_asp = totals.supply_amount > 0
    ? (totals.profit_asp / totals.supply_amount) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            B2B사업소 일일매출 분석
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            품목별 일일 매출 및 수익성 분석
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={data.length === 0 || isLoading} />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                일자
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                사업소
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                {BRANCHES.map(b => (
                  <option key={b} value={b}>
                    {b === 'all' ? '전체' : b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">총 매출액</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            ₩{totals.supply_amount.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">매출이익(DSP)</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            ₩{totals.profit_dsp.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">매출이익(ASP)</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            ₩{totals.profit_asp.toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">평균 이익율</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {avg_profit_rate_dsp.toFixed(1)}% / {avg_profit_rate_asp.toFixed(1)}%
          </p>
          <p className="text-xs text-zinc-400 mt-1">DSP / ASP</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            품목별 분석 ({data.length.toLocaleString()}개 품목)
          </h3>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-zinc-500">데이터를 불러오는 중...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <TrendingUp className="w-12 h-12 mb-3 opacity-50" />
            <p>조회된 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase border-r border-zinc-200 dark:border-zinc-700">
                    품목
                  </th>
                  <th colSpan={3} className="px-4 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase border-r border-zinc-200 dark:border-zinc-700 bg-blue-50 dark:bg-blue-950">
                    일일매출 현황
                  </th>
                  <th colSpan={3} className="px-4 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase border-r border-zinc-200 dark:border-zinc-700 bg-orange-50 dark:bg-orange-950">
                    구매현황
                  </th>
                  <th colSpan={2} className="px-4 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase border-r border-zinc-200 dark:border-zinc-700 bg-emerald-50 dark:bg-emerald-950">
                    매출이익
                  </th>
                  <th colSpan={2} className="px-4 py-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase bg-purple-50 dark:bg-purple-950">
                    이익율 (%)
                  </th>
                </tr>
                <tr>
                  {/* 일일매출 현황 */}
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-blue-50 dark:bg-blue-950">수량</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-blue-50 dark:bg-blue-950">단가</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-700 bg-blue-50 dark:bg-blue-950">공급가</th>
                  {/* 구매현황 */}
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-orange-50 dark:bg-orange-950">DSP</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-orange-50 dark:bg-orange-950">ASP</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-700 bg-orange-50 dark:bg-orange-950">기타비용<br/>(운임 외)</th>
                  {/* 매출이익 */}
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-emerald-50 dark:bg-emerald-950">매출이익<br/>(DSP)</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-700 bg-emerald-50 dark:bg-emerald-950">매출이익<br/>(ASP)</th>
                  {/* 이익율 */}
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-purple-50 dark:bg-purple-950">이익율<br/>(DSP)</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-purple-50 dark:bg-purple-950">이익율<br/>(ASP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.map((row, index) => (
                  <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-700">
                      <div className="flex flex-col">
                        <span>{row.product_name}</span>
                        <span className="text-xs text-zinc-500">{row.category}</span>
                      </div>
                    </td>
                    {/* 일일매출 현황 */}
                    <td className="px-3 py-3 text-sm text-right text-zinc-700 dark:text-zinc-300">
                      {row.sales_quantity.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-zinc-700 dark:text-zinc-300">
                      ₩{row.unit_price.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-medium text-blue-600 dark:text-blue-400 border-r border-zinc-200 dark:border-zinc-700">
                      ₩{row.supply_amount.toLocaleString()}
                    </td>
                    {/* 구매현황 */}
                    <td className="px-3 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
                      ₩{row.dsp_unit_price.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
                      ₩{row.asp_unit_price.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700">
                      ₩{row.other_costs.toLocaleString()}
                    </td>
                    {/* 매출이익 */}
                    <td className={`px-3 py-3 text-sm text-right font-semibold border-r border-zinc-200 dark:border-zinc-700 ${
                      row.profit_dsp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      ₩{row.profit_dsp.toLocaleString()}
                    </td>
                    <td className={`px-3 py-3 text-sm text-right font-semibold border-r border-zinc-200 dark:border-zinc-700 ${
                      row.profit_asp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      ₩{row.profit_asp.toLocaleString()}
                    </td>
                    {/* 이익율 */}
                    <td className={`px-3 py-3 text-sm text-right font-bold ${
                      row.profit_rate_dsp >= 20 ? 'text-emerald-600 dark:text-emerald-400' :
                      row.profit_rate_dsp >= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                      row.profit_rate_dsp >= 0 ? 'text-orange-600 dark:text-orange-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {row.profit_rate_dsp.toFixed(1)}%
                    </td>
                    <td className={`px-3 py-3 text-sm text-right font-bold ${
                      row.profit_rate_asp >= 20 ? 'text-emerald-600 dark:text-emerald-400' :
                      row.profit_rate_asp >= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                      row.profit_rate_asp >= 0 ? 'text-orange-600 dark:text-orange-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {row.profit_rate_asp.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                {data.length > 0 && (
                  <tr className="bg-zinc-100 dark:bg-zinc-800 font-bold">
                    <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-700">
                      합계
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">
                      {totals.sales_quantity.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">
                      -
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-blue-600 dark:text-blue-400 border-r border-zinc-200 dark:border-zinc-700">
                      ₩{totals.supply_amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
                      ₩{totals.dsp_amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
                      ₩{totals.asp_amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-700">
                      ₩{totals.other_costs.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-emerald-600 dark:text-emerald-400 border-r border-zinc-200 dark:border-zinc-700">
                      ₩{totals.profit_dsp.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-emerald-600 dark:text-emerald-400 border-r border-zinc-200 dark:border-zinc-700">
                      ₩{totals.profit_asp.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                      {avg_profit_rate_dsp.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                      {avg_profit_rate_asp.toFixed(1)}%
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
