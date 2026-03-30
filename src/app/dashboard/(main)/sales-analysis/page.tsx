"use client";

import { useState, useEffect } from 'react';
import { Calendar, Users, Building, Package, Filter, Loader2, TrendingUp, DollarSign, ShoppingCart, BarChart3, ChevronRight, ChevronDown, GripVertical, Target } from 'lucide-react';
import VatToggle from '@/components/VatToggle';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { exportToExcel, generateFilename } from '@/lib/excel-export';
import { GoalModal } from '@/components/sales-analysis/GoalModal';

interface FilterOptions {
  employees: { name: string }[];
  teams: { name: string }[];
  branches: { name: string }[];
  industries: { code: string; name: string }[];
  regions: { code: string }[];
  productGroup1: { code: string }[];
  productGroup2: { code: string }[];
  productGroup3: { code: string }[];
}

interface SalesData {
  employee_name?: string;
  team_name?: string;
  branch_name?: string;
  industry_code?: string;
  industry_name?: string;
  region_code?: string;
  product_group1?: string;
  product_group2?: string;
  product_group3?: string;
  transaction_count: number;
  client_count: number;
  total_quantity: number;
  total_weight: number;
  total_supply_amount: number;
  total_amount: number;
}

interface HierarchicalNode {
  key: string;
  label: string;
  level: number;
  dimensionType: string;
  data: SalesData;
  lastYearData?: SalesData;
  children: HierarchicalNode[];
  isExpanded: boolean;
  goal?: number;
  achievementRate?: number;
}

interface Goal {
  id: string;
  name: string;
  dimension: {
    type: 'employee' | 'client' | 'product' | 'all';
    grouping?: string;
    value?: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  metric: 'total_amount' | 'total_quantity' | 'total_weight' | 'transaction_count' | 'client_count';
  targetValue: number;
  createdAt: string;
}

type EmployeeGrouping = 'individual' | 'team' | 'branch';
type ClientGrouping = 'industry' | 'region';
type ProductGrouping = 'group1' | 'group2' | 'group3';
type CategoryType = 'employee' | 'client' | 'product';

export default function SalesAnalysisPage() {
  const { includeVat } = useVatInclude();
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Grouping dimensions - now supports multiple selections per category
  const [employeeGroupings, setEmployeeGroupings] = useState<EmployeeGrouping[]>(['branch']);
  const [clientGroupings, setClientGroupings] = useState<ClientGrouping[]>([]);
  const [productGroupings, setProductGroupings] = useState<ProductGrouping[]>(['group1']);

  // Category order - determines hierarchy priority
  const [categoryOrder, setCategoryOrder] = useState<CategoryType[]>(['employee', 'client', 'product']);

  // Filter values (which specific values to include)
  const [employeeValues, setEmployeeValues] = useState<string[]>([]);
  const [clientValues, setClientValues] = useState<string[]>([]);
  const [productValues, setProductValues] = useState<string[]>([]);

  const [rawData, setRawData] = useState<{ [key: string]: SalesData[] }>({});
  const [lastYearData, setLastYearData] = useState<{ [key: string]: SalesData[] }>({});
  const [hierarchicalData, setHierarchicalData] = useState<HierarchicalNode[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [compareWithLastYear, setCompareWithLastYear] = useState(false);

  // Goal management
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [showGoals, setShowGoals] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
    loadGoals();
  }, []);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, employeeGroupings, clientGroupings, productGroupings, employeeValues, clientValues, productValues, compareWithLastYear, includeVat]);

  useEffect(() => {
    // Convert flat data to hierarchical structure
    let hierarchy = buildHierarchy(rawData, lastYearData);

    // Apply goals if enabled
    if (showGoals && goals.length > 0) {
      hierarchy = applyGoalsToHierarchy(hierarchy, goals);
    }

    setHierarchicalData(hierarchy);
  }, [rawData, lastYearData, employeeGroupings, clientGroupings, productGroupings, categoryOrder, showGoals, goals]);

  const fetchFilterOptions = async () => {
    try {
      const response = await apiFetch('/api/dashboard/sales-analysis');
      const result = await response.json();
      if (result.success) {
        setFilterOptions(result.filterOptions);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Check if at least one grouping is selected
      const allGroupings = [
        ...employeeGroupings,
        ...clientGroupings,
        ...productGroupings
      ];

      if (allGroupings.length === 0) {
        setRawData({});
        setLastYearData({});
        setIsLoading(false);
        return;
      }

      // Make a single API call with all groupings as comma-separated values
      const params = new URLSearchParams({
        startDate,
        endDate,
        employeeGroups: employeeGroupings.join(','),
        clientGroups: clientGroupings.join(','),
        productGroups: productGroupings.join(','),
        employeeValues: employeeValues.join(','),
        clientValues: clientValues.join(','),
        productValues: productValues.join(',')
      });
      params.set('includeVat', String(includeVat));

      const response = await apiFetch(`/api/dashboard/sales-analysis?${params}`);
      const result = await response.json();

      if (result.success && result.data) {
        // Store all data under a single key since it's now unified
        setRawData({ 'all': result.data });
      } else {
        setRawData({});
      }

      // Fetch last year's data if comparison is enabled
      if (compareWithLastYear) {
        const lastYearStart = new Date(startDate);
        lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
        const lastYearEnd = new Date(endDate);
        lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

        const lastYearParams = new URLSearchParams({
          startDate: lastYearStart.toISOString().split('T')[0],
          endDate: lastYearEnd.toISOString().split('T')[0],
          employeeGroups: employeeGroupings.join(','),
          clientGroups: clientGroupings.join(','),
          productGroups: productGroupings.join(','),
          employeeValues: employeeValues.join(','),
          clientValues: clientValues.join(','),
          productValues: productValues.join(',')
        });
        lastYearParams.set('includeVat', String(includeVat));

        const lastYearResponse = await apiFetch(`/api/dashboard/sales-analysis?${lastYearParams}`);
        const lastYearResult = await lastYearResponse.json();

        if (lastYearResult.success && lastYearResult.data) {
          setLastYearData({ 'all': lastYearResult.data });
        } else {
          setLastYearData({});
        }
      } else {
        setLastYearData({});
      }
    } catch (error) {
      console.error('Failed to fetch sales data:', error);
      setRawData({});
      setLastYearData({});
    } finally {
      setIsLoading(false);
    }
  };

  const buildHierarchy = (dataByGrouping: { [key: string]: SalesData[] }, lastYearDataByGrouping: { [key: string]: SalesData[] } = {}): HierarchicalNode[] => {
    // Build ordered list of all active dimensions based on categoryOrder
    const dimensions: Array<{
      key: keyof SalesData;
      label: string;
      type: 'employee' | 'client' | 'product';
    }> = [];

    // Iterate through categories in the order specified by categoryOrder
    categoryOrder.forEach(category => {
      if (category === 'employee') {
        // Add employee dimensions in hierarchical order: branch -> team -> individual
        if (employeeGroupings.includes('branch')) {
          dimensions.push({ key: 'branch_name', label: '사업소', type: 'employee' });
        }
        if (employeeGroupings.includes('team')) {
          dimensions.push({ key: 'team_name', label: '팀', type: 'employee' });
        }
        if (employeeGroupings.includes('individual')) {
          dimensions.push({ key: 'employee_name', label: '사원', type: 'employee' });
        }
      } else if (category === 'client') {
        // Add client dimensions in logical order: industry -> region
        if (clientGroupings.includes('industry')) {
          dimensions.push({ key: 'industry_code', label: '업종', type: 'client' });
        }
        if (clientGroupings.includes('region')) {
          dimensions.push({ key: 'region_code', label: '지역', type: 'client' });
        }
      } else if (category === 'product') {
        // Add product dimensions in order: group1 -> group2 -> group3
        if (productGroupings.includes('group1')) {
          dimensions.push({ key: 'product_group1', label: '품목그룹1', type: 'product' });
        }
        if (productGroupings.includes('group2')) {
          dimensions.push({ key: 'product_group2', label: '품목그룹2', type: 'product' });
        }
        if (productGroupings.includes('group3')) {
          dimensions.push({ key: 'product_group3', label: '품목그룹3', type: 'product' });
        }
      }
    });

    if (dimensions.length === 0) {
      return [];
    }

    // Combine all data from different API calls
    const allData: SalesData[] = [];
    Object.values(dataByGrouping).forEach(dataArray => {
      allData.push(...dataArray);
    });

    const allLastYearData: SalesData[] = [];
    Object.values(lastYearDataByGrouping).forEach(dataArray => {
      allLastYearData.push(...dataArray);
    });

    // Create lookup map for last year data
    const lastYearLookup = new Map<string, SalesData>();
    allLastYearData.forEach(item => {
      const key = dimensions.map(dim => String(item[dim.key] || '')).join('|');
      lastYearLookup.set(key, item);
    });

    if (allData.length === 0) {
      return [];
    }

    // If only one dimension, return flat list
    if (dimensions.length === 1) {
      return allData.map(item => {
        const key = String(item[dimensions[0].key] || '');
        const lastYearMatch = lastYearLookup.get(key);

        return {
          key,
          label: getDisplayLabel(item, dimensions[0].key),
          level: 0,
          dimensionType: dimensions[0].label,
          data: item,
          lastYearData: lastYearMatch,
          children: [],
          isExpanded: false
        };
      });
    }

    // Build multi-level hierarchy
    const root: { [key: string]: any } = {};

    allData.forEach(item => {
      let current = root;
      const keyParts: string[] = [];

      dimensions.forEach((dim, dimIndex) => {
        const value = String(item[dim.key] || '');
        keyParts.push(value);

        if (!current[value]) {
          current[value] = {
            key: value,
            label: getDisplayLabel(item, dim.key),
            level: dimIndex,
            dimensionType: dim.label,
            data: null,
            lastYearData: null,
            children: {},
            isExpanded: false
          };
        }

        // If this is the last dimension, store the data and match last year
        if (dimIndex === dimensions.length - 1) {
          current[value].data = item;
          const lookupKey = keyParts.join('|');
          const lastYearMatch = lastYearLookup.get(lookupKey);
          if (lastYearMatch) {
            current[value].lastYearData = lastYearMatch;
          }
        }

        current = current[value].children;
      });
    });

    // Convert nested object to array structure and aggregate parent nodes
    const convertToArray = (obj: any, level: number): HierarchicalNode[] => {
      return Object.values(obj).map((node: any) => {
        const children = Object.keys(node.children).length > 0
          ? convertToArray(node.children, level + 1)
          : [];

        // Aggregate data for parent nodes
        const aggregatedData = children.length > 0
          ? aggregateChildren(children)
          : node.data;

        // Aggregate last year data for parent nodes
        const aggregatedLastYearData = children.length > 0
          ? aggregateChildren(children, true)
          : node.lastYearData;

        return {
          key: node.key,
          label: node.label,
          level: node.level,
          dimensionType: node.dimensionType,
          data: aggregatedData,
          lastYearData: aggregatedLastYearData,
          children,
          isExpanded: false
        };
      });
    };

    return convertToArray(root, 0);
  };

  const aggregateChildren = (children: HierarchicalNode[], useLastYear: boolean = false): SalesData => {
    return children.reduce((acc, child) => {
      const dataSource = useLastYear ? child.lastYearData : child.data;
      if (!dataSource) return acc;

      return {
        transaction_count: acc.transaction_count + Number(dataSource.transaction_count || 0),
        client_count: acc.client_count + Number(dataSource.client_count || 0),
        total_quantity: acc.total_quantity + Number(dataSource.total_quantity || 0),
        total_weight: acc.total_weight + Number(dataSource.total_weight || 0),
        total_supply_amount: acc.total_supply_amount + Number(dataSource.total_supply_amount || 0),
        total_amount: acc.total_amount + Number(dataSource.total_amount || 0),
      };
    }, {
      transaction_count: 0,
      client_count: 0,
      total_quantity: 0,
      total_weight: 0,
      total_supply_amount: 0,
      total_amount: 0,
    });
  };

  const getDisplayLabel = (item: SalesData, key: keyof SalesData): string => {
    if (key === 'industry_code' && item.industry_name) {
      return `${item.industry_code} - ${item.industry_name}`;
    }
    return String(item[key] || '');
  };

  const toggleNode = (path: number[]) => {
    const newData = [...hierarchicalData];
    let current: HierarchicalNode[] = newData;

    path.forEach((index, i) => {
      if (i === path.length - 1) {
        current[index].isExpanded = !current[index].isExpanded;
      } else {
        current = current[index].children;
      }
    });

    setHierarchicalData(newData);
  };

  const expandAll = () => {
    const expand = (nodes: HierarchicalNode[]): HierarchicalNode[] => {
      return nodes.map(node => ({
        ...node,
        isExpanded: true,
        children: expand(node.children)
      }));
    };
    setHierarchicalData(expand(hierarchicalData));
  };

  const collapseAll = () => {
    const collapse = (nodes: HierarchicalNode[]): HierarchicalNode[] => {
      return nodes.map(node => ({
        ...node,
        isExpanded: false,
        children: collapse(node.children)
      }));
    };
    setHierarchicalData(collapse(hierarchicalData));
  };

  const renderHierarchicalRows = (nodes: HierarchicalNode[], path: number[] = []): JSX.Element[] => {
    const rows: JSX.Element[] = [];

    nodes.forEach((node, index) => {
      const currentPath = [...path, index];
      const hasChildren = node.children.length > 0;
      const indent = node.level * 2;

      rows.push(
        <tr
          key={currentPath.join('-')}
          className={`hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
            hasChildren ? 'bg-zinc-50/50 dark:bg-zinc-800/50' : ''
          }`}
        >
          <td
            className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer"
            style={{ paddingLeft: `${1 + indent * 0.5}rem` }}
            onClick={() => hasChildren && toggleNode(currentPath)}
          >
            <div className="flex items-center gap-2">
              {hasChildren && (
                node.isExpanded ?
                  <ChevronDown className="w-4 h-4 text-zinc-400" /> :
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
              )}
              {!hasChildren && <span className="w-4" />}
              <div className="flex flex-col">
                <span className={hasChildren ? 'font-semibold' : ''}>{node.label}</span>
                {node.level === 0 && hasChildren && (
                  <span className="text-xs text-zinc-500">{node.dimensionType}</span>
                )}
              </div>
            </div>
          </td>
          {!compareWithLastYear ? (
            <>
              <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">
                {Number(node.data.transaction_count).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">
                {Number(node.data.client_count).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">
                {Number(node.data.total_quantity).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">
                {Number(node.data.total_weight).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                ₩{Number(node.data.total_supply_amount).toLocaleString()}
              </td>
              <td className={`px-4 py-3 text-sm text-right ${hasChildren ? 'font-bold' : 'font-semibold'} text-emerald-600 dark:text-emerald-400`}>
                ₩{Number(node.data.total_amount).toLocaleString()}
              </td>
              {showGoals && (
                <>
                  <td className="px-4 py-3 text-sm text-right text-zinc-500 dark:text-zinc-400">
                    {node.goal ? `₩${node.goal.toLocaleString()}` : '-'}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    node.achievementRate !== undefined
                      ? node.achievementRate >= 100
                        ? 'text-green-600 dark:text-green-400'
                        : node.achievementRate >= 80
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                      : 'text-zinc-400'
                  }`}>
                    {node.achievementRate !== undefined ? `${node.achievementRate.toFixed(1)}%` : '-'}
                  </td>
                </>
              )}
            </>
          ) : (
            <>
              <td className={`px-2 py-3 text-sm text-right ${hasChildren ? 'font-bold' : 'font-semibold'} text-zinc-900 dark:text-zinc-100`}>
                ₩{Number(node.data.total_amount).toLocaleString()}
              </td>
              <td className="px-2 py-3 text-sm text-right text-zinc-500 dark:text-zinc-400">
                {node.lastYearData ? `₩${Number(node.lastYearData.total_amount).toLocaleString()}` : '-'}
              </td>
              <td className={`px-2 py-3 text-sm text-right font-medium ${
                node.lastYearData
                  ? (Number(node.data.total_amount) - Number(node.lastYearData.total_amount)) >= 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                  : 'text-zinc-400'
              }`}>
                {node.lastYearData
                  ? `${(Number(node.data.total_amount) - Number(node.lastYearData.total_amount)) >= 0 ? '+' : ''}₩${(Number(node.data.total_amount) - Number(node.lastYearData.total_amount)).toLocaleString()}`
                  : '-'
                }
              </td>
              <td className={`px-2 py-3 text-sm text-right font-bold ${
                node.lastYearData
                  ? (Number(node.data.total_amount) - Number(node.lastYearData.total_amount)) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                  : 'text-zinc-400'
              }`}>
                {node.lastYearData && Number(node.lastYearData.total_amount) !== 0
                  ? `${((Number(node.data.total_amount) - Number(node.lastYearData.total_amount)) / Number(node.lastYearData.total_amount) * 100).toFixed(1)}%`
                  : '-'
                }
              </td>
              {showGoals && (
                <>
                  <td className="px-2 py-3 text-sm text-right text-zinc-500 dark:text-zinc-400">
                    {node.goal ? `₩${node.goal.toLocaleString()}` : '-'}
                  </td>
                  <td className={`px-2 py-3 text-sm text-right font-medium ${
                    node.achievementRate !== undefined
                      ? node.achievementRate >= 100
                        ? 'text-green-600 dark:text-green-400'
                        : node.achievementRate >= 80
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                      : 'text-zinc-400'
                  }`}>
                    {node.achievementRate !== undefined ? `${node.achievementRate.toFixed(1)}%` : '-'}
                  </td>
                </>
              )}
            </>
          )}
        </tr>
      );

      if (hasChildren && node.isExpanded) {
        rows.push(...renderHierarchicalRows(node.children, currentPath));
      }
    });

    return rows;
  };

  const toggleEmployeeGrouping = (group: EmployeeGrouping) => {
    setEmployeeGroupings(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
    setEmployeeValues([]);
  };

  const toggleClientGrouping = (group: ClientGrouping) => {
    setClientGroupings(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
    setClientValues([]);
  };

  const toggleProductGrouping = (group: ProductGrouping) => {
    setProductGroupings(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
    setProductValues([]);
  };

  const toggleEmployeeValue = (value: string) => {
    setEmployeeValues(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const toggleClientValue = (value: string) => {
    setClientValues(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const toggleProductValue = (value: string) => {
    setProductValues(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const [draggedCategory, setDraggedCategory] = useState<CategoryType | null>(null);

  const handleDragStart = (category: CategoryType) => {
    setDraggedCategory(category);
  };

  const handleDragOver = (e: React.DragEvent, category: CategoryType) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === category) return;

    const newOrder = [...categoryOrder];
    const draggedIndex = newOrder.indexOf(draggedCategory);
    const targetIndex = newOrder.indexOf(category);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedCategory);

    setCategoryOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedCategory(null);
  };

  const getEmployeeOptions = () => {
    if (!filterOptions) return [];
    const options: string[] = [];
    if (employeeGroupings.includes('individual')) options.push(...filterOptions.employees.map(e => e.name));
    if (employeeGroupings.includes('team')) options.push(...filterOptions.teams.map(t => t.name));
    if (employeeGroupings.includes('branch')) options.push(...filterOptions.branches.map(b => b.name));
    return [...new Set(options)]; // Remove duplicates
  };

  const getClientOptions = () => {
    if (!filterOptions) return [];
    const options: Array<{ label: string; value: string }> = [];
    if (clientGroupings.includes('industry')) {
      options.push(...filterOptions.industries.map(i => ({ label: `${i.code} - ${i.name || ''}`, value: i.code })));
    }
    if (clientGroupings.includes('region')) {
      options.push(...filterOptions.regions.map(r => ({ label: r.code, value: r.code })));
    }
    return options;
  };

  const getProductOptions = () => {
    if (!filterOptions) return [];
    const options: string[] = [];
    if (productGroupings.includes('group1')) options.push(...filterOptions.productGroup1.map(p => p.code));
    if (productGroupings.includes('group2')) options.push(...filterOptions.productGroup2.map(p => p.code));
    if (productGroupings.includes('group3')) options.push(...filterOptions.productGroup3.map(p => p.code));
    return [...new Set(options)]; // Remove duplicates
  };

  const getAllData = (): SalesData[] => {
    const allData: SalesData[] = [];
    Object.values(rawData).forEach(dataArray => {
      allData.push(...dataArray);
    });
    return allData;
  };

  const totals = getAllData().reduce((acc, row) => ({
    transactions: acc.transactions + Number(row.transaction_count || 0),
    clients: acc.clients + Number(row.client_count || 0),
    quantity: acc.quantity + Number(row.total_quantity || 0),
    weight: acc.weight + Number(row.total_weight || 0),
    supplyAmount: acc.supplyAmount + Number(row.total_supply_amount || 0),
    amount: acc.amount + Number(row.total_amount || 0),
  }), { transactions: 0, clients: 0, quantity: 0, weight: 0, supplyAmount: 0, amount: 0 });

  const flattenHierarchyForExcel = (nodes: HierarchicalNode[], parentPath: string = ''): any[] => {
    const rows: any[] = [];

    nodes.forEach((node) => {
      const indentation = '  '.repeat(node.level); // 2 spaces per level
      const formatted: any = {};

      // Add dimension label with indentation
      formatted['구분'] = indentation + node.label;
      formatted['계층'] = node.dimensionType;

      if (!compareWithLastYear) {
        // Standard view columns
        formatted['거래건수'] = node.data.transaction_count;
        formatted['거래처수'] = node.data.client_count;
        formatted['수량'] = node.data.total_quantity;
        formatted['중량'] = node.data.total_weight;
        formatted['공급가액'] = node.data.total_supply_amount;
        formatted['합계'] = node.data.total_amount;
      } else {
        // Year comparison view columns
        formatted['합계(올해)'] = node.data.total_amount;
        formatted['합계(작년)'] = node.lastYearData ? node.lastYearData.total_amount : '';

        if (node.lastYearData) {
          const difference = Number(node.data.total_amount) - Number(node.lastYearData.total_amount);
          formatted['증감(금액)'] = difference;

          if (Number(node.lastYearData.total_amount) !== 0) {
            const percentChange = (difference / Number(node.lastYearData.total_amount)) * 100;
            formatted['증감률(%)'] = Number(percentChange.toFixed(1));
          } else {
            formatted['증감률(%)'] = '';
          }
        } else {
          formatted['증감(금액)'] = '';
          formatted['증감률(%)'] = '';
        }
      }

      rows.push(formatted);

      // Add children if node is expanded or if we want to export all data
      if (node.children.length > 0) {
        const childPath = parentPath ? `${parentPath} > ${node.label}` : node.label;
        rows.push(...flattenHierarchyForExcel(node.children, childPath));
      }
    });

    return rows;
  };

  const handleExcelDownload = () => {
    if (hierarchicalData.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    // Flatten the hierarchical data structure for Excel
    const exportData = flattenHierarchyForExcel(hierarchicalData);

    const filename = generateFilename('판매현황분석');
    
    // Convert to island format for consistency with reference date support
    const { exportIslandTables } = require('@/lib/excel-export');
    const headers = Object.keys(exportData[0] || {});
    const data = exportData.map(row => headers.map(h => row[h]));
    
    exportIslandTables(
      [{ title: '판매현황 분석 결과', headers, data }],
      filename,
      `${startDate} ~ ${endDate}`
    );
  };

  const getActiveGroupingLabel = () => {
    const labels = [];

    employeeGroupings.forEach(group => {
      const label = group === 'individual' ? '개인별' : group === 'team' ? '팀별' : '사업소별';
      labels.push(label);
    });

    clientGroupings.forEach(group => {
      const label = group === 'industry' ? '업종별' : '지역별';
      labels.push(label);
    });

    productGroupings.forEach(group => {
      const label = group === 'group1' ? '품목그룹1' : group === 'group2' ? '품목그룹2' : '품목그룹3';
      labels.push(label);
    });

    return labels.length > 0 ? labels.join(' → ') : '집계 기준 없음';
  };

  const getActiveGroupingCount = () => {
    return employeeGroupings.length + clientGroupings.length + productGroupings.length;
  };

  const loadGoals = () => {
    try {
      const storedGoals = localStorage.getItem('salesAnalysisGoals');
      if (storedGoals) {
        setGoals(JSON.parse(storedGoals));
      }
    } catch (error) {
      console.error('Failed to load goals:', error);
    }
  };

  const saveGoal = (goalData: Omit<Goal, 'id' | 'createdAt'>) => {
    const newGoal: Goal = {
      ...goalData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };

    const updatedGoals = [...goals, newGoal];
    setGoals(updatedGoals);
    localStorage.setItem('salesAnalysisGoals', JSON.stringify(updatedGoals));
  };

  const deleteGoal = (goalId: string) => {
    const updatedGoals = goals.filter(g => g.id !== goalId);
    setGoals(updatedGoals);
    localStorage.setItem('salesAnalysisGoals', JSON.stringify(updatedGoals));
  };

  const applyGoalsToHierarchy = (nodes: HierarchicalNode[], activeGoals: Goal[]): HierarchicalNode[] => {
    return nodes.map(node => {
      // Find matching goal for this node
      const matchingGoal = findMatchingGoal(node, activeGoals);

      let goalValue: number | undefined;
      let achievementRate: number | undefined;

      if (matchingGoal) {
        goalValue = matchingGoal.targetValue;
        const actualValue = Number(node.data[matchingGoal.metric] || 0);
        achievementRate = goalValue > 0 ? (actualValue / goalValue) * 100 : 0;
      }

      return {
        ...node,
        goal: goalValue,
        achievementRate,
        children: applyGoalsToHierarchy(node.children, activeGoals)
      };
    });
  };

  const findMatchingGoal = (node: HierarchicalNode, activeGoals: Goal[]): Goal | undefined => {
    // Filter goals that apply to the current date range
    const applicableGoals = activeGoals.filter(goal => {
      const goalStart = new Date(goal.period.startDate);
      const goalEnd = new Date(goal.period.endDate);
      const currentStart = new Date(startDate);
      const currentEnd = new Date(endDate);

      // Check if date ranges overlap
      return goalStart <= currentEnd && goalEnd >= currentStart;
    });

    // Find the most specific matching goal
    for (const goal of applicableGoals) {
      // Check if dimension type matches
      if (goal.dimension.type === 'all' && node.level === 0) {
        return goal;
      }

      // Check if specific dimension matches
      const nodeType = getDimensionTypeForNode(node);
      if (goal.dimension.type !== nodeType) {
        continue;
      }

      // If goal has a specific value, check if it matches
      if (goal.dimension.value) {
        if (node.key === goal.dimension.value || node.label.includes(goal.dimension.value)) {
          return goal;
        }
      } else if (goal.dimension.grouping) {
        // If goal is for a grouping type (e.g., all branches)
        const nodeGrouping = getDimensionGroupingForNode(node);
        if (nodeGrouping === goal.dimension.grouping) {
          return goal;
        }
      }
    }

    return undefined;
  };

  const getDimensionTypeForNode = (node: HierarchicalNode): 'employee' | 'client' | 'product' | undefined => {
    const dimType = node.dimensionType;
    if (['사업소', '팀', '사원'].includes(dimType)) return 'employee';
    if (['업종', '지역'].includes(dimType)) return 'client';
    if (['품목그룹1', '품목그룹2', '품목그룹3'].includes(dimType)) return 'product';
    return undefined;
  };

  const getDimensionGroupingForNode = (node: HierarchicalNode): string | undefined => {
    const dimType = node.dimensionType;
    const groupingMap: { [key: string]: string } = {
      '사업소': 'branch',
      '팀': 'team',
      '사원': 'individual',
      '업종': 'industry',
      '지역': 'region',
      '품목그룹1': 'group1',
      '품목그룹2': 'group2',
      '품목그룹3': 'group3'
    };
    return groupingMap[dimType];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              판매현황 분석
            </h2>
            <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
              실험적
            </span>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            집계 순서: <span className="font-medium text-zinc-700 dark:text-zinc-300">{getActiveGroupingLabel()}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <VatToggle id="vat-sales-analysis" />
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={compareWithLastYear}
              onChange={(e) => setCompareWithLastYear(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-600 text-blue-500"
            />
            <span className="text-sm font-medium">작년과 비교</span>
          </label>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={showGoals}
              onChange={(e) => setShowGoals(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-600 text-green-500"
            />
            <span className="text-sm font-medium">목표 표시</span>
          </label>
          <button
            onClick={() => setIsGoalModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            <Target className="w-4 h-4" />
            목표 추가
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <ExcelDownloadButton onClick={handleExcelDownload} disabled={getAllData().length === 0 || isLoading} />
        </div>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Calendar className="w-5 h-5 text-zinc-400" />
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">기간:</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        />
        <span className="text-zinc-400">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        />
      </div>

      {/* Dimension Hierarchy Builder */}
      {showFilters && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">집계 순서 (Hierarchy)</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">드래그하여 순서를 변경하세요. 왼쪽이 최상위 계층입니다.</p>
          </div>
          <div className="flex gap-3 items-center">
            {categoryOrder.map((category, index) => {
              const hasGroupings =
                (category === 'employee' && employeeGroupings.length > 0) ||
                (category === 'client' && clientGroupings.length > 0) ||
                (category === 'product' && productGroupings.length > 0);

              let Icon, label, colorClasses;
              if (category === 'employee') {
                Icon = Users;
                label = '사원';
                colorClasses = hasGroupings
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-500'
                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-400';
              } else if (category === 'client') {
                Icon = Building;
                label = '거래처';
                colorClasses = hasGroupings
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-500'
                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-400';
              } else {
                Icon = Package;
                label = '품목';
                colorClasses = hasGroupings
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950 text-purple-500'
                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-400';
              }

              return (
                <div key={category} className="flex items-center gap-2">
                  {index > 0 && (
                    <ChevronRight className="w-5 h-5 text-zinc-400" />
                  )}
                  <div
                    draggable
                    onDragStart={() => handleDragStart(category)}
                    onDragOver={(e) => handleDragOver(e, category)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-move transition-all ${
                      draggedCategory === category
                        ? 'opacity-50 scale-95'
                        : 'opacity-100 scale-100'
                    } ${colorClasses}`}
                  >
                    <GripVertical className="w-4 h-4" />
                    <Icon className="w-5 h-5" />
                    <div className="flex flex-col">
                      <span className={`text-sm font-semibold ${hasGroupings ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-500'}`}>
                        {label}
                      </span>
                      <span className="text-xs text-zinc-500">
                        Level {index + 1}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aggregation Controls */}
      {showFilters && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee Grouping */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">사원 집계</h3>
              {employeeGroupings.length > 0 && (
                <span className="ml-auto text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {employeeGroupings.length}개 선택
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-xs text-zinc-500 mb-2">집계 기준 선택 (다중선택 가능):</div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={employeeGroupings.includes('individual')}
                    onChange={() => toggleEmployeeGrouping('individual')}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-blue-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">개인별</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={employeeGroupings.includes('team')}
                    onChange={() => toggleEmployeeGrouping('team')}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-blue-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">팀별</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={employeeGroupings.includes('branch')}
                    onChange={() => toggleEmployeeGrouping('branch')}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-blue-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업소별</span>
                </label>
              </div>

              {employeeGroupings.length > 0 && getEmployeeOptions().length > 0 && (
                <>
                  <div className="text-xs text-zinc-500 mt-4 mb-2">포함할 항목 선택 (선택사항):</div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
                    {getEmployeeOptions().map((option) => (
                      <label key={option} className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={employeeValues.includes(option)}
                          onChange={() => toggleEmployeeValue(option)}
                          className="rounded border-zinc-300 dark:border-zinc-600"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{option}</span>
                      </label>
                    ))}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {employeeValues.length > 0 ? `${employeeValues.length}개 선택됨` : '전체 포함'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Client Grouping */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">거래처 집계</h3>
              {clientGroupings.length > 0 && (
                <span className="ml-auto text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {clientGroupings.length}개 선택
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-xs text-zinc-500 mb-2">집계 기준 선택 (다중선택 가능):</div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={clientGroupings.includes('industry')}
                    onChange={() => toggleClientGrouping('industry')}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-emerald-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">업종별</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={clientGroupings.includes('region')}
                    onChange={() => toggleClientGrouping('region')}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-emerald-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">지역별</span>
                </label>
              </div>

              {clientGroupings.length > 0 && getClientOptions().length > 0 && (
                <>
                  <div className="text-xs text-zinc-500 mt-4 mb-2">포함할 항목 선택 (선택사항):</div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
                    {getClientOptions().map((option) => (
                      <label key={option.value} className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clientValues.includes(option.value)}
                          onChange={() => toggleClientValue(option.value)}
                          className="rounded border-zinc-300 dark:border-zinc-600"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {clientValues.length > 0 ? `${clientValues.length}개 선택됨` : '전체 포함'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Product Grouping */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">품목 집계</h3>
              {productGroupings.length > 0 && (
                <span className="ml-auto text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  {productGroupings.length}개 선택
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-xs text-zinc-500 mb-2">집계 기준 선택 (다중선택 가능):</div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={productGroupings.includes('group1')}
                    onChange={() => toggleProductGrouping('group1')}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-purple-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">그룹1 (PVL, CVL, IL...)</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={productGroupings.includes('group2')}
                    onChange={() => toggleProductGrouping('group2')}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-purple-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">그룹2 (Engine, Gear...)</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={productGroupings.includes('group3')}
                    onChange={() => toggleProductGrouping('group3')}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-purple-500"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">그룹3 (FLA, PRE, STA...)</span>
                </label>
              </div>

              {productGroupings.length > 0 && getProductOptions().length > 0 && (
                <>
                  <div className="text-xs text-zinc-500 mt-4 mb-2">포함할 항목 선택 (선택사항):</div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2">
                    {getProductOptions().map((option) => (
                      <label key={option} className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={productValues.includes(option)}
                          onChange={() => toggleProductValue(option)}
                          className="rounded border-zinc-300 dark:border-zinc-600"
                        />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{option}</span>
                      </label>
                    ))}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {productValues.length > 0 ? `${productValues.length}개 선택됨` : '전체 포함'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-4 h-4 text-zinc-400" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">거래건수</p>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{totals.transactions.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <Building className="w-4 h-4 text-zinc-400" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">거래처수</p>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{totals.clients.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-zinc-400" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">총 수량</p>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{totals.quantity.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-zinc-400" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">총 용량</p>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{totals.weight.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-zinc-400" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">공급가액</p>
          </div>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">₩{totals.supplyAmount.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-zinc-400" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">합계</p>
          </div>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₩{totals.amount.toLocaleString()}</p>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            분석 결과 ({hierarchicalData.length.toLocaleString()}개 {getActiveGroupingCount() > 1 ? '최상위 ' : ''}집계)
          </h3>
          {getActiveGroupingCount() > 1 && (
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
            <p className="text-sm text-zinc-500">데이터를 분석하는 중...</p>
          </div>
        ) : hierarchicalData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
            <p>조회된 데이터가 없습니다</p>
            <p className="text-sm mt-2">집계 기준을 선택해주세요</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    구분
                  </th>
                  {!compareWithLastYear ? (
                    <>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">거래건수</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">거래처수</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">수량</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">용량</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">공급가액</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">합계</th>
                      {showGoals && (
                        <>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">목표</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">달성률</th>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">합계<br/><span className="text-xs font-normal">(올해)</span></th>
                      <th className="px-2 py-3 text-right text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">합계<br/><span className="text-xs font-normal">(작년)</span></th>
                      <th className="px-2 py-3 text-right text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">증감<br/><span className="text-xs font-normal">(금액)</span></th>
                      <th className="px-2 py-3 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">증감률<br/><span className="text-xs font-normal">(%)</span></th>
                      {showGoals && (
                        <>
                          <th className="px-2 py-3 text-right text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">목표</th>
                          <th className="px-2 py-3 text-right text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">달성률</th>
                        </>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {renderHierarchicalRows(hierarchicalData)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Goal Modal */}
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSave={saveGoal}
        filterOptions={filterOptions}
      />

      {/* Goals List Panel */}
      {goals.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">설정된 목표 ({goals.length})</h3>
          </div>
          <div className="space-y-3">
            {goals.map(goal => (
              <div
                key={goal.id}
                className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{goal.name}</span>
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 space-y-1">
                    <div>
                      기간: {goal.period.startDate} ~ {goal.period.endDate}
                    </div>
                    <div>
                      범위: {goal.dimension.type === 'all' ? '전체' : `${goal.dimension.type} - ${goal.dimension.grouping || ''} ${goal.dimension.value || '(전체)'}`}
                    </div>
                    <div>
                      목표: {goal.targetValue.toLocaleString()}
                      {goal.metric === 'total_amount' && ' 원'}
                      {goal.metric === 'total_quantity' && ' 개'}
                      {goal.metric === 'total_weight' && ' L'}
                      {goal.metric === 'transaction_count' && ' 건'}
                      {goal.metric === 'client_count' && ' 개'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteGoal(goal.id)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
