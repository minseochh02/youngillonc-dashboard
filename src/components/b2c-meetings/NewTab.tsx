"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
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
  team: string;
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
}

interface NewTabProps {
  selectedMonth?: string;
}

export default function NewTab({ selectedMonth }: NewTabProps) {
  const [data, setData] = useState<NewClientsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNewClientsData();
  }, [selectedMonth]);

  const toggleManager = (managerKey: string) => {
    const newExpanded = new Set(expandedManagers);
    if (newExpanded.has(managerKey)) {
      newExpanded.delete(managerKey);
    } else {
      newExpanded.add(managerKey);
    }
    setExpandedManagers(newExpanded);
  };

  const fetchNewClientsData = async () => {
    setIsLoading(true);
    try {
      const url = `/api/dashboard/b2c-meetings?tab=new${selectedMonth ? `&month=${selectedMonth}` : ''}`;
      const response = await apiFetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
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

  // Group managers by team
  const teamGroups: Record<string, string[]> = {};
  managerSummary.forEach(m => {
    if (!teamGroups[m.team]) {
      teamGroups[m.team] = [];
    }
    if (!teamGroups[m.team].includes(m.담당자명)) {
      teamGroups[m.team].push(m.담당자명);
    }
  });

  const sortedTeams = Object.keys(teamGroups).sort();

  const handleExcelDownload = () => {
    if (!data) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData: any[] = [];

    // Add manager summary section
    exportData.push({
      '팀': '담당자별 신규 현황 비교',
    });

    sortedTeams.forEach((team) => {
      exportData.push({ '팀': `[${team}]` });
      teamGroups[team].sort().forEach((manager) => {
        const currentManager = managerSummary.find(s => s.담당자명 === manager && s.year === currentYear) || { client_count: 0, total_weight: 0, branch: '' };
        const lastManager = managerSummary.find(s => s.담당자명 === manager && s.year === lastYear) || { client_count: 0, total_weight: 0 };
        const change = calculateChange(currentManager.total_weight, lastManager.total_weight);

        exportData.push({
          '팀': team,
          '담당자': manager,
          '사업소': currentManager.branch,
          [`${currentYear}년 거래처수(개)`]: currentManager.client_count,
          [`${currentYear}년 중량(L)`]: currentManager.total_weight,
          [`${lastYear}년 거래처수(개)`]: lastManager.client_count,
          [`${lastYear}년 중량(L)`]: lastManager.total_weight,
          '중량 변화율(%)': change.percent.toFixed(1),
        });
      });
    });

    // Add blank row separator
    exportData.push({});

    // Add new clients detail section grouped by team/manager
    exportData.push({
      '팀': `${currentYear}년 신규 거래처 상세`,
    });

    sortedTeams.forEach((team) => {
      exportData.push({ '팀': `[${team}]` });
      teamGroups[team].sort().forEach((manager) => {
        const managerClients = clients.filter(c => c.담당자명 === manager && c.year === currentYear);
        if (managerClients.length > 0) {
          managerClients
            .sort((a, b) => b.total_weight - a.total_weight)
            .forEach((client) => {
              exportData.push({
                '팀': team,
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
    });

    const filename = generateFilename('B2C신규거래처');
    exportToExcel(exportData, filename);
  };

  return (
    <div className="space-y-6">
      {/* Header with Download Button */}
      <div className="flex justify-end">
        <ExcelDownloadButton onClick={handleExcelDownload} disabled={!data || isLoading} />
      </div>

      {/* Year Summary */}
      <div className="grid grid-cols-2 gap-4">
        {[currentYear, lastYear].map((year) => {
          const yearData = totalsByYear[year] || { total_weight: 0, client_count: 0 };
          const isCurrent = year === currentYear;

          return (
            <div
              key={year}
              className={`rounded-xl p-6 border ${
                isCurrent
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800'
                  : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                {year}년 신규 거래처 현황
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">신규 거래처수</p>
                  <p className={`text-2xl font-bold mt-1 ${isCurrent ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    {formatNumber(yearData.client_count)}개
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">총 중량</p>
                  <p className={`text-2xl font-bold mt-1 ${isCurrent ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    {formatNumber(yearData.total_weight)} L
                  </p>
                </div>
              </div>
            </div>
          );
        })}
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
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase">팀</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase">담당자</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase">사업소</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase">{currentYear}년 (개/L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase">{lastYear}년 (개/L)</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-500 uppercase">중량 변화율</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <React.Fragment key={team}>
                  <tr className="bg-zinc-100/50 dark:bg-zinc-800/30">
                    <td colSpan={6} className="py-2 px-4 font-bold text-zinc-900 dark:text-zinc-100 border-y border-zinc-200 dark:border-zinc-800">
                      {team}
                    </td>
                  </tr>
                  {teamGroups[team].sort().map((manager) => {
                    const currentManager = managerSummary.find(s => s.담당자명 === manager && s.year === currentYear) || { client_count: 0, total_weight: 0, branch: '' };
                    const lastManager = managerSummary.find(s => s.담당자명 === manager && s.year === lastYear) || { client_count: 0, total_weight: 0 };
                    const change = calculateChange(currentManager.total_weight, lastManager.total_weight);

                    return (
                      <tr key={manager} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 text-zinc-400 dark:text-zinc-500 text-xs">└</td>
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
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Clients by Manager */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{currentYear}년 신규 거래처 상세 (팀/담당자별)</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            담당자를 클릭하여 상세 거래처 목록 확인
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {sortedTeams.map((team) => (
                <React.Fragment key={`detail-${team}`}>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                    <td colSpan={5} className="py-2 px-4 font-bold text-blue-600 dark:text-blue-400 border-y border-zinc-200 dark:border-zinc-800">
                      {team}
                    </td>
                  </tr>
                  {teamGroups[team].sort().map((manager) => {
                    const managerKey = `${manager}-${currentYear}`;
                    const isExpanded = expandedManagers.has(managerKey);
                    const managerClients = clients
                      .filter(c => c.담당자명 === manager && c.year === currentYear)
                      .sort((a, b) => b.total_weight - a.total_weight);

                    if (managerClients.length === 0) return null;

                    const managerData = managerSummary.find(s => s.담당자명 === manager && s.year === currentYear);
                    if (!managerData) return null;

                    return (
                      <React.Fragment key={managerKey}>
                        {/* Manager Row (Clickable) */}
                        <tr
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
                            <tr className="bg-zinc-50/80 dark:bg-zinc-800/80">
                              <th className="text-left py-2 px-4 pl-12 text-[10px] font-bold text-zinc-500 uppercase">신규일</th>
                              <th className="text-left py-2 px-4 text-[10px] font-bold text-zinc-500 uppercase">거래처코드</th>
                              <th className="text-left py-2 px-4 text-[10px] font-bold text-zinc-500 uppercase">거래처명</th>
                              <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 uppercase">중량(L)</th>
                              <th className="text-right py-2 px-4 text-[10px] font-bold text-zinc-500 uppercase">거래일수</th>
                            </tr>
                            {managerClients.map((client) => (
                              <tr
                                key={client.거래처코드}
                                className="border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-800/10"
                              >
                                <td className="py-2 px-4 pl-12 text-zinc-500 dark:text-zinc-400 text-xs">{client.신규일}</td>
                                <td className="py-2 px-4 font-mono text-zinc-600 dark:text-zinc-400 text-[10px]">{client.거래처코드}</td>
                                <td className="py-2 px-4 font-medium text-zinc-900 dark:text-zinc-100 text-xs">{client.거래처명}</td>
                                <td className="py-2 px-4 text-right font-mono text-xs">{formatNumber(Math.round(client.total_weight))}</td>
                                <td className="py-2 px-4 text-right text-xs">{client.transaction_days}일</td>
                              </tr>
                            ))}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
