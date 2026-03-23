"use client";

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Building, AlertCircle, TrendingDown, Loader2, ChevronRight, ChevronDown, Filter, User, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

interface InactiveCompanyData {
  branch_name: string;
  employee_code?: string;
  employee_name?: string;
  client_code?: string;
  client_name?: string;
  inactive_count?: number;
  inactive_company_names?: string;
  last_period_sales: number;
  avg_days_inactive?: number;
  max_days_inactive?: number;
  days_inactive?: number;
  last_transaction_date?: string;
  earliest_last_transaction?: string;
  latest_last_transaction?: string;
  transaction_count?: number;
}

interface HierarchicalNode {
  key: string;
  label: string;
  level: 'branch' | 'employee' | 'client';
  data: InactiveCompanyData;
  children: HierarchicalNode[];
  isExpanded: boolean;
}

interface FilterOptions {
  branches: string[];
}

export default function InactiveCompaniesPage() {
  const [data, setData] = useState<InactiveCompanyData[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Filters
  const [inactiveMonths, setInactiveMonths] = useState<3 | 6 | 12>(3);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'branch' | 'employee' | 'client'>('branch');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, inactiveMonths, selectedBranches, groupBy]);

  const fetchFilterOptions = async () => {
    try {
      const response = await apiFetch('/api/dashboard/inactive-companies/filters');
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
      // Always fetch client-level data to build hierarchy on frontend
      const params = new URLSearchParams({
        month: selectedMonth,
        inactiveMonths: String(inactiveMonths),
        groupBy: 'client',
        branches: selectedBranches.join(','),
      });

      const response = await apiFetch(`/api/dashboard/inactive-companies?${params}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch inactive companies data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hierarchicalData = useMemo(() => {
    // Build hierarchy based on selected groupBy
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
            inactive_count: 0,
            last_period_sales: 0,
            avg_days_inactive: 0,
            max_days_inactive: 0,
          },
          children: [],
          isExpanded: false,
        });
      }

      const branch = branchMap.get(branchKey)!;

      if (groupBy === 'branch') {
        // Branch -> Client
        branch.children.push({
          key: `${branchKey}-${item.client_code}`,
          label: item.client_name || '미지정',
          level: 'client',
          data: item,
          children: [],
          isExpanded: false,
        });

        // Aggregate to branch
        branch.data.inactive_count = (branch.data.inactive_count || 0) + 1;
        branch.data.last_period_sales += item.last_period_sales;
        if (item.days_inactive !== undefined) {
          branch.data.avg_days_inactive = (branch.data.avg_days_inactive || 0) + item.days_inactive;
          branch.data.max_days_inactive = Math.max(branch.data.max_days_inactive || 0, item.days_inactive);
        }
      } else {
        // groupBy === 'employee' or 'client'
        // Both show Branch -> Employee -> Client for better organization
        const employeeKey = `${branchKey}-${item.employee_code || 'none'}`;
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
              inactive_count: 0,
              last_period_sales: 0,
              avg_days_inactive: 0,
              max_days_inactive: 0,
            },
            children: [],
            isExpanded: false,
          };
          branch.children.push(employee);
        }

        // Add client node
        employee.children.push({
          key: `${employeeKey}-${item.client_code}`,
          label: item.client_name || '미지정',
          level: 'client',
          data: item,
          children: [],
          isExpanded: false,
        });

        // Aggregate to employee
        employee.data.inactive_count = (employee.data.inactive_count || 0) + 1;
        employee.data.last_period_sales += item.last_period_sales;
        if (item.days_inactive !== undefined) {
          employee.data.avg_days_inactive = (employee.data.avg_days_inactive || 0) + item.days_inactive;
          employee.data.max_days_inactive = Math.max(employee.data.max_days_inactive || 0, item.days_inactive);
        }

        // Aggregate to branch
        branch.data.inactive_count = (branch.data.inactive_count || 0) + 1;
        branch.data.last_period_sales += item.last_period_sales;
        if (item.days_inactive !== undefined) {
          branch.data.avg_days_inactive = (branch.data.avg_days_inactive || 0) + item.days_inactive;
          branch.data.max_days_inactive = Math.max(branch.data.max_days_inactive || 0, item.days_inactive);
        }
      }
    });

    // Final pass to calculate averages
    branchMap.forEach(branch => {
      if (branch.data.inactive_count && branch.data.inactive_count > 0) {
        branch.data.avg_days_inactive = (branch.data.avg_days_inactive || 0) / branch.data.inactive_count;
      }
      branch.children.forEach(child => {
        if (child.level === 'employee' && child.data.inactive_count && child.data.inactive_count > 0) {
          child.data.avg_days_inactive = (child.data.avg_days_inactive || 0) / child.data.inactive_count;
        }
      });
    });

    return Array.from(branchMap.values()).sort((a, b) => 
      (b.data.inactive_count || 0) - (a.data.inactive_count || 0)
    );
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

      rows.push(
        <tr key={node.key} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
          hasChildren ? 'bg-zinc-50/50 dark:bg-zinc-800/30' : ''
        }`}>
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
              {node.level === 'client' && <AlertCircle className="w-4 h-4 text-orange-500" />}
              <div className="flex flex-col">
                <span className={hasChildren ? 'font-semibold' : ''}>{node.label}</span>
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400 font-bold">
            {node.data.inactive_count !== undefined ? node.data.inactive_count.toLocaleString() : '-'}
          </td>
          <td className="px-4 py-3 text-sm text-right text-zinc-500 dark:text-zinc-400">
            {node.data.last_transaction_date || '-'}
          </td>
          <td className="px-4 py-3 text-sm text-right font-semibold">
            <span className={`px-2 py-1 rounded ${
              (node.data.days_inactive || node.data.avg_days_inactive || 0) >= 365
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                : (node.data.days_inactive || node.data.avg_days_inactive || 0) >= 180
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
            }`}>
              {Math.round(node.data.days_inactive || node.data.avg_days_inactive || 0)}일
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400 font-semibold">
            ₩{Number(node.data.last_period_sales || 0).toLocaleString()}
          </td>
        </tr>
      );

      if (hasChildren && isExpanded) {
        rows.push(...renderHierarchicalRows(node.children, indent + 1));
      }
    });

    return rows;
  };

  const handleExcelDownload = () => {
    if (data.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData = data.map(item => ({
      '사업소': item.branch_name,
      '담당자': item.employee_name || '',
      '거래처': item.client_name || '',
      '미거래업체 수': item.inactive_count || 1,
      '미거래업체 목록': item.inactive_company_names || '',
      '마지막 거래일': item.last_transaction_date || '',
      '미거래 일수': Math.round(item.days_inactive || item.avg_days_inactive || 0),
      '이전 거래액': item.last_period_sales || 0,
    }));

    const filename = generateFilename('미거래업체현황');
    exportToExcel(exportData, filename);
  };

  const totals = hierarchicalData.reduce((acc, node) => ({
    inactiveCount: acc.inactiveCount + (node.data.inactive_count || 0),
    lastPeriodSales: acc.lastPeriodSales + Number(node.data.last_period_sales || 0),
  }), { inactiveCount: 0, lastPeriodSales: 0 });

  const toggleBranch = (branch: string) => {
    setSelectedBranches(prev =>
      prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            미거래업체 현황
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            {inactiveMonths}개월 이상 거래가 없는 업체 현황
          </p>
        </div>

        <div className="flex items-center gap-3">
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
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={data.length === 0 || isLoading} />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inactive Period Filter */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">미거래 기간</h3>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={inactiveMonths === 3}
                  onChange={() => setInactiveMonths(3)}
                  className="text-red-500"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">3개월 이상</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={inactiveMonths === 6}
                  onChange={() => setInactiveMonths(6)}
                  className="text-red-500"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">6개월 이상</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                <input
                  type="radio"
                  checked={inactiveMonths === 12}
                  onChange={() => setInactiveMonths(12)}
                  className="text-red-500"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">12개월 이상</span>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">총 미거래업체 수</p>
          </div>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">
            {totals.inactiveCount.toLocaleString()}개
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-orange-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">이전 거래액 합계</p>
          </div>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
            ₩{totals.lastPeriodSales.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">미거래 기준</p>
          </div>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {inactiveMonths}개월 이상
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            {groupBy === 'branch' && `사업소별 현황 (${hierarchicalData.length}개)`}
            {groupBy === 'employee' && `담당자별 현황 (${hierarchicalData.length}개 사업소)`}
            {groupBy === 'client' && `거래처별 현황 (${hierarchicalData.length}개 사업소)`}
          </h3>
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
                    미거래업체 수
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    마지막 거래일
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    미거래 일수
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    이전 거래액
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
                  <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                    {totals.inactiveCount.toLocaleString()}개
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-500 dark:text-zinc-400">
                    -
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-zinc-500 dark:text-zinc-400">
                    -
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600 dark:text-blue-400">
                    ₩{totals.lastPeriodSales.toLocaleString()}
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
