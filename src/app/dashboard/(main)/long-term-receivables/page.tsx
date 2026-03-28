"use client";

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Building, DollarSign, TrendingUp, TrendingDown, Loader2, AlertCircle, ChevronRight, ChevronDown, Filter, User } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename, type IslandTable, type IslandSheetData } from '@/lib/excel-export';
import DataLogicInfo from '@/components/DataLogicInfo';

interface ReceivableData {
  branch_name: string;
  employee_code?: string;
  employee_name?: string;
  client_code?: string;
  client_name?: string;
  current_total_receivables: number;
  long_term_receivables: number;
  b2b_long_term_receivables?: number;
  b2c_long_term_receivables?: number;
  b2b_current_total_receivables?: number;
  b2c_current_total_receivables?: number;
  b2b_previous_month_long_term?: number;
  b2c_previous_month_long_term?: number;
  long_term_ratio: number;
  previous_month_long_term: number;
  month_over_month_change: number;
  month_over_month_change_rate: number;
}

interface HierarchicalNode {
  key: string;
  label: string;
  level: 'branch' | 'employee' | 'client';
  data: ReceivableData;
  children: HierarchicalNode[];
  isExpanded: boolean;
}

interface FilterOptions {
  branches: string[];
}

export default function LongTermReceivablesPage() {
  const [data, setData] = useState<ReceivableData[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Filters
  const [agingMonths, setAgingMonths] = useState<3 | 5>(3);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'branch' | 'employee' | 'client'>('branch');
  const [showFilters, setShowFilters] = useState(false);

  // Tabs and monthly detail
  const [activeTab, setActiveTab] = useState('합계');
  const [monthlyDetailData, setMonthlyDetailData] = useState<Record<string, any[]>>({});
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
    fetchMonthlyDetail();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, agingMonths, selectedBranches, groupBy]);

  useEffect(() => {
    fetchMonthlyDetail();
  }, [selectedMonth]);

  const fetchFilterOptions = async () => {
    try {
      const response = await apiFetch('/api/dashboard/long-term-receivables/filters');
      const result = await response.json();
      if (result.success) {
        setFilterOptions(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        month: selectedMonth,
        agingMonths: String(agingMonths),
        groupBy: groupBy,
        branches: selectedBranches.join(','),
      });

      const response = await apiFetch(`/api/dashboard/long-term-receivables?${params}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch long-term receivables data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyDetail = async () => {
    try {
      const params = new URLSearchParams({
        month: selectedMonth,
      });

      const response = await apiFetch(`/api/dashboard/long-term-receivables/monthly-detail?${params}`);
      const result = await response.json();
      if (result.success) {
        setMonthlyDetailData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch monthly detail data:', error);
    }
  };

  const hierarchicalData = useMemo(() => {
    if (groupBy === 'branch') {
      return data.map(item => {
        const children: HierarchicalNode[] = [];

        // Add B2B child if there's B2B receivables
        if (item.b2b_long_term_receivables && item.b2b_long_term_receivables > 0) {
          const b2bCurrentTotal = item.b2b_current_total_receivables || 0;
          const b2bLongTerm = item.b2b_long_term_receivables || 0;
          const b2bPrevious = item.b2b_previous_month_long_term || 0;
          const b2bChange = b2bLongTerm - b2bPrevious;
          const b2bChangeRate = b2bPrevious > 0 ? (b2bChange / b2bPrevious) * 100 : 0;
          const b2bRatio = b2bCurrentTotal > 0 ? (b2bLongTerm / b2bCurrentTotal) * 100 : 0;

          children.push({
            key: `${item.branch_name}-b2b`,
            label: 'B2B',
            level: 'client' as const,
            data: {
              ...item,
              current_total_receivables: b2bCurrentTotal,
              long_term_receivables: b2bLongTerm,
              previous_month_long_term: b2bPrevious,
              month_over_month_change: b2bChange,
              month_over_month_change_rate: b2bChangeRate,
              long_term_ratio: b2bRatio,
            },
            children: [],
            isExpanded: false,
          });
        }

        // Add B2C child if there's B2C receivables
        if (item.b2c_long_term_receivables && item.b2c_long_term_receivables > 0) {
          const b2cCurrentTotal = item.b2c_current_total_receivables || 0;
          const b2cLongTerm = item.b2c_long_term_receivables || 0;
          const b2cPrevious = item.b2c_previous_month_long_term || 0;
          const b2cChange = b2cLongTerm - b2cPrevious;
          const b2cChangeRate = b2cPrevious > 0 ? (b2cChange / b2cPrevious) * 100 : 0;
          const b2cRatio = b2cCurrentTotal > 0 ? (b2cLongTerm / b2cCurrentTotal) * 100 : 0;

          children.push({
            key: `${item.branch_name}-b2c`,
            label: 'B2C',
            level: 'client' as const,
            data: {
              ...item,
              current_total_receivables: b2cCurrentTotal,
              long_term_receivables: b2cLongTerm,
              previous_month_long_term: b2cPrevious,
              month_over_month_change: b2cChange,
              month_over_month_change_rate: b2cChangeRate,
              long_term_ratio: b2cRatio,
            },
            children: [],
            isExpanded: false,
          });
        }

        return {
          key: item.branch_name,
          label: item.branch_name,
          level: 'branch' as const,
          data: item,
          children,
          isExpanded: false,
        };
      });
    }

    // Build hierarchy for employee or client grouping
    const branchMap = new Map<string, HierarchicalNode>();

    data.forEach(item => {
      const branchKey = item.branch_name;

      if (!branchMap.has(branchKey)) {
        branchMap.set(branchKey, {
          key: branchKey,
          label: branchKey,
          level: 'branch',
          data: {
            branch_name: branchKey,
            current_total_receivables: 0,
            long_term_receivables: 0,
            b2b_long_term_receivables: 0,
            b2c_long_term_receivables: 0,
            long_term_ratio: 0,
            previous_month_long_term: 0,
            month_over_month_change: 0,
            month_over_month_change_rate: 0,
          },
          children: [],
          isExpanded: false,
        });
      }

      const branch = branchMap.get(branchKey)!;

      if (groupBy === 'employee' && item.employee_name) {
        const employeeKey = `${branchKey}-${item.employee_code}`;
        let employee = branch.children.find(c => c.key === employeeKey);

        if (!employee) {
          employee = {
            key: employeeKey,
            label: item.employee_name,
            level: 'employee',
            data: {
              branch_name: branchKey,
              employee_code: item.employee_code,
              employee_name: item.employee_name,
              current_total_receivables: 0,
              long_term_receivables: 0,
              b2b_long_term_receivables: 0,
              b2c_long_term_receivables: 0,
              long_term_ratio: 0,
              previous_month_long_term: 0,
              month_over_month_change: 0,
              month_over_month_change_rate: 0,
            },
            children: [],
            isExpanded: false,
          };
          branch.children.push(employee);
        }

        // Aggregate to employee
        employee.data.current_total_receivables += item.current_total_receivables;
        employee.data.long_term_receivables += item.long_term_receivables;
        employee.data.previous_month_long_term += item.previous_month_long_term;
        employee.data.month_over_month_change += item.month_over_month_change;

        // Aggregate to branch
        branch.data.current_total_receivables += item.current_total_receivables;
        branch.data.long_term_receivables += item.long_term_receivables;
        branch.data.previous_month_long_term += item.previous_month_long_term;
        branch.data.month_over_month_change += item.month_over_month_change;
      } else if (groupBy === 'client' && item.client_name) {
        const clientKey = `${branchKey}-${item.employee_code}-${item.client_code}`;

        // Find or create employee node
        const employeeKey = `${branchKey}-${item.employee_code}`;
        let employee = branch.children.find(c => c.key === employeeKey);

        if (!employee) {
          employee = {
            key: employeeKey,
            label: item.employee_name || '미지정',
            level: 'employee',
            data: {
              branch_name: branchKey,
              employee_code: item.employee_code,
              employee_name: item.employee_name,
              current_total_receivables: 0,
              long_term_receivables: 0,
              long_term_ratio: 0,
              previous_month_long_term: 0,
              month_over_month_change: 0,
              month_over_month_change_rate: 0,
            },
            children: [],
            isExpanded: false,
          };
          branch.children.push(employee);
        }

        // Add client node
        employee.children.push({
          key: clientKey,
          label: item.client_name,
          level: 'client',
          data: item,
          children: [],
          isExpanded: false,
        });

        // Aggregate to employee
        employee.data.current_total_receivables += item.current_total_receivables;
        employee.data.long_term_receivables += item.long_term_receivables;
        employee.data.previous_month_long_term += item.previous_month_long_term;
        employee.data.month_over_month_change += item.month_over_month_change;

        // Aggregate to branch
        branch.data.current_total_receivables += item.current_total_receivables;
        branch.data.long_term_receivables += item.long_term_receivables;
        branch.data.previous_month_long_term += item.previous_month_long_term;
        branch.data.month_over_month_change += item.month_over_month_change;
      }
    });

    // Calculate ratios and rates for aggregated nodes
    branchMap.forEach(branch => {
      if (branch.data.current_total_receivables > 0) {
        branch.data.long_term_ratio = (branch.data.long_term_receivables / branch.data.current_total_receivables) * 100;
      }
      if (branch.data.previous_month_long_term > 0) {
        branch.data.month_over_month_change_rate = (branch.data.month_over_month_change / branch.data.previous_month_long_term) * 100;
      }

      branch.children.forEach(employee => {
        if (employee.data.current_total_receivables > 0) {
          employee.data.long_term_ratio = (employee.data.long_term_receivables / employee.data.current_total_receivables) * 100;
        }
        if (employee.data.previous_month_long_term > 0) {
          employee.data.month_over_month_change_rate = (employee.data.month_over_month_change / employee.data.previous_month_long_term) * 100;
        }
      });
    });

    return Array.from(branchMap.values());
  }, [data, groupBy]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (key: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allKeys = new Set<string>();
    const collectKeys = (nodes: HierarchicalNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allKeys.add(node.key);
          collectKeys(node.children);
        }
      });
    };
    collectKeys(hierarchicalData);
    setExpandedNodes(allKeys);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const renderHierarchicalRows = (nodes: HierarchicalNode[], indent: number = 0) => {
    const rows: any[] = [];

    nodes.forEach((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedNodes.has(node.key);
      const momChange = node.data.month_over_month_change;
      const momChangeRate = node.data.month_over_month_change_rate;

      const isB2BOrB2C = node.label === 'B2B' || node.label === 'B2C';
      const rowBgClass = isB2BOrB2C
        ? node.label === 'B2B'
          ? 'bg-blue-50/30 dark:bg-blue-900/10'
          : 'bg-green-50/30 dark:bg-green-900/10'
        : hasChildren
        ? 'bg-zinc-50/50 dark:bg-zinc-800/30'
        : '';

      rows.push(
        <tr key={node.key} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${rowBgClass}`}>
          <td
            className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 cursor-pointer"
            style={{ paddingLeft: `${1 + indent * 1.5}rem` }}
            onClick={() => hasChildren && toggleNode(node.key)}
          >
            <div className="flex items-center gap-2">
              {hasChildren && (
                isExpanded ?
                  <ChevronDown className="w-4 h-4 text-zinc-400" /> :
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
              )}
              {!hasChildren && <span className="w-4" />}
              {node.level === 'branch' && <Building className="w-4 h-4 text-blue-500" />}
              {node.level === 'employee' && <User className="w-4 h-4 text-green-500" />}
              {node.level === 'client' && !isB2BOrB2C && <DollarSign className="w-4 h-4 text-orange-500" />}
              <span className={`${hasChildren ? 'font-semibold' : ''} ${isB2BOrB2C ? 'text-sm font-medium' : ''} ${node.label === 'B2B' ? 'text-blue-600 dark:text-blue-400' : node.label === 'B2C' ? 'text-green-600 dark:text-green-400' : ''}`}>
                {node.label}
              </span>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400 font-semibold">
            ₩{Number(node.data.current_total_receivables).toLocaleString()}
          </td>
          <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400 font-bold">
            ₩{Number(node.data.long_term_receivables).toLocaleString()}
          </td>
          <td className="px-4 py-3 text-sm text-right font-semibold">
            <span className={`px-2 py-1 rounded ${
              node.data.long_term_ratio >= 30
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                : node.data.long_term_ratio >= 15
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            }`}>
              {node.data.long_term_ratio.toFixed(2)}%
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-right text-zinc-500 dark:text-zinc-400">
            ₩{Number(node.data.previous_month_long_term).toLocaleString()}
          </td>
          <td className="px-4 py-3 text-sm text-right font-semibold">
            <span className={momChange >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
              {momChange >= 0 ? '+' : ''}₩{momChange.toLocaleString()}
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-right font-bold">
            <div className="flex items-center justify-end gap-1">
              {momChange >= 0 ? (
                <TrendingUp className="w-3 h-3 text-red-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-green-500" />
              )}
              <span className={momChange >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                {momChangeRate >= 0 ? '+' : ''}{momChangeRate.toFixed(1)}%
              </span>
            </div>
          </td>
        </tr>
      );

      if (hasChildren && isExpanded) {
        rows.push(...renderHierarchicalRows(node.children, indent + 1));
      }
    });

    return rows;
  };

  const handleExcelDownload = async () => {
    if (data.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    setIsExporting(true);
    try {
      const sheets: IslandSheetData[] = [];

      // 1. "합계" Sheet: Overall summary by branch
      const summaryIslands: IslandTable[] = [];
      const branchSummaryData = data.filter(d => !d.employee_name && !d.client_name);
      
      summaryIslands.push({
        title: `장기미수금 현황 총괄 (${selectedMonth})`,
        headers: ['사업소', '당월 총 미수금', `${agingMonths}개월 이상 장기미수금`, '장기미수비율(%)', '전월 장기미수', '전월대비 증감', '증감률(%)'],
        data: [
          ...branchSummaryData.map(item => [
            item.branch_name,
            item.current_total_receivables,
            item.long_term_receivables,
            Number(item.long_term_ratio.toFixed(2)),
            item.previous_month_long_term,
            item.month_over_month_change,
            Number(item.month_over_month_change_rate.toFixed(2))
          ]),
          ['전체합계', totals.currentTotal, totals.longTerm, Number(totalLongTermRatio.toFixed(2)), totals.previousMonth, totalMoMChange, Number(totalMoMChangeRate.toFixed(2))]
        ]
      });

      sheets.push({ name: '전체합계', islands: summaryIslands, referenceDate: selectedMonth });

      // 2. Individual Branch Sheets: Client details
      const branches = Object.keys(monthlyDetailData).sort();
      for (const branch of branches) {
        const branchClients = monthlyDetailData[branch];
        if (!branchClients || branchClients.length === 0) continue;

        const branchIslands: IslandTable[] = [];
        branchIslands.push({
          title: `${branch} 거래처별 미수금 내역`,
          headers: ['거래처명', '담당자', '구분', '당월매출', '당월수금', '기타차액', '현재잔액', '미회수액'],
          data: branchClients.map(client => {
            const m = client.monthly_breakdown?.find((mb: any) => mb.month === selectedMonth) || {};
            return [
              client.client_name,
              client.employee_name || '미지정',
              client.business_type,
              m.sales || 0,
              m.collections || 0,
              m.adjustments || 0,
              m.balance || 0,
              m.uncollected || 0
            ];
          })
        });

        sheets.push({ name: branch, islands: branchIslands, referenceDate: selectedMonth });
      }

      const { exportMultiSheetIslandTables } = await import('@/lib/excel-export');
      exportMultiSheetIslandTables(sheets, generateFilename('장기미수금_통합보고서'));
    } catch (error) {
      console.error('Long-term receivables export error:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const totals = hierarchicalData.reduce((acc, node) => ({
    currentTotal: acc.currentTotal + Number(node.data.current_total_receivables || 0),
    longTerm: acc.longTerm + Number(node.data.long_term_receivables || 0),
    previousMonth: acc.previousMonth + Number(node.data.previous_month_long_term || 0),
  }), { currentTotal: 0, longTerm: 0, previousMonth: 0 });

  const totalLongTermRatio = totals.currentTotal > 0 ? (totals.longTerm / totals.currentTotal) * 100 : 0;
  const totalMoMChange = totals.longTerm - totals.previousMonth;
  const totalMoMChangeRate = totals.previousMonth > 0 ? (totalMoMChange / totals.previousMonth) * 100 : 0;

  const toggleBranch = (branch: string) => {
    setSelectedBranches(prev =>
      prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
    );
  };

  const expandAllClients = () => {
    if (!monthlyDetailData[activeTab]) return;
    const allClientCodes = new Set(monthlyDetailData[activeTab].map((c: any) => c.client_code));
    setExpandedClients(allClientCodes);
  };

  const collapseAllClients = () => {
    setExpandedClients(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            장기미수금 현황
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            사업소별 {agingMonths}개월 이상 장기미수금 현황
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isExporting && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">조회 월:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 font-semibold cursor-pointer"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={data.length === 0 || isLoading || isExporting} />
        </div>
      </div>

      <DataLogicInfo 
        title="장기미수금"
        description="채권 잔액 분석표(Excel)의 기초 잔액과 시스템 내의 실시간 전표 데이터를 결합하여 산출합니다."
        steps={[
          "기초 잔액 반영: 2026년 2월 1일 기준 채권잔액분석표(EBZ007R.xlsx)의 이월 금액을 시작점으로 설정합니다.",
          "매출 및 수금 합산: 2월 1일 이후 발생한 매출(차변)과 수금(대변) 전표를 실시간으로 반영합니다.",
          "FIFO(선입선출) 로직: 발생한 수금액은 가장 오래된 기초 잔액부터 우선적으로 차감하여 변제 처리합니다.",
          "잔액(Balance) 계산: '기초 잔액 + 기간 내 매출 총액 - 기간 내 수금 총액'으로 최종 미수금을 산출합니다.",
          "미회수액 계산: 해당 월의 매출액 중 잔액으로 남아있는 금액을 산출합니다. (로직: Min(당월 매출, 현재 잔액))",
          "장기미수 분류: 설정된 기준(3개월/5개월)에 따라 변제되지 않은 과거 매출분을 적색으로 표시합니다."
        ]}
        footnote="※ 본 화면의 '잔액'은 해당 월 말일 시점의 총 채권을 의미하며, '미회수액'은 당월 매출분 중 미결제액을 의미합니다."
      />

      {/* Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Aging Period Filter */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">미수금 기간</h3>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={agingMonths === 3}
                  onChange={() => setAgingMonths(3)}
                  className="text-red-500"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">3개월 이상</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={agingMonths === 5}
                  onChange={() => setAgingMonths(5)}
                  className="text-red-500"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">5개월 이상</span>
              </label>
            </div>
          </div>

          {/* Grouping Filter */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">집계 방식</h3>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={groupBy === 'branch'}
                  onChange={() => setGroupBy('branch')}
                  className="text-blue-500"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업소별</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={groupBy === 'employee'}
                  onChange={() => setGroupBy('employee')}
                  className="text-blue-500"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">담당자별 (사업소 &gt; 담당자)</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={groupBy === 'client'}
                  onChange={() => setGroupBy('client')}
                  className="text-blue-500"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">거래처별 (사업소 &gt; 담당자 &gt; 거래처)</span>
              </label>
            </div>
          </div>

          {/* Branch Filter */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">사업소 필터</h3>
              {selectedBranches.length > 0 && (
                <span className="ml-auto text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300">
                  {selectedBranches.length}개 선택
                </span>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
              {filterOptions?.branches.map((branch) => (
                <label key={branch} className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(branch)}
                    onChange={() => toggleBranch(branch)}
                    className="rounded border-zinc-300 dark:border-zinc-600"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{branch}</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-zinc-500 mt-2">
              {selectedBranches.length > 0 ? `${selectedBranches.length}개 선택됨` : '전체 포함'}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">당월 총 미수금</p>
          </div>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            ₩{totals.currentTotal.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{agingMonths}개월 이상 장기미수금</p>
          </div>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">
            ₩{totals.longTerm.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">장기미수금 비율</p>
          </div>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {totalLongTermRatio.toFixed(2)}%
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            {totalMoMChange >= 0 ? (
              <TrendingUp className="w-4 h-4 text-red-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-500" />
            )}
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">전월대비 증감</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className={`text-xl font-bold ${totalMoMChange >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {totalMoMChange >= 0 ? '+' : ''}₩{totalMoMChange.toLocaleString()}
            </p>
            <p className={`text-sm font-medium ${totalMoMChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              ({totalMoMChangeRate >= 0 ? '+' : ''}{totalMoMChangeRate.toFixed(1)}%)
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-t-xl overflow-x-auto">
        <div className="flex gap-1 p-2 min-w-max">
          <button
            onClick={() => setActiveTab('합계')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === '합계'
                ? 'bg-blue-500 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            합계
          </button>
          {Object.keys(monthlyDetailData).sort().map(branch => (
            <button
              key={branch}
              onClick={() => setActiveTab(branch)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === branch
                  ? 'bg-blue-500 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {branch}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table or Client Detail View */}
      {activeTab === '합계' ? (
        <div className="rounded-b-xl border border-t-0 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {groupBy === 'branch' && `사업소별 현황 (${hierarchicalData.length}개)`}
            {groupBy === 'employee' && `담당자별 현황 (${hierarchicalData.length}개 사업소)`}
            {groupBy === 'client' && `거래처별 현황 (${hierarchicalData.length}개 사업소)`}
          </h3>
          {groupBy !== 'branch' && (
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
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-zinc-500">데이터를 불러오는 중...</p>
          </div>
        ) : hierarchicalData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <Building className="w-12 h-12 mb-3 opacity-50" />
            <p>조회된 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    구분
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    당월 총 미수금
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    {agingMonths}개월 이상<br/>장기미수금
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    장기미수금<br/>비율
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    전월<br/>장기미수
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    전월대비<br/>증감
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    증감률
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {renderHierarchicalRows(hierarchicalData)}
                {/* Totals Row */}
                <tr className="bg-zinc-100 dark:bg-zinc-800 font-bold">
                  <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                    합계
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400">
                    ₩{totals.currentTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                    ₩{totals.longTerm.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`px-2 py-1 rounded ${
                      totalLongTermRatio >= 30
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : totalLongTermRatio >= 15
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}>
                      {totalLongTermRatio.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-500 dark:text-zinc-400">
                    ₩{totals.previousMonth.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={totalMoMChange >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                      {totalMoMChange >= 0 ? '+' : ''}₩{totalMoMChange.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex items-center justify-end gap-1">
                      {totalMoMChange >= 0 ? (
                        <TrendingUp className="w-3 h-3 text-red-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-green-500" />
                      )}
                      <span className={totalMoMChange >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                        {totalMoMChangeRate >= 0 ? '+' : ''}{totalMoMChangeRate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        </div>
      ) : (
        <div className="rounded-b-xl border border-t-0 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {activeTab} - 거래처별 월별 내역 ({monthlyDetailData[activeTab]?.length || 0}개)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={expandAllClients}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            >
              모두 펼치기
            </button>
            <button
              onClick={collapseAllClients}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              모두 접기
            </button>
          </div>
        </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-zinc-500">데이터를 불러오는 중...</p>
            </div>
          ) : !monthlyDetailData[activeTab] || monthlyDetailData[activeTab].length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <Building className="w-12 h-12 mb-3 opacity-50" />
              <p>조회된 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {monthlyDetailData[activeTab]?.map((client: any) => {
                const isExpanded = expandedClients.has(client.client_code);
                const hasMonthlyData = client.monthly_breakdown && client.monthly_breakdown.length > 0;
                const currentMonthData = client.monthly_breakdown.find((m: any) => m.month === selectedMonth);

                return (
                  <div key={client.client_code} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    {/* Collapsed Summary Row */}
                    <div
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => {
                        const newExpanded = new Set(expandedClients);
                        if (isExpanded) {
                          newExpanded.delete(client.client_code);
                        } else {
                          newExpanded.add(client.client_code);
                        }
                        setExpandedClients(newExpanded);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {hasMonthlyData && (
                            isExpanded ?
                              <ChevronDown className="w-5 h-5 text-zinc-400 flex-shrink-0" /> :
                              <ChevronRight className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                          )}
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {client.client_name}
                            </div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                              담당자: {client.employee_name || '미지정'}
                              <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                client.business_type === 'B2B'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              }`}>
                                {client.business_type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Monthly Summary */}
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <div className="text-zinc-500 dark:text-zinc-400 text-xs">매출</div>
                          <div className="font-semibold text-blue-600 dark:text-blue-400">
                            ₩{currentMonthData?.sales?.toLocaleString() || '0'}
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-500 dark:text-zinc-400 text-xs">수금</div>
                          <div className="font-semibold text-green-600 dark:text-green-400">
                            ₩{currentMonthData?.collections?.toLocaleString() || '0'}
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-500 dark:text-zinc-400 text-xs">기타할인등차액</div>
                          <div className="font-semibold">
                            ₩{currentMonthData?.adjustments?.toLocaleString() || '0'}
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-500 dark:text-zinc-400 text-xs">잔액</div>
                          <div className={`font-bold ${
                            (currentMonthData?.balance || 0) > 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}>
                            ₩{currentMonthData?.balance?.toLocaleString() || '0'}
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-500 dark:text-zinc-400 text-xs">미회수액</div>
                          <div className={`font-bold ${
                            (currentMonthData?.uncollected || 0) > 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}>
                            ₩{currentMonthData?.uncollected?.toLocaleString() || '0'}
                          </div>
                        </div>
                      </div>

                      {/* Recent 3 Months Summary */}
                      {client.recent_3_months && (
                        <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">최근 3개월</div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-zinc-600 dark:text-zinc-400">매출:</span>
                              <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                                ₩{client.recent_3_months.sales?.toLocaleString() || '0'}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-600 dark:text-zinc-400">수금:</span>
                              <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                                ₩{client.recent_3_months.collections?.toLocaleString() || '0'}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-600 dark:text-zinc-400">잔액증가:</span>
                              <span className={`ml-2 font-semibold ${
                                (client.recent_3_months.balance_change || 0) > 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-green-600 dark:text-green-400'
                              }`}>
                                {(client.recent_3_months.balance_change || 0) >= 0 ? '+' : ''}₩{client.recent_3_months.balance_change?.toLocaleString() || '0'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expanded Monthly Breakdown */}
                    {isExpanded && hasMonthlyData && (
                      <div className="px-6 pb-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-zinc-100 dark:bg-zinc-800">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300">월</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">매출</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">수금</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">기타할인등차액</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">잔액</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">미회수액</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                              {client.monthly_breakdown.map((monthData: any, idx: number) => (
                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{monthData.month}</td>
                                  <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">
                                    ₩{monthData.sales?.toLocaleString() || '0'}
                                  </td>
                                  <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">
                                    ₩{monthData.collections?.toLocaleString() || '0'}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    ₩{monthData.adjustments?.toLocaleString() || '0'}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-semibold ${
                                    (monthData.balance || 0) > 0
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-zinc-600 dark:text-zinc-400'
                                  }`}>
                                    ₩{monthData.balance?.toLocaleString() || '0'}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-semibold ${
                                    (monthData.uncollected || 0) > 0
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-zinc-600 dark:text-zinc-400'
                                  }`}>
                                    ₩{monthData.uncollected?.toLocaleString() || '0'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
