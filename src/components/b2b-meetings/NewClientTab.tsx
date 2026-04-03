"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface NewClientRow {
  거래처코드: string;
  거래처명: string;
  신규일: string;
  담당자명: string;
  branch: string;
  year: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
  transaction_days: number;
}

interface ManagerSummary {
  담당자명: string;
  branch: string;
  year: string;
  total_weight: number;
  total_amount: number;
  total_quantity: number;
  client_count: number;
}

interface NewClientsData {
  clients: NewClientRow[];
  managerSummary: ManagerSummary[];
  totalsByYear: Record<string, {
    total_weight: number;
    total_amount: number;
    total_quantity: number;
    client_count: number;
  }>;
  currentYear: string;
  lastYear: string;
  availableMonths?: string[];
  currentMonth?: string;
}

interface NewClientTabProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function NewClientTab({ selectedMonth, onMonthsAvailable }: NewClientTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<NewClientsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNewClientsData();
  }, [includeVat, selectedMonth]);

  const toggleManager = (managerKey: string) => {
    const newExpanded = new Set(expandedManagers);
    if (newExpanded.has(managerKey)) {
      newExpanded.delete(managerKey);
    } else {
      newExpanded.add(managerKey);
    }
    setExpandedManagers(newExpanded);
  };

  const expandAll = () => {
    const allKeys = new Set(managers.map(m => `${m}-${currentYear}`));
    setExpandedManagers(allKeys);
  };

  const collapseAll = () => {
    setExpandedManagers(new Set());
  };

  const fetchNewClientsData = async () => {
    setIsLoading(true);
    try {
      const q = selectedMonth ? `&month=${encodeURIComponent(selectedMonth)}` : '';
      const response = await apiFetch(
        withIncludeVat(`/api/dashboard/b2b-meetings?tab=new${q}`, includeVat)
      );
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        const d = result.data;
        if (onMonthsAvailable && d?.availableMonths?.length) {
          onMonthsAvailable(d.availableMonths, d.currentMonth!);
        }
      }
    } catch (error) {
      console.error('Failed to fetch new clients data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { percent: change, isPositive: change >= 0 };
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

  const { currentYear, lastYear, totalsByYear, managerSummary, clients } = data;

  // Get unique managers from summary
  const managers = Array.from(new Set(managerSummary.map(m => m.담당자명))).sort();

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Add manager summary section
    exportData.push({
      '담당자': '담당자별 신규 현황 비교',
    });

    managers.forEach((manager) => {
      const currentManager = managerSummary.find(s => s.담당자명 === manager && s.year === currentYear) || { client_count: 0, total_weight: 0, branch: '' };
      const lastManager = managerSummary.find(s => s.담당자명 === manager && s.year === lastYear) || { client_count: 0, total_weight: 0 };
      const change = calculateChange(currentManager.total_weight, lastManager.total_weight);

      exportData.push({
        '담당자': manager,
        '사업소': currentManager.branch,
        [`${currentYear}년 거래처수(개)`]: currentManager.client_count,
        [`${currentYear}년 중량(L)`]: currentManager.total_weight,
        [`${lastYear}년 거래처수(개)`]: lastManager.client_count,
        [`${lastYear}년 중량(L)`]: lastManager.total_weight,
        '중량 변화율(%)': change.percent.toFixed(1),
      });
    });

    // Add blank row separator
    exportData.push({});

    // Add new clients detail section grouped by manager
    exportData.push({
      '담당자': `${currentYear}년 신규 거래처 상세`,
    });

    managers.forEach((manager) => {
      const managerClients = clients.filter(c => c.담당자명 === manager && c.year === currentYear);
      if (managerClients.length > 0) {
        managerClients
          .sort((a, b) => b.total_weight - a.total_weight)
          .forEach((client) => {
            exportData.push({
              '담당자': client.담당자명,
              '신규일': client.신규일,
              '사업소': client.branch,
              '거래처코드': client.거래처코드,
              '거래처명': client.거래처명,
              '용량(L)': client.total_weight,
              '금액': client.total_amount,
              '수량': client.total_quantity,
              '거래일수(일)': client.transaction_days,
            });
          });
      }
    });

    const filename = generateFilename('B2B신규거래처');
    exportToExcel(exportData, filename);
  };

  const totalCurrent = totalsByYear[currentYear] || { total_weight: 0, client_count: 0 };
  const totalLast = totalsByYear[lastYear] || { total_weight: 0, client_count: 0 };
  const countChange = calculateChange(totalCurrent.client_count, totalLast.client_count);
  const weightChange = calculateChange(totalCurrent.total_weight, totalLast.total_weight);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Performance Summary Card */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{currentYear}년 신규 현황</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">전체 신규 거래처 합계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">신규 거래처수</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totalCurrent.client_count)} 개</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년: {formatNumber(totalLast.client_count)} 개
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">신규 총 중량</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totalCurrent.total_weight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전년: {formatNumber(totalLast.total_weight)} L
              </p>
            </div>
          </div>
        </div>

        {/* Growth Trends Card */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              {weightChange.isPositive ? (
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">전년 대비 변화</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentYear} vs {lastYear}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">거래처수 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${countChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {countChange.isPositive ? '+' : ''}{countChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                {countChange.isPositive ? '+' : ''}{formatNumber(totalCurrent.client_count - totalLast.client_count)} 개
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">중량 변화</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-bold ${weightChange.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {weightChange.isPositive ? '+' : ''}{weightChange.percent.toFixed(1)}%
                </p>
              </div>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                {weightChange.isPositive ? '+' : ''}{formatNumber(totalCurrent.total_weight - totalLast.total_weight)} L
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Manager Summary Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">담당자별 신규 현황 비교</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase">담당자</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase">사업소</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase">{currentYear}년 (개/L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase">{lastYear}년 (개/L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase">중량 변화율</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((manager) => {
                const currentManager = managerSummary.find(s => s.담당자명 === manager && s.year === currentYear) || { client_count: 0, total_weight: 0, branch: '' };
                const lastManager = managerSummary.find(s => s.담당자명 === manager && s.year === lastYear) || { client_count: 0, total_weight: 0 };
                const change = calculateChange(currentManager.total_weight, lastManager.total_weight);

                return (
                  <tr key={manager} className="border-b border-zinc-100 dark:border-zinc-800/60">
                    <td className="py-3 px-4 font-medium">{manager}</td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{currentManager.branch}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-blue-600">{currentManager.client_count}개</span>
                      <span className="mx-2 text-zinc-300">/</span>
                      <span className="font-mono">{formatNumber(Math.round(currentManager.total_weight))}L</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span>{lastManager.client_count}개</span>
                      <span className="mx-2 text-zinc-300">/</span>
                      <span className="font-mono">{formatNumber(Math.round(lastManager.total_weight))}L</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        change.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {change.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(change.percent).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Clients by Manager */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{currentYear}년 신규 거래처 상세 (담당자별)</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              담당자를 클릭하여 상세 거래처 목록 확인
            </p>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {managers.map((manager) => {
                const managerKey = `${manager}-${currentYear}`;
                const isExpanded = expandedManagers.has(managerKey);
                const managerClients = clients
                  .filter(c => c.담당자명 === manager && c.year === currentYear)
                  .sort((a, b) => b.total_weight - a.total_weight);

                if (managerClients.length === 0) return null;

                const managerData = managerSummary.find(s => s.담당자명 === manager && s.year === currentYear);
                if (!managerData) return null;

                return (
                  <Fragment key={managerKey}>
                    {/* Manager Row (Clickable) */}
                    <tr
                      key={managerKey}
                      onClick={() => toggleManager(managerKey)}
                      className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4" colSpan={5}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-zinc-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-zinc-400" />
                            )}
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{manager}</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">({managerData.branch})</span>
                          </div>
                          <div className="flex items-center gap-6 text-xs">
                            <div>
                              <span className="text-zinc-500 dark:text-zinc-400">거래처: </span>
                              <span className="font-bold text-blue-600">{managerData.client_count}개</span>
                            </div>
                            <div>
                              <span className="text-zinc-500 dark:text-zinc-400">총 중량: </span>
                              <span className="font-mono font-semibold">{formatNumber(Math.round(managerData.total_weight))}L</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Client Rows */}
                    {isExpanded && (
                      <>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                          <th className="text-left py-2 px-4 pl-12 text-xs font-bold text-zinc-500 uppercase">신규일</th>
                          <th className="text-left py-2 px-4 text-xs font-bold text-zinc-500 uppercase">거래처코드</th>
                          <th className="text-left py-2 px-4 text-xs font-bold text-zinc-500 uppercase">거래처명</th>
                          <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 uppercase">중량(L)</th>
                          <th className="text-right py-2 px-4 text-xs font-bold text-zinc-500 uppercase">거래일수</th>
                        </tr>
                        {managerClients.map((client) => (
                          <tr
                            key={client.거래처코드}
                            className="border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/20"
                          >
                            <td className="py-2 px-4 pl-12 text-zinc-500 dark:text-zinc-400 text-xs">{client.신규일}</td>
                            <td className="py-2 px-4 font-mono text-zinc-600 dark:text-zinc-400 text-xs">{client.거래처코드}</td>
                            <td className="py-2 px-4 font-medium text-zinc-900 dark:text-zinc-100">{client.거래처명}</td>
                            <td className="py-2 px-4 text-right font-mono">{formatNumber(Math.round(client.total_weight))}</td>
                            <td className="py-2 px-4 text-right">{client.transaction_days}일</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
