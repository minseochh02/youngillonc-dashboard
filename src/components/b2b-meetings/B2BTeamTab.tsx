"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface B2BDataRow {
  b2b_office: string;
  b2b_team: string;
  industry: string;
  sector: string;
  year_month: string;
  total_weight: number;
  total_amount: number;
}

interface B2BTeamData {
  b2bData: B2BDataRow[];
  currentYear: string;
  availableMonths?: string[];
  currentMonth?: string;
}

interface B2BTeamTabProps {
  selectedMonth?: string;
  onMonthsAvailable?: (months: string[], currentMonth: string) => void;
}

export default function B2BTeamTab({ selectedMonth, onMonthsAvailable }: B2BTeamTabProps) {
  const { includeVat } = useVatInclude();
  const [data, setData] = useState<B2BTeamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [includeVat, selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const q = selectedMonth ? `&month=${encodeURIComponent(selectedMonth)}` : '';
      const response = await apiFetch(
        withIncludeVat(`/api/dashboard/b2b-meetings?tab=team${q}`, includeVat)
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
      console.error('Failed to fetch B2B team data:', error);
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

  // Helper for month display
  const getMonthName = (monthStr: string | undefined) => {
    if (!monthStr) return '';
    const parts = monthStr.split('-');
    return parts.length > 1 ? `${parseInt(parts[1])}월` : monthStr;
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

  const { currentYear, b2bData, currentMonth: apiMonth } = data;

  // Create a structure for the table: office -> team -> industry -> sector -> monthly data
  const tableData = new Map<string, Map<string, Map<string, Map<string, { weight: Map<string, number>; amount: Map<string, number> }>>>>();

  b2bData.forEach(row => {
    if (!tableData.has(row.b2b_office)) {
      tableData.set(row.b2b_office, new Map());
    }
    const officeMap = tableData.get(row.b2b_office)!;

    if (!officeMap.has(row.b2b_team)) {
      officeMap.set(row.b2b_team, new Map());
    }
    const teamMap = officeMap.get(row.b2b_team)!;

    if (!teamMap.has(row.industry)) {
      teamMap.set(row.industry, new Map());
    }
    const industryMap = teamMap.get(row.industry)!;

    if (!industryMap.has(row.sector)) {
      industryMap.set(row.sector, { weight: new Map(), amount: new Map() });
    }
    const sectorData = industryMap.get(row.sector)!;

    sectorData.weight.set(row.year_month, row.total_weight);
    sectorData.amount.set(row.year_month, row.total_amount);
  });

  // Calculate monthly totals
  const monthlyTotalsWeight = new Map<string, number>();
  const monthlyTotalsAmount = new Map<string, number>();
  b2bData.forEach(row => {
    const currentWeight = monthlyTotalsWeight.get(row.year_month) || 0;
    const currentAmount = monthlyTotalsAmount.get(row.year_month) || 0;
    monthlyTotalsWeight.set(row.year_month, currentWeight + row.total_weight);
    monthlyTotalsAmount.set(row.year_month, currentAmount + row.total_amount);
  });

  const refYm = selectedMonth || apiMonth || `${currentYear}-12`;
  const maxMonthNum = parseInt(refYm.split('-')[1]!, 10);

  const months = Array.from({ length: maxMonthNum }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return `${currentYear}-${month}`;
  });

  // Calculate totals for summary cards
  const latestMonth = months[months.length - 1];
  const totalCurrentWeight = monthlyTotalsWeight.get(latestMonth) || 0;
  const totalCurrentAmount = monthlyTotalsAmount.get(latestMonth) || 0;
  const annualTotalWeight = Array.from(monthlyTotalsWeight.values()).reduce((sum, v) => sum + v, 0);
  const annualTotalAmount = Array.from(monthlyTotalsAmount.values()).reduce((sum, v) => sum + v, 0);

  const handleExcelDownload = () => {
    if (!data) return;

    const exportData: any[] = [];

    // Header row
    const headerRow: any = {
      'B2B사업소': 'B2B사업소',
      'B2B팀': 'B2B팀',
      '산업분류': '산업분류',
      '섹터분류': '섹터분류',
      '구분': '구분',
    };
    months.forEach((month, index) => {
      headerRow[`${index + 1}월`] = `${index + 1}월`;
    });
    headerRow['합계'] = '합계';
    exportData.push(headerRow);

    // Data rows
    tableData.forEach((officeMap, office) => {
      officeMap.forEach((teamMap, team) => {
        teamMap.forEach((industryMap, industry) => {
          industryMap.forEach((sectorData, sector) => {
            // Weight row
            const weightRow: any = {
              'B2B사업소': office,
              'B2B팀': team,
              '산업분류': industry,
              '섹터분류': sector,
              '구분': '중량(L)',
            };
            let weightTotal = 0;
            months.forEach((month, index) => {
              const value = sectorData.weight.get(month) || 0;
              weightRow[`${index + 1}월`] = value;
              weightTotal += value;
            });
            weightRow['합계'] = weightTotal;
            exportData.push(weightRow);

            // Amount row
            const amountRow: any = {
              'B2B사업소': '',
              'B2B팀': '',
              '산업분류': '',
              '섹터분류': '',
              '구분': '매출액(원)',
            };
            let amountTotal = 0;
            months.forEach((month, index) => {
              const value = sectorData.amount.get(month) || 0;
              amountRow[`${index + 1}월`] = value;
              amountTotal += value;
            });
            amountRow['합계'] = amountTotal;
            exportData.push(amountRow);
          });
        });
      });
    });

    // Totals rows
    const weightTotalsRow: any = {
      'B2B사업소': '총합계',
      'B2B팀': '',
      '산업분류': '',
      '섹터분류': '',
      '구분': '중량(L)',
    };
    let grandWeightTotal = 0;
    months.forEach((month, index) => {
      const value = monthlyTotalsWeight.get(month) || 0;
      weightTotalsRow[`${index + 1}월`] = value;
      grandWeightTotal += value;
    });
    weightTotalsRow['합계'] = grandWeightTotal;
    exportData.push(weightTotalsRow);

    const amountTotalsRow: any = {
      'B2B사업소': '',
      'B2B팀': '',
      '산업분류': '',
      '섹터분류': '',
      '구분': '매출액(원)',
    };
    let grandAmountTotal = 0;
    months.forEach((month, index) => {
      const value = monthlyTotalsAmount.get(month) || 0;
      amountTotalsRow[`${index + 1}월`] = value;
      grandAmountTotal += value;
    });
    amountTotalsRow['합계'] = grandAmountTotal;
    exportData.push(amountTotalsRow);

    const filename = generateFilename('B2B팀별');
    exportToExcel(exportData, filename);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Month Summary Card */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">최근 월별 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{getMonthName(latestMonth)} 기준 합계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 중량</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totalCurrentWeight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                연누계 대비 {((totalCurrentWeight / (annualTotalWeight || 1)) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">당월 매출</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totalCurrentAmount)} 원</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                연누계 대비 {((totalCurrentAmount / (annualTotalAmount || 1)) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Annual Total Card */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">연간 누적 실적</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentYear}년 전체 누계</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">연간 총 중량</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{formatNumber(annualTotalWeight)} L</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                전체 {months.length}개월 누적
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">연간 총 매출</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{formatNumber(annualTotalAmount)} 원</p>
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                월평균 {formatNumber(Math.round(annualTotalAmount / (months.length || 1)))} 원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* B2B Team Analysis Table Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {currentYear}년 B2B 팀별 산업/섹터 분석
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-50 dark:bg-zinc-800/50 z-10">
                  B2B사업소
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-[100px] bg-zinc-50 dark:bg-zinc-800/50 z-10">
                  B2B팀
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  산업분류
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  섹터분류
                </th>
                <th className="text-left py-3 px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  구분
                </th>
                {months.map((month, index) => (
                  <th
                    key={month}
                    className="text-right py-3 px-4 text-xs font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {index + 1}월
                  </th>
                ))}
                <th className="text-right py-3 px-4 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider whitespace-nowrap bg-zinc-100 dark:bg-zinc-800">
                  합계
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(tableData.entries()).map(([office, officeMap]) => {
                let officeRowCount = 0;
                officeMap.forEach(teamMap => {
                  teamMap.forEach(industryMap => {
                    officeRowCount += industryMap.size * 2; // 2 rows per sector (weight + amount)
                  });
                });

                let officeRowIndex = 0;

                return Array.from(officeMap.entries()).map(([team, teamMap]) => {
                  let teamRowCount = 0;
                  teamMap.forEach(industryMap => {
                    teamRowCount += industryMap.size * 2;
                  });

                  let teamRowIndex = 0;

                  return Array.from(teamMap.entries()).map(([industry, industryMap]) => {
                    const industryRowCount = industryMap.size * 2;
                    let industryRowIndex = 0;

                    return Array.from(industryMap.entries()).map(([sector, sectorData]) => {
                      const rows = [];
                      const rowKey = `${office}-${team}-${industry}-${sector}`;

                      // Weight row
                      let weightTotal = 0;
                      rows.push(
                        <tr
                          key={`${rowKey}-weight`}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          {officeRowIndex === 0 && teamRowIndex === 0 && industryRowIndex === 0 ? (
                            <td
                              rowSpan={officeRowCount}
                              className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-700 sticky left-0 bg-white dark:bg-zinc-900"
                            >
                              {office}
                            </td>
                          ) : null}
                          {teamRowIndex === 0 && industryRowIndex === 0 ? (
                            <td
                              rowSpan={teamRowCount}
                              className="py-3 px-4 text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700 sticky left-[100px] bg-white dark:bg-zinc-900"
                            >
                              {team}
                            </td>
                          ) : null}
                          {industryRowIndex === 0 ? (
                            <td
                              rowSpan={industryRowCount}
                              className="py-3 px-4 text-zinc-700 dark:text-zinc-300"
                            >
                              {industry}
                            </td>
                          ) : null}
                          {industryRowIndex === 0 ? (
                            <td
                              rowSpan={industryRowCount}
                              className="py-3 px-4 text-zinc-700 dark:text-zinc-300"
                            >
                              {sector}
                            </td>
                          ) : null}
                          <td className="py-3 px-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            중량(L)
                          </td>
                          {months.map(month => {
                            const value = sectorData.weight.get(month) || 0;
                            weightTotal += value;
                            return (
                              <td key={month} className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                                {value > 0 ? formatNumber(value) : '-'}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/50">
                            {formatNumber(weightTotal)}
                          </td>
                        </tr>
                      );

                      // Amount row
                      let amountTotal = 0;
                      rows.push(
                        <tr
                          key={`${rowKey}-amount`}
                          className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="py-3 px-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            매출액(원)
                          </td>
                          {months.map(month => {
                            const value = sectorData.amount.get(month) || 0;
                            amountTotal += value;
                            return (
                              <td key={month} className="py-3 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                                {value > 0 ? formatNumber(value) : '-'}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/50">
                            {formatNumber(amountTotal)}
                          </td>
                        </tr>
                      );

                      officeRowIndex += 2;
                      teamRowIndex += 2;
                      industryRowIndex += 2;

                      return rows;
                    });
                  });
                });
              })}
              {/* Totals Rows */}
              <tr className="bg-zinc-100 dark:bg-zinc-800/70 font-bold">
                <td colSpan={5} className="py-3 px-4 text-zinc-900 dark:text-zinc-100 sticky left-0 bg-zinc-100 dark:bg-zinc-800/70">
                  총합계 - 중량(L)
                </td>
                {months.map(month => {
                  const value = monthlyTotalsWeight.get(month) || 0;
                  return (
                    <td key={month} className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300">
                      {formatNumber(value)}
                    </td>
                  );
                })}
                <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 bg-zinc-200 dark:bg-zinc-700">
                  {formatNumber(Array.from(monthlyTotalsWeight.values()).reduce((sum, v) => sum + v, 0))}
                </td>
              </tr>
              <tr className="bg-zinc-100 dark:bg-zinc-800/70 font-bold">
                <td colSpan={5} className="py-3 px-4 text-zinc-900 dark:text-zinc-100 sticky left-0 bg-zinc-100 dark:bg-zinc-800/70">
                  총합계 - 매출액(원)
                </td>
                {months.map(month => {
                  const value = monthlyTotalsAmount.get(month) || 0;
                  return (
                    <td key={month} className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300">
                      {formatNumber(value)}
                    </td>
                  );
                })}
                <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-300 bg-zinc-200 dark:bg-zinc-700">
                  {formatNumber(Array.from(monthlyTotalsAmount.values()).reduce((sum, v) => sum + v, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Info Section */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-1">필터 조건:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>B2B 팀만 포함 (employee_category.b2c_팀 = 'B2B')</li>
          <li>산업분류 및 섹터분류 기준 (company_type)</li>
          <li>기간: {currentYear}년 (월별)</li>
          <li>단위: L (용량), 원 (매출액)</li>
        </ul>
      </div>
    </div>
  );
}
