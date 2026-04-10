"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, Users, ChevronDown, ChevronRight, Search, UserPlus, AlertCircle, CheckCircle2, Package, RefreshCw, Tag, Database, Folder } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useDisplayOrderBootstrap } from '@/hooks/useDisplayOrderBootstrap';
import { compareOffices, compareTeams } from '@/lib/display-order-core';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';

type CategoryType = 'tier' | 'division' | 'family' | 'business_type';

/**
 * UI / Excel column title for the active 집계 기준.
 * tier: NOT two separate filters — one CASE() that reads 품목그룹1코드 and 품목그룹3코드 together per line (→ Standard/Premium/…).
 */
function categoryTypeUiLabel(type: CategoryType): string {
  switch (type) {
    case 'tier':
      return '등급 (품목1·3코드 CASE 조합)';
    case 'division':
      return '모빌제품 (품목그룹1코드)';
    case 'family':
      return '제품군 (제품군·품목1코드)';
    case 'business_type':
      return 'AUTO 제품 (Fleet/LCC)';
  }
}

interface ProductType {
  category: string;
  product_family?: string;
  total_weight: number;
  total_amount: number;
}

interface Client {
  client_code: string;
  client_name: string;
  client_group: string;
  industry: string;
  sector: string;
  last_year_weight: number;
  last_year_amount: number;
  current_year_weight: number;
  current_year_amount: number;
  new_client_date: string;
  product_types?: ProductType[];
}

interface ProductCategoryGroup {
  category: string;
  clients: Client[];
  client_count: number;
  total_weight: number;
  total_amount: number;
}

interface EmployeeAssignment {
  employee_code: string;
  employee_name: string;
  b2b_team: string;
  b2c_team: string;
  branch: string;
  clients: Client[];
  product_categories?: ProductCategoryGroup[];
  total_last_year_weight: number;
  total_last_year_amount: number;
  total_current_year_weight: number;
  total_current_year_amount: number;
  client_count: number;
}

interface Employee {
  employee_code: string;
  employee_name: string;
  b2b_team: string;
  b2c_team: string;
  branch: string;
}

interface BranchAssignment {
  branch_name: string;
  employees: EmployeeAssignment[];
  total_clients: number;
}

const TEAM_PAIR_SEP = '\u0001';

/** 사업소 미지정 bucket — listed after all named branches, with a section divider */
const UNASSIGNED_BRANCH = '미배정';

function sortBranchesWithUnassignedLast(
  branches: BranchAssignment[],
  officeMap: Map<string, number>
): BranchAssignment[] {
  const assigned = branches
    .filter((b) => b.branch_name !== UNASSIGNED_BRANCH)
    .sort((a, b) => compareOffices(a.branch_name, b.branch_name, officeMap));
  const unassigned = branches.filter((b) => b.branch_name === UNASSIGNED_BRANCH);
  return [...assigned, ...unassigned];
}

function normalizeTeamField(s: string | undefined | null): string {
  return (s ?? '').trim();
}

/** Stable key for grouping — full (b2b, b2c) pair so folders stay distinct. */
function teamPairKey(emp: Pick<EmployeeAssignment, 'b2b_team' | 'b2c_team'>): string {
  return `${normalizeTeamField(emp.b2b_team)}${TEAM_PAIR_SEP}${normalizeTeamField(emp.b2c_team)}`;
}

/** b2c에 실제 팀이 아니라 채널 표기(B2B/b2b/auto)만 있으면 → B2B 담당, b2b_team만 노출 */
function isB2cFieldChannelMarker(b2c: string): boolean {
  return /^(b2b|auto)$/i.test(normalizeTeamField(b2c));
}

/** b2b에 실제 팀이 아니라 채널 표기(AUTO/b2b/auto)만 있으면 → B2C 담당, b2c_team만 노출 */
function isB2bFieldChannelMarker(b2b: string): boolean {
  return /^(b2b|auto)$/i.test(normalizeTeamField(b2b));
}

/** 실제 팀 이름만 표시(접두어 없음). 예: 산업4팀, 6.사무실(중부) */
function formatContextualTeamLabel(emp: Pick<EmployeeAssignment, 'b2b_team' | 'b2c_team'>): string {
  const b2b = normalizeTeamField(emp.b2b_team);
  const b2c = normalizeTeamField(emp.b2c_team);

  const b2cIsMarker = isB2cFieldChannelMarker(b2c);
  const b2bIsMarker = isB2bFieldChannelMarker(b2b);

  if (b2cIsMarker && !b2bIsMarker) {
    return b2b || '미배정';
  }
  if (b2bIsMarker && !b2cIsMarker) {
    return b2c || '미배정';
  }
  if (b2cIsMarker && b2bIsMarker) {
    return '미배정';
  }
  if (b2b && b2c) {
    return `${b2b} / ${b2c}`;
  }
  if (b2b) return b2b;
  if (b2c) return b2c;
  return '미배정';
}

export default function ClientAssignmentManager() {
  const displayOrder = useDisplayOrderBootstrap();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeAssignments, setEmployeeAssignments] = useState<EmployeeAssignment[]>([]);
  const [branchAssignments, setBranchAssignments] = useState<BranchAssignment[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedProductCategories, setExpandedProductCategories] = useState<Set<string>>(new Set());
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [reassignMode, setReassignMode] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState('');
  const [showProducts, setShowProducts] = useState(true);
  const [categoryType, setCategoryType] = useState<CategoryType>('tier');

  const [isLoading, setIsLoading] = useState(true);
  const [isReassigning, setIsReassigning] = useState(false);
  const [isRefreshingProducts, setIsRefreshingProducts] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedEmployee, showProducts, categoryType, displayOrder.ready]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEmployee) params.append('employee', selectedEmployee);
      if (searchQuery) params.append('search', searchQuery);
      if (showProducts) {
        params.append('includeProducts', 'true');
        params.append('categoryType', categoryType);
      }

      const url = `/api/dashboard/client-assignments?${params.toString()}`;
      const response = await apiFetch(url);
      const result = await response.json();

      if (result.success) {
        // Process employee assignments to group clients by product category
        const processedEmployeeAssignments = result.data.employeeAssignments.map((emp: EmployeeAssignment) => {
          if (showProducts && emp.clients && emp.clients.length > 0) {
            // Group clients by product category
            const categoryMap = new Map<string, Client[]>();

            emp.clients.forEach((client: Client) => {
              if (client.product_types && client.product_types.length > 0) {
                // Add client to each category they have
                client.product_types.forEach((pt: ProductType) => {
                  if (!categoryMap.has(pt.category)) {
                    categoryMap.set(pt.category, []);
                  }
                  categoryMap.get(pt.category)!.push(client);
                });
              } else {
                // Clients without product types go to "미분류" (Unclassified)
                if (!categoryMap.has('미분류')) {
                  categoryMap.set('미분류', []);
                }
                categoryMap.get('미분류')!.push(client);
              }
            });

            // Convert map to array of ProductCategoryGroup
            emp.product_categories = Array.from(categoryMap.entries()).map(([category, clients]) => {
              // Calculate total weight/amount for this category
              const totalWeight = clients.reduce((sum, client) => {
                const categoryProduct = client.product_types?.find(pt => pt.category === category);
                return sum + (categoryProduct?.total_weight || 0);
              }, 0);

              const totalAmount = clients.reduce((sum, client) => {
                const categoryProduct = client.product_types?.find(pt => pt.category === category);
                return sum + (categoryProduct?.total_amount || 0);
              }, 0);

              return {
                category,
                clients,
                client_count: clients.length,
                total_weight: totalWeight,
                total_amount: totalAmount
              };
            }).sort((a, b) => b.total_weight - a.total_weight); // Sort by weight descending
          }

          return emp;
        });

        setEmployeeAssignments(processedEmployeeAssignments);
        setAllEmployees(result.data.allEmployees);

        // Group by branches
        const branchMap = new Map<string, BranchAssignment>();

        processedEmployeeAssignments.forEach((emp: EmployeeAssignment) => {
          const branchName = emp.branch || UNASSIGNED_BRANCH;

          if (!branchMap.has(branchName)) {
            branchMap.set(branchName, {
              branch_name: branchName,
              employees: [],
              total_clients: 0
            });
          }

          const branch = branchMap.get(branchName)!;
          branch.employees.push(emp);
          branch.total_clients += emp.client_count;
        });

        const branchArray = sortBranchesWithUnassignedLast(Array.from(branchMap.values()), displayOrder.office);
        setBranchAssignments(branchArray);

        console.log('Branch assignments:', branchArray);

        // Auto-expand all branches and employees (but keep product categories collapsed)
        setExpandedBranches(
          new Set(
            branchArray.filter((b) => b.branch_name !== UNASSIGNED_BRANCH).map((b) => b.branch_name)
          )
        );

        const allEmployees = new Set<string>();
        const allTeamKeys = new Set<string>();

        branchArray.forEach(branch => {
          branch.employees.forEach(emp => {
            allEmployees.add(emp.employee_name);
            allTeamKeys.add(`${branch.branch_name}|${teamPairKey(emp)}`);
          });
        });

        setExpandedTeams(allTeamKeys);
        setExpandedEmployees(allEmployees);
        // Product categories remain collapsed so users can see all categories at a glance
      }
    } catch (error) {
      console.error('Failed to fetch client assignments:', error);
      setMessage({ type: 'error', text: '데이터를 불러오는데 실패했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchData();
  };

  const toggleEmployee = (employeeName: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeName)) {
      newExpanded.delete(employeeName);
    } else {
      newExpanded.add(employeeName);
    }
    setExpandedEmployees(newExpanded);
  };

  const toggleBranch = (branchName: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branchName)) {
      newExpanded.delete(branchName);
    } else {
      newExpanded.add(branchName);
    }
    setExpandedBranches(newExpanded);
  };

  const teamFolderKey = (branchName: string, pairKey: string) => `${branchName}|${pairKey}`;

  const toggleTeam = (branchName: string, pairKey: string) => {
    const key = teamFolderKey(branchName, pairKey);
    const next = new Set(expandedTeams);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedTeams(next);
  };

  const toggleProductCategory = (employeeName: string, category: string) => {
    const key = `${employeeName}:${category}`;
    const newExpanded = new Set(expandedProductCategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedProductCategories(newExpanded);
  };

  const toggleClientSelection = (clientCode: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientCode)) {
      newSelected.delete(clientCode);
    } else {
      newSelected.add(clientCode);
    }
    setSelectedClients(newSelected);
  };

  const selectAllClientsForEmployee = (clients: Client[]) => {
    const newSelected = new Set(selectedClients);
    const allSelected = clients.every(c => selectedClients.has(c.client_code));

    if (allSelected) {
      clients.forEach(c => newSelected.delete(c.client_code));
    } else {
      clients.forEach(c => newSelected.add(c.client_code));
    }
    setSelectedClients(newSelected);
  };

  const handleReassign = async () => {
    if (selectedClients.size === 0) {
      setMessage({ type: 'error', text: '재배정할 고객을 선택하세요.' });
      return;
    }

    if (!targetEmployee) {
      setMessage({ type: 'error', text: '배정할 담당자를 선택하세요.' });
      return;
    }

    setIsReassigning(true);
    setMessage(null);

    try {
      const response = await apiFetch('/api/dashboard/client-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCodes: Array.from(selectedClients),
          newEmployeeCode: targetEmployee
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setSelectedClients(new Set());
        setReassignMode(false);
        setTargetEmployee('');
        await fetchData();
      } else {
        setMessage({ type: 'error', text: result.error || '재배정에 실패했습니다.' });
      }
    } catch (error) {
      console.error('Failed to reassign clients:', error);
      setMessage({ type: 'error', text: '재배정 중 오류가 발생했습니다.' });
    } finally {
      setIsReassigning(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const expandAll = () => {
    setExpandedBranches(new Set(branchAssignments.map(b => b.branch_name)));

    const allEmployees = new Set<string>();
    const allProductCategories = new Set<string>();
    const allTeamKeys = new Set<string>();

    branchAssignments.forEach(branch => {
      branch.employees.forEach(emp => {
        allEmployees.add(emp.employee_name);
        allTeamKeys.add(teamFolderKey(branch.branch_name, teamPairKey(emp)));

        // Expand all product categories for this employee
        if (emp.product_categories) {
          emp.product_categories.forEach(prodCat => {
            allProductCategories.add(`${emp.employee_name}:${prodCat.category}`);
          });
        }
      });
    });

    setExpandedTeams(allTeamKeys);
    setExpandedEmployees(allEmployees);
    setExpandedProductCategories(allProductCategories);
  };

  const collapseAll = () => {
    setExpandedEmployees(new Set());
    setExpandedBranches(new Set());
    setExpandedTeams(new Set());
    setExpandedProductCategories(new Set());
  };

  const handleRefreshProducts = async () => {
    setIsRefreshingProducts(true);
    setMessage(null);

    try {
      // Don't specify years - let backend decide (all years first time, recent years after)
      const response = await apiFetch('/api/admin/refresh-product-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force: true
        })
      });

      const result = await response.json();

      if (result.success) {
        const loadType = result.isInitialLoad ? '전체 이력' : '최근 연도';
        const yearInfo = result.yearRange ? ` (${result.yearRange})` : '';
        setMessage({
          type: 'success',
          text: `제품 데이터 새로고침 완료 [${loadType}${yearInfo}]: ${result.rowsInserted}개 항목`
        });
        // Reload data to show updated products
        if (showProducts) {
          await fetchData();
        }
      } else {
        setMessage({ type: 'error', text: result.error || '제품 데이터 새로고침 실패' });
      }
    } catch (error) {
      console.error('Failed to refresh product summary:', error);
      setMessage({ type: 'error', text: '제품 데이터 새로고침 중 오류 발생' });
    } finally {
      setIsRefreshingProducts(false);
    }
  };

  const handleExcelDownload = () => {
    const exportData: any[] = [];

    employeeAssignments.forEach(emp => {
      // Employee header row
      exportData.push({
        '담당자': emp.employee_name,
        '팀': formatContextualTeamLabel(emp),
        '사업소': emp.branch || '-',
        '고객수': emp.client_count
      });

      // Client rows
      emp.clients.forEach(client => {
        exportData.push({
          '담당자': '',
          '고객코드': client.client_code,
          '고객명': client.client_name,
          '그룹': client.client_group,
          '산업': client.industry,
          '섹터': client.sector,
          [categoryTypeUiLabel(categoryType)]: client.product_types?.map(pt => pt.category).join(', ') || '-',
          '신규일': client.new_client_date || '-'
        });
      });

      exportData.push({}); // Empty row between employees
    });

    const filename = generateFilename(`현재_고객배정현황`);
    exportToExcel(exportData, filename);
  };

  const getCategoryBadgeStyle = (category: string) => {
    // Product Tier colors
    if (category === 'Standard') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (category === 'Premium') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    if (category === 'Flagship') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (category === 'Alliance') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';

    // Business Division colors
    if (category === 'IL') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    if (category === 'AUTO') return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
    if (category === 'MB') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    if (category === 'AVI+MAR') return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
    if (category === '기타') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';

    // Product Family colors
    if (category === 'MOBIL 1') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (category === 'AIOP') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (category === 'TP') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (category === 'SPECIAL P') return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400';
    if (category === 'CVL Products') return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';

    // Business Type colors
    if (category === 'Fleet') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
    if (category === 'LCC') return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400';

    return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
  };

  const ProductBadges = ({ productTypes }: { productTypes?: ProductType[] }) => {
    if (!productTypes || productTypes.length === 0) return null;

    const displayTypes = productTypes.slice(0, 3);
    const remainingCount = productTypes.length - 3;

    return (
      <div className="flex gap-1 mt-1.5 flex-wrap">
        {displayTypes.map((pt, idx) => (
          <span
            key={idx}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getCategoryBadgeStyle(pt.category)}`}
            title={pt.product_family || pt.category}
          >
            {pt.category}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            +{remainingCount}
          </span>
        )}
      </div>
    );
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const groupEmployeesByTeam = (employees: EmployeeAssignment[]): [string, EmployeeAssignment[]][] => {
    const map = new Map<string, EmployeeAssignment[]>();
    employees.forEach((emp) => {
      const key = teamPairKey(emp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(emp);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const e0 = a[1][0];
      const e1 = b[1][0];
      const ta = normalizeTeamField(e0?.b2c_team) || normalizeTeamField(e0?.b2b_team);
      const tb = normalizeTeamField(e1?.b2c_team) || normalizeTeamField(e1?.b2b_team);
      return compareTeams(ta, tb, displayOrder.teamB2c, displayOrder.teamB2b);
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>고객 배정 데이터를 불러오는 중...</p>
      </div>
    );
  }

  const totalClients = employeeAssignments.reduce((sum, e) => sum + e.client_count, 0);
  const totalEmployees = employeeAssignments.length;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-lg">현재 고객 배정 현황</span>
            </div>

            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="bg-transparent font-medium focus:outline-none cursor-pointer border-b-2 border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 px-2 py-1"
            >
              <option value="">전체 담당자</option>
              {allEmployees.map(emp => (
                <option key={emp.employee_code} value={emp.employee_name}>
                  {emp.employee_name} ({formatContextualTeamLabel(emp)})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="고객명/코드 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 pr-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                검색
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">집계 기준:</span>
                <select
                  value={categoryType}
                  onChange={(e) => setCategoryType(e.target.value as CategoryType)}
                  className="px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                  title="매출 한 줄마다 SQL CASE로 분류합니다. 등급은 품목1·3코드를 함께 사용합니다."
                >
                  <option value="business_type">{categoryTypeUiLabel('business_type')}</option>
                  <option value="division">{categoryTypeUiLabel('division')}</option>
                  <option value="tier">{categoryTypeUiLabel('tier')}</option>
                  <option value="family">{categoryTypeUiLabel('family')}</option>
                </select>
              </div>

            </div>
            <button
              onClick={handleRefreshProducts}
              disabled={isRefreshingProducts}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/40 rounded-lg text-sm font-medium transition-colors"
              title="제품 데이터 새로고침"
            >
              {isRefreshingProducts ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              DB 새로고침
            </button>
            <button
              onClick={() => fetchData()}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <ExcelDownloadButton
              label="Excel 다운로드"
              onClick={handleExcelDownload}
              variant="secondary"
            />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">총 담당자</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalEmployees}명</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">총 고객</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(totalClients)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">평균 고객/담당자</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {totalEmployees > 0 ? Math.round(totalClients / totalEmployees) : 0}
            </p>
          </div>
        </div>
        {reassignMode && selectedClients.size > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-bold text-purple-600">{selectedClients.size}개 고객</span>이 재배정 대기 중입니다
            </p>
          </div>
        )}
      </div>

      {/* Reassignment Mode */}
      {reassignMode && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                고객 재배정 ({selectedClients.size}개 선택)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={targetEmployee}
                onChange={(e) => setTargetEmployee(e.target.value)}
                className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">담당자 선택</option>
                {allEmployees.map(emp => (
                  <option key={emp.employee_code} value={emp.employee_code}>
                    {emp.employee_name} ({formatContextualTeamLabel(emp)})
                  </option>
                ))}
              </select>

              <button
                onClick={handleReassign}
                disabled={isReassigning || selectedClients.size === 0 || !targetEmployee}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-colors"
              >
                {isReassigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                재배정
              </button>

              <button
                onClick={() => {
                  setReassignMode(false);
                  setSelectedClients(new Set());
                  setTargetEmployee('');
                }}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm font-medium transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Expand/Collapse Controls */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">사업소별 고객 배정 현황</h3>

          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-sm px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            >
              모두 펼치기
            </button>
            <button
              onClick={collapseAll}
              className="text-sm px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              모두 접기
            </button>
          </div>
        </div>
      </div>

      {/* Reassign Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setReassignMode(!reassignMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            reassignMode
              ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          {reassignMode ? '재배정 모드 종료' : '고객 재배정'}
        </button>
      </div>

      {/* Branch View */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
                <tr className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {reassignMode && <th className="py-3 px-4 text-center w-12">선택</th>}
                  <th className="py-3 px-4 text-left">사업소 / 담당자</th>
                  <th className="py-3 px-4 text-left">유형</th>
                  <th className="py-3 px-4 text-right">고객수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {sortBranchesWithUnassignedLast(branchAssignments, displayOrder.office).flatMap((branch, index, arr) => {
                  const prev = index > 0 ? arr[index - 1] : null;
                  const showUnassignedSeparator =
                    branch.branch_name === UNASSIGNED_BRANCH &&
                    prev !== null &&
                    prev.branch_name !== UNASSIGNED_BRANCH;

                  const isBranchExpanded = expandedBranches.has(branch.branch_name);
                  const teamsGrouped = groupEmployeesByTeam(branch.employees);

                  const branchBlock = (
                    <Fragment key={branch.branch_name}>
                      {/* Branch Row */}
                      <tr
                        className="bg-orange-50/30 dark:bg-orange-900/10 hover:bg-orange-50/50 dark:hover:bg-orange-900/20 cursor-pointer transition-colors"
                        onClick={() => toggleBranch(branch.branch_name)}
                      >
                        {reassignMode && <td className="py-3 px-4"></td>}
                        <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                          <div className="flex items-center gap-2">
                            {isBranchExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                            <Package className="w-4 h-4 text-orange-600" />
                            {branch.branch_name}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            사업소
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-orange-600">
                          {branch.total_clients}
                        </td>
                      </tr>

                      {/* Team folders & employees within branch */}
                      {isBranchExpanded && teamsGrouped.map(([pairKey, teamEmployees]) => {
                        const teamKey = teamFolderKey(branch.branch_name, pairKey);
                        const isTeamExpanded = expandedTeams.has(teamKey);
                        const teamTotalClients = teamEmployees.reduce((sum, e) => sum + e.client_count, 0);
                        const teamDisplay = formatContextualTeamLabel(teamEmployees[0]);

                        return (
                          <Fragment key={teamKey}>
                            {/* Team folder row */}
                            <tr
                              className="bg-violet-50/40 dark:bg-violet-950/20 hover:bg-violet-50/70 dark:hover:bg-violet-950/30 cursor-pointer transition-colors border-l-2 border-violet-300/60 dark:border-violet-700/50"
                              onClick={() => toggleTeam(branch.branch_name, pairKey)}
                            >
                              {reassignMode && <td className="py-2.5 px-4"></td>}
                              <td className="py-2.5 px-4 pl-8 font-semibold text-violet-900 dark:text-violet-100 min-w-0">
                                <div className="flex items-start sm:items-center gap-2 flex-wrap">
                                  {isTeamExpanded ? <ChevronDown className="w-4 h-4 text-violet-500 shrink-0 mt-0.5 sm:mt-0" /> : <ChevronRight className="w-4 h-4 text-violet-500 shrink-0 mt-0.5 sm:mt-0" />}
                                  <Folder className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5 sm:mt-0" />
                                  <span className="break-words leading-snug">{teamDisplay}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                                  팀
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-violet-700 dark:text-violet-300">
                                {teamTotalClients}
                              </td>
                            </tr>

                            {isTeamExpanded && teamEmployees.map((emp) => {
                              const isEmployeeExpanded = expandedEmployees.has(emp.employee_name);

                              return (
                                <Fragment key={`${branch.branch_name}_${pairKey}_${emp.employee_code}`}>
                                  {/* Employee Row */}
                                  <tr
                                    className="bg-blue-50/20 dark:bg-blue-900/5 hover:bg-blue-50/40 dark:hover:bg-blue-900/15 cursor-pointer transition-colors"
                                    onClick={() => toggleEmployee(emp.employee_name)}
                                  >
                                    {reassignMode && <td className="py-3 px-4"></td>}
                                    <td className="py-3 px-4 pl-14 font-semibold text-zinc-800 dark:text-zinc-200">
                                      <div className="flex items-center gap-2">
                                        {isEmployeeExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                                        <Users className="w-3.5 h-3.5 text-blue-600" />
                                        {emp.employee_name}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-xs text-zinc-500">담당자</td>
                                    <td className="py-3 px-4 text-right font-bold text-blue-600">
                                      {emp.client_count}
                                      {reassignMode && emp.clients.length > 0 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            selectAllClientsForEmployee(emp.clients);
                                          }}
                                          className="ml-2 text-xs text-blue-500 hover:text-blue-700 underline"
                                        >
                                          전체선택
                                        </button>
                                      )}
                                    </td>
                                  </tr>

                                  {/* Product Category & Client Rows */}
                                  {isEmployeeExpanded && showProducts && emp.product_categories ? (
                                    emp.product_categories.map((prodCat) => {
                                      const categoryKey = `${emp.employee_name}:${prodCat.category}`;
                                      const isCategoryExpanded = expandedProductCategories.has(categoryKey);

                                      return (
                                        <Fragment key={categoryKey}>
                                          {/* Product Category Row */}
                                          <tr
                                            className="bg-emerald-50/20 dark:bg-emerald-900/5 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/15 cursor-pointer transition-colors"
                                            onClick={() => toggleProductCategory(emp.employee_name, prodCat.category)}
                                          >
                                            {reassignMode && <td className="py-2 px-4"></td>}
                                            <td className="py-2 px-4 pl-20">
                                              <div className="flex items-center gap-2">
                                                {isCategoryExpanded ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getCategoryBadgeStyle(prodCat.category)}`}>
                                                  {prodCat.category}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-2 px-4 text-xs text-zinc-500 break-words max-w-[10rem]">{categoryTypeUiLabel(categoryType)}</td>
                                            <td className="py-2 px-4 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                              {prodCat.client_count}개 고객
                                            </td>
                                          </tr>

                                          {/* Clients under this category */}
                                          {isCategoryExpanded && prodCat.clients.map((client, clientIdx) => (
                                            <tr
                                              key={`${categoryKey}_${client.client_code}_${clientIdx}`}
                                              className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors ${
                                                selectedClients.has(client.client_code) ? 'bg-yellow-50/30 dark:bg-yellow-900/10' : ''
                                              }`}
                                            >
                                              {reassignMode && (
                                                <td className="py-2 px-4 text-center">
                                                  <input
                                                    type="checkbox"
                                                    checked={selectedClients.has(client.client_code)}
                                                    onChange={() => toggleClientSelection(client.client_code)}
                                                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                                  />
                                                </td>
                                              )}
                                              <td className="py-2 px-4 pl-24">
                                                <div className="flex items-center gap-2">
                                                  <Package className="w-3 h-3 text-zinc-400" />
                                                  <div>
                                                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{client.client_name}</p>
                                                    <p className="text-xs text-zinc-500">{client.client_code}</p>
                                                    {client.client_group ? (
                                                      <p className="text-[10px] text-zinc-500 mt-0.5">그룹: {client.client_group}</p>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="py-2 px-4 text-xs text-zinc-500">
                                                {client.industry && client.sector ? `${client.industry} / ${client.sector}` : '-'}
                                              </td>
                                              <td className="py-2 px-4"></td>
                                            </tr>
                                          ))}
                                        </Fragment>
                                      );
                                    })
                                  ) : isEmployeeExpanded && emp.clients.map((client, clientIdx) => {
                                    // Fallback: show clients directly when products not enabled
                                    return (
                                      <tr
                                        key={`${emp.employee_code}_${client.client_code}_${clientIdx}`}
                                        className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors ${
                                          selectedClients.has(client.client_code) ? 'bg-yellow-50/30 dark:bg-yellow-900/10' : ''
                                        }`}
                                      >
                                        {reassignMode && (
                                          <td className="py-2 px-4 text-center">
                                            <input
                                              type="checkbox"
                                              checked={selectedClients.has(client.client_code)}
                                              onChange={() => toggleClientSelection(client.client_code)}
                                              className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                            />
                                          </td>
                                        )}
                                        <td className="py-2 px-4 pl-20">
                                          <div className="flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-zinc-400" />
                                            <div>
                                              <p className="font-medium text-zinc-800 dark:text-zinc-200">{client.client_name}</p>
                                              <p className="text-xs text-zinc-500">{client.client_code}</p>
                                              {client.client_group ? (
                                                <p className="text-[10px] text-zinc-500 mt-0.5">그룹: {client.client_group}</p>
                                              ) : null}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-2 px-4 text-xs text-zinc-500">
                                          {client.industry && client.sector ? `${client.industry} / ${client.sector}` : '-'}
                                        </td>
                                        <td className="py-2 px-4"></td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );

                  if (showUnassignedSeparator) {
                    return [
                      <tr
                        key="__sep-unassigned-branch__"
                        className="bg-zinc-100/90 dark:bg-zinc-800/60 border-y border-zinc-300 dark:border-zinc-600"
                      >
                        <td
                          colSpan={reassignMode ? 4 : 3}
                          className="py-2.5 px-4 text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400"
                        >
                          미배정 사업소
                        </td>
                      </tr>,
                      branchBlock
                    ];
                  }
                  return [branchBlock];
                })}
              </tbody>
            </table>
          </div>
        </div>

      {/* Help Text */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-2">💡 사용 팁:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>계층 구조:</strong> 사업소 → 팀 → 담당자 → 집계 기준별 분류 → 고객처</li>
          <li><strong>집계 기준:</strong> 등급은 품목1·3코드를 <strong>한 CASE에서 함께</strong> 사용합니다. 모빌제품은 품목그룹1코드, 제품군은 제품군·품목1코드 기준으로 전환합니다.</li>
          <li><strong>분류 행 클릭:</strong> 해당 분류를 구매하는 고객 목록 펼치기/접기</li>
          <li><strong>고객 재배정:</strong> 재배정 버튼 클릭 → 고객 선택 → 새 담당자 지정 → 재배정 실행</li>
          <li><strong>DB 새로고침:</strong> 제품 데이터 업데이트 (첫 실행: 전체 이력, 이후: 최근 연도만)</li>
          <li><strong>Excel 다운로드:</strong> 전체 배정 현황을 Excel 파일로 저장</li>
        </ul>
      </div>
    </div>
  );
}
