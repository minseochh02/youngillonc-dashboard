"use client";

import { useState, useEffect, Fragment } from 'react';
import { Calendar, Loader2, Building, DollarSign, TrendingUp, Users, Package } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel } from '@/lib/excel-export';

interface IndustryData {
  모빌분류: string;
  산업분류: string;
  영일분류: string;
  team_name: string;
  client_count: number;
  transaction_count: number;
  total_quantity: number;
  total_weight: number;
  total_supply_amount: number;
  total_amount: number;
}

export default function IndustryTab() {
  const { includeVat } = useVatInclude();
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
  }, [startDate, endDate, includeVat]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(
        withIncludeVat(
          `/api/dashboard/b2b-meetings/industry?startDate=${startDate}&endDate=${endDate}`,
          includeVat
        )
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
      '영일분류': item.영일분류 || '-',
      '팀': item.team_name || '-',
      '거래처 수': item.client_count,
      '거래 건수': item.transaction_count,
      '총 수량': item.total_quantity,
      '총 중량': item.total_weight,
      '공급가액': item.total_supply_amount,
      '합계': item.total_amount,
    }));

    const filename = `B2B_산업별_${startDate}_${endDate}.xlsx`;
    
    // Use island format for reference date support
    const { exportIslandTables } = require('@/lib/excel-export');
    const headers = Object.keys(exportData[0]);
    const rows = exportData.map(row => headers.map(h => (row as any)[h]));
    
    exportIslandTables(
      [{ title: 'B2B 산업별 판매 현황', headers, data: rows }],
      filename,
      `${startDate} ~ ${endDate}`
    );
  };

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const expandAll = () => {
    setExpandedRows(new Set(Object.keys(groupedData)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const groupedData = data.reduce((acc, row) => {
    const key = `${row.모빌분류}-${row.산업분류}-${row.영일분류}`;
    if (!acc[key]) {
      acc[key] = {
        모빌분류: row.모빌분류,
        산업분류: row.산업분류,
        영일분류: row.영일분류,
        teams: [],
        totals: {
          clients: 0,
          transactions: 0,
          quantity: 0,
          weight: 0,
          supplyAmount: 0,
          totalAmount: 0,
        }
      };
    }
    acc[key].teams.push(row);
    acc[key].totals.clients += Number(row.client_count) || 0;
    acc[key].totals.transactions += Number(row.transaction_count) || 0;
    acc[key].totals.quantity += Number(row.total_quantity) || 0;
    acc[key].totals.weight += Number(row.total_weight) || 0;
    acc[key].totals.supplyAmount += Number(row.total_supply_amount) || 0;
    acc[key].totals.totalAmount += Number(row.total_amount) || 0;
    return acc;
  }, {} as Record<string, {
    모빌분류: string;
    산업분류: string;
    영일분류: string;
    teams: IndustryData[];
    totals: any;
  }>);

  const sortedGroupedKeys = Object.keys(groupedData).sort((a, b) => 
    groupedData[b].totals.totalAmount - groupedData[a].totals.totalAmount
  );

  // Group composite keys by 모빌분류
  const mobilGroupedData = Object.keys(groupedData).reduce((acc, key) => {
    const mobil = groupedData[key].모빌분류 || '미분류';
    if (!acc[mobil]) {
      acc[mobil] = [];
    }
    acc[mobil].push(key);
    return acc;
  }, {} as Record<string, string[]>);

  // Calculate Mobil Category totals for sorting and header
  const getMobilCategoryTotals = (mobil: string) => {
    return (mobilGroupedData[mobil] || []).reduce((acc, key) => {
      const g = groupedData[key];
      return {
        clients: acc.clients + g.totals.clients,
        transactions: acc.transactions + g.totals.transactions,
        quantity: acc.quantity + g.totals.quantity,
        weight: acc.weight + g.totals.weight,
        supplyAmount: acc.supplyAmount + g.totals.supplyAmount,
        totalAmount: acc.totalAmount + g.totals.totalAmount,
      };
    }, { clients: 0, transactions: 0, quantity: 0, weight: 0, supplyAmount: 0, totalAmount: 0 });
  };

  // Sort Mobil Categories by total amount
  const sortedMobilGroups = Object.keys(mobilGroupedData).sort((a, b) => 
    getMobilCategoryTotals(b).totalAmount - getMobilCategoryTotals(a).totalAmount
  );

  const formatCurrency = (num: number) => `₩${Math.round(num).toLocaleString()}`;
  const formatNumber = (num: number) => Math.round(num).toLocaleString();

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
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

        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
          >
            모두 펼치기
          </button>
          <button
            onClick={collapseAll}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            모두 접기
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Industry Overview Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">산업별 실적 요약</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{startDate} ~ {endDate}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">산업 분류 수</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{Object.keys(groupedData).length} 개</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 거래처: {formatNumber(totals.clients)} 개
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 거래건수</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totals.transactions)} 건</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                평균 {formatNumber(Math.round(totals.transactions / (Object.keys(groupedData).length || 1)))} 건/산업
              </p>
            </div>
          </div>
        </div>

        {/* Volume and Amount Card */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">판매 규모</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">기간 내 총 합계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 중량</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatNumber(totals.weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 중량 대비 100%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">총 매출액</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(totals.totalAmount)}</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                공급가액: {formatCurrency(totals.supplyAmount)}
              </p>
            </div>
          </div>
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
                    영일분류
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
                {sortedMobilGroups.map((mobil) => {
                  const mobilTotals = getMobilCategoryTotals(mobil);
                  const keysInGroup = mobilGroupedData[mobil].sort((a, b) => 
                    groupedData[b].totals.totalAmount - groupedData[a].totals.totalAmount
                  );

                  return (
                    <Fragment key={mobil}>
                      {/* Mobil Category Header */}
                      <tr className="bg-zinc-100/60 dark:bg-zinc-800/80 font-bold border-y border-zinc-200 dark:border-zinc-700">
                        <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-blue-700 dark:text-blue-400">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {mobil}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-zinc-900 dark:text-zinc-100 font-mono">
                          {formatNumber(mobilTotals.clients)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-zinc-900 dark:text-zinc-100 font-mono">
                          {formatNumber(mobilTotals.transactions)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-orange-600 dark:text-orange-400 font-mono">
                          {formatNumber(mobilTotals.weight)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-zinc-900 dark:text-zinc-100 font-mono font-medium">
                          {formatCurrency(mobilTotals.supplyAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-purple-700 dark:text-purple-300 font-bold font-mono">
                          {formatCurrency(mobilTotals.totalAmount)}
                        </td>
                      </tr>

                      {/* Detail Rows within this Mobil Category */}
                      {keysInGroup.map((key) => {
                        const group = groupedData[key];
                        const isExpanded = expandedRows.has(key);
                        
                        return (
                          <Fragment key={key}>
                            <tr 
                              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer border-b border-zinc-100 dark:border-zinc-800/50"
                              onClick={() => toggleRow(key)}
                            >
                              <td className="px-4 py-2.5 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium italic pl-8">
                                └ 상세
                              </td>
                              <td className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                                {group.산업분류 || '-'}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                                {group.영일분류 || '-'}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-right font-medium text-zinc-800 dark:text-zinc-200 font-mono">
                                {formatNumber(group.totals.clients)}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-right text-zinc-600 dark:text-zinc-400 font-mono">
                                {formatNumber(group.totals.transactions)}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-right font-semibold text-orange-500/80 dark:text-orange-400/80 font-mono">
                                {formatNumber(group.totals.weight)}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-right text-zinc-600 dark:text-zinc-400 font-mono">
                                {formatCurrency(group.totals.supplyAmount)}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-right font-bold text-purple-600/80 dark:text-purple-400/80 font-mono">
                                {formatCurrency(group.totals.totalAmount)}
                              </td>
                            </tr>
                            {isExpanded && group.teams.map((team, idx) => (
                              <tr key={`${key}-team-${idx}`} className="bg-zinc-50/30 dark:bg-zinc-900/40">
                                <td colSpan={3} className="px-4 py-1.5 pl-14 text-xs text-zinc-500 dark:text-zinc-400 font-medium italic">
                                  └ {team.team_name}
                                </td>
                                <td className="px-4 py-1.5 text-xs text-right text-zinc-500 font-mono">
                                  {Number(team.client_count).toLocaleString()}
                                </td>
                                <td className="px-4 py-1.5 text-xs text-right text-zinc-500 font-mono">
                                  {Number(team.transaction_count).toLocaleString()}
                                </td>
                                <td className="px-4 py-1.5 text-xs text-right text-orange-400/70 font-mono">
                                  {Number(team.total_weight).toLocaleString()}
                                </td>
                                <td className="px-4 py-1.5 text-xs text-right text-zinc-500 font-mono">
                                  ₩{Number(team.total_supply_amount).toLocaleString()}
                                </td>
                                <td className="px-4 py-1.5 text-xs text-right text-purple-400/70 font-medium font-mono">
                                  ₩{Number(team.total_amount).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
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
