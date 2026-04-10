"use client";

import { useState, useEffect, Fragment } from 'react';
import { Loader2, Save, Download, Upload, Calendar, CheckCircle2, AlertCircle, TrendingUp, Percent, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { useDisplayOrderBootstrap } from '@/hooks/useDisplayOrderBootstrap';
import { compareEmployees, compareOffices, compareTeams } from '@/lib/display-order-core';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { ExcelUploadButton } from '@/components/ExcelUploadButton';
import { generateFilename } from '@/lib/excel-export';
import * as XLSX from 'xlsx';

interface Goal {
  year: string;
  month: string;
  goal_type: string;
  target_name: string;
  target_weight: number;
  target_amount: number;
}

interface Actual {
  month: string;
  goal_type_group: string;
  target_name: string;
  weight: number;
  amount: number;
}

type CategoryType = 'tier' | 'division' | 'family' | 'business_type' | 'industry_sector';

interface EmployeeCategoryGoalData {
  employee_name: string;
  branch: string;
  team: string;
  category_type: CategoryType;
  category: string; // e.g., 'Standard', 'Premium', 'IL', 'AUTO', 'MOBIL 1', 'Fleet', etc.
  industry: string; // 산업분류
  sector: string; // 섹터분류 (영일분류)
  last_year_weight: number;
  last_year_amount: number;
  target_weight?: number; // 목표 중량
  target_amount?: number; // 목표 금액
  goal_id?: number; // For updating existing goals
}

interface TeamGroup {
  team: string;
  employees: EmployeeCategoryGoalData[];
  total_last_year_weight: number;
  total_last_year_amount: number;
}

interface BranchGroup {
  branch: string;
  teams: TeamGroup[];
  total_last_year_weight: number;
  total_last_year_amount: number;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString().padStart(2, '0'),
  label: `${i + 1}월`
}));

function categoryTypeLabel(type: CategoryType): string {
  switch (type) {
    case 'tier':
      return '등급';
    case 'division':
      return '모빌제품';
    case 'family':
      return '제품군';
    case 'business_type':
      return 'AUTO 제품';
    case 'industry_sector':
      return '산업별';
  }
}

export default function BulkGoalSettingTab() {
  const { includeVat } = useVatInclude();
  const displayOrder = useDisplayOrderBootstrap();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [categoryType, setCategoryType] = useState<CategoryType>('tier');

  const [branches, setBranches] = useState<BranchGroup[]>([]);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [editingGoals, setEditingGoals] = useState<Map<string, {
    weight: number;
    amount: number;
  }>>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchBulkGoalData();
  }, [year, selectedMonth, categoryType, includeVat, displayOrder.ready]);

  const fetchBulkGoalData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(
        withIncludeVat(`/api/dashboard/closing-meeting?tab=goal-setting&year=${year}&categoryType=${categoryType}`, includeVat)
      );
      const result = await response.json();

      if (result.success) {
        // Build employee-category data from actuals only
        const employeeCategoryMap = new Map<string, EmployeeCategoryGoalData>();

        // Initialize all employee-category combinations from actuals
        result.data.employeeCategoryActual?.forEach((a: any) => {
          // month comes as "2025-01", selectedMonth is "01"
          const monthPart = a.month?.split('-')[1] || a.month;
          if (monthPart === selectedMonth && a.employee_name) {
            const key = `${a.employee_name}_${a.category}_${a.industry}_${a.sector}_${selectedMonth}`;
            if (!employeeCategoryMap.has(key)) {
              employeeCategoryMap.set(key, {
                employee_name: a.employee_name,
                branch: a.branch || '미분류',
                team: a.team || '미분류',
                category_type: categoryType,
                category: a.category,
                industry: a.industry || '미분류',
                sector: a.sector || '미분류',
                last_year_weight: a.weight || 0,
                last_year_amount: a.amount || 0
              });
            }
          }
        });

        // Merge goals data
        result.data.goals?.forEach((g: any) => {
          const monthPart = g.month?.split('-')[1] || g.month;
          if (monthPart === selectedMonth) {
            const key = `${g.employee_name}_${g.category}_${g.industry}_${g.sector}_${selectedMonth}`;
            const existing = employeeCategoryMap.get(key);
            if (existing) {
              existing.target_weight = g.target_weight;
              existing.target_amount = g.target_amount;
              existing.goal_id = g.id;
            }
          }
        });

        // Group by branch > team
        const branchMap = new Map<string, Map<string, EmployeeCategoryGoalData[]>>();
        employeeCategoryMap.forEach(entry => {
          if (!branchMap.has(entry.branch)) {
            branchMap.set(entry.branch, new Map());
          }
          const teamMap = branchMap.get(entry.branch)!;
          if (!teamMap.has(entry.team)) {
            teamMap.set(entry.team, []);
          }
          teamMap.get(entry.team)!.push(entry);
        });

        // Build branch groups with teams
        const branchGroups: BranchGroup[] = [];
        branchMap.forEach((teamMap, branch) => {
          const teams: TeamGroup[] = [];
          let branchTotalLastYearWeight = 0;
          let branchTotalLastYearAmount = 0;

          teamMap.forEach((employees, team) => {
            const sortedEmployees = employees.sort((a, b) => {
              const ec = compareEmployees(
                team,
                a.employee_name,
                b.employee_name,
                displayOrder.empB2c,
                displayOrder.empB2b
              );
              if (ec !== 0) return ec;
              return a.category.localeCompare(b.category);
            });

            const teamTotalLastYearWeight = employees.reduce((sum, e) => sum + e.last_year_weight, 0);
            const teamTotalLastYearAmount = employees.reduce((sum, e) => sum + e.last_year_amount, 0);

            teams.push({
              team,
              employees: sortedEmployees,
              total_last_year_weight: teamTotalLastYearWeight,
              total_last_year_amount: teamTotalLastYearAmount
            });

            branchTotalLastYearWeight += teamTotalLastYearWeight;
            branchTotalLastYearAmount += teamTotalLastYearAmount;
          });

          branchGroups.push({
            branch,
            teams: teams.sort((a, b) =>
              compareTeams(a.team, b.team, displayOrder.teamB2c, displayOrder.teamB2b)
            ),
            total_last_year_weight: branchTotalLastYearWeight,
            total_last_year_amount: branchTotalLastYearAmount
          });
        });

        setBranches(
          branchGroups.sort((a, b) => compareOffices(a.branch, b.branch, displayOrder.office))
        );

        // Auto-expand all branches and teams
        setExpandedBranches(new Set(branchGroups.map(b => b.branch)));
        const allTeamKeys = branchGroups.flatMap(b =>
          b.teams.map(t => `${b.branch}_${t.team}`)
        );
        setExpandedTeams(new Set(allTeamKeys));
      }
    } catch (error) {
      console.error('Failed to fetch bulk goal data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const goalEditKey = (entry: Pick<EmployeeCategoryGoalData, 'employee_name' | 'category' | 'industry' | 'sector'>) =>
    `${entry.employee_name}_${entry.category}_${entry.industry}_${entry.sector}_${selectedMonth}`;

  const handleGoalChange = (entry: EmployeeCategoryGoalData, field: 'weight' | 'amount', value: number) => {
    const key = goalEditKey(entry);

    const current = editingGoals.get(key) || { weight: entry.target_weight || 0, amount: entry.target_amount || 0 };
    setEditingGoals(new Map(editingGoals.set(key, {
      ...current,
      [field]: value
    })));

    // Update the entry directly in branches state
    setBranches(prevBranches => {
      return prevBranches.map(branch => ({
        ...branch,
        teams: branch.teams.map(team => ({
          ...team,
          employees: team.employees.map(emp =>
            emp.employee_name === entry.employee_name &&
            emp.category === entry.category &&
            emp.industry === entry.industry &&
            emp.sector === entry.sector
              ? { ...emp, [field === 'weight' ? 'target_weight' : 'target_amount']: value }
              : emp
          )
        }))
      }));
    });
  };

  const handleSaveIndividual = async (entry: EmployeeCategoryGoalData) => {
    try {
      await saveEmployeeCategoryGoal(entry);
      setMessage({ type: 'success', text: '목표가 저장되었습니다.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const saveEmployeeCategoryGoal = async (entry: EmployeeCategoryGoalData) => {
    const key = goalEditKey(entry);
    const edited = editingGoals.get(key);

    try {
      const goalWeight = edited?.weight ?? entry.target_weight ?? 0;
      const goalAmount = edited?.amount ?? entry.target_amount ?? 0;

      const response = await apiFetch('/api/dashboard/closing-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_goal',
          year,
          month: selectedMonth,
          employee_name: entry.employee_name,
          category_type: categoryType,
          category: entry.category,
          industry: entry.industry,
          sector: entry.sector,
          target_weight: goalWeight,
          target_amount: goalAmount
        }),
      });

      const result = await response.json();
      if (result.success) {
        await fetchBulkGoalData();
        const newEditing = new Map(editingGoals);
        newEditing.delete(key);
        setEditingGoals(newEditing);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save goal:', error);
      return false;
    }
  };

  const saveAllGoals = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const allGoals: any[] = [];

      branches.forEach(branch => {
        branch.teams.forEach(team => {
          team.employees.forEach(entry => {
            const key = goalEditKey(entry);
            const edited = editingGoals.get(key);

            const goalWeight = edited?.weight ?? entry.target_weight ?? 0;
            const goalAmount = edited?.amount ?? entry.target_amount ?? 0;

            if (goalWeight > 0 || goalAmount > 0) {
              allGoals.push({
                year,
                month: selectedMonth,
                employee_name: entry.employee_name,
                category_type: categoryType,
                category: entry.category,
                industry: entry.industry,
                sector: entry.sector,
                target_weight: goalWeight,
                target_amount: goalAmount
              });
            }
          });
        });
      });

      const response = await apiFetch('/api/dashboard/closing-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_all_goals',
          goals: allGoals
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: `${allGoals.length}개 목표가 저장되었습니다.` });
        setEditingGoals(new Map());
        await fetchBulkGoalData();
      } else {
        setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const applyCopyFromLastYear = () => {
    const newEditing = new Map(editingGoals);

    setBranches(prevBranches =>
      prevBranches.map(branch => ({
        ...branch,
        teams: branch.teams.map(team => ({
          ...team,
          employees: team.employees.map(entry => {
            const key = goalEditKey(entry);
            const weight = entry.last_year_weight;
            const amount = entry.last_year_amount;
            newEditing.set(key, { weight, amount });
            return { ...entry, target_weight: weight, target_amount: amount };
          })
        }))
      }))
    );

    setEditingGoals(newEditing);
    setMessage({ type: 'success', text: '작년 실적이 목표로 복사되었습니다. "전체 저장"을 눌러 확정하세요.' });
    setTimeout(() => setMessage(null), 3000);
  };

  const applyGrowthRate = (rate: number) => {
    const multiplier = 1 + (rate / 100);
    const newEditing = new Map(editingGoals);

    setBranches(prevBranches =>
      prevBranches.map(branch => ({
        ...branch,
        teams: branch.teams.map(team => ({
          ...team,
          employees: team.employees.map(entry => {
            const key = goalEditKey(entry);
            const weight = Math.round(entry.last_year_weight * multiplier);
            const amount = Math.round(entry.last_year_amount * multiplier);
            newEditing.set(key, { weight, amount });
            return { ...entry, target_weight: weight, target_amount: amount };
          })
        }))
      }))
    );

    setEditingGoals(newEditing);
    setMessage({ type: 'success', text: `작년 대비 ${rate > 0 ? '+' : ''}${rate}% 성장 목표가 설정되었습니다. "전체 저장"을 눌러 확정하세요.` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleTemplateDownload = async () => {
    try {
      const wb = XLSX.utils.book_new();

      // Fetch year-round data for all 12 months
      const response = await apiFetch(
        withIncludeVat(`/api/dashboard/closing-meeting?tab=goal-setting&year=${year}&categoryType=${categoryType}`, includeVat)
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error('Failed to fetch data');
      }

      // Build employee-category data for ALL months
      const employeeCategoryMap = new Map<string, {
        employee_name: string;
        branch: string;
        team: string;
        category: string;
        industry: string;
        sector: string;
        monthlyData: { [month: string]: { last_year_weight: number; last_year_amount: number; target_weight?: number; target_amount?: number } };
      }>();

      // Process all months
      result.data.employeeCategoryActual?.forEach((a: any) => {
        const monthPart = a.month?.split('-')[1] || a.month;
        if (a.employee_name) {
          const baseKey = `${a.employee_name}_${a.category}_${a.industry}_${a.sector}`;

          if (!employeeCategoryMap.has(baseKey)) {
            employeeCategoryMap.set(baseKey, {
              employee_name: a.employee_name,
              branch: a.branch || '미분류',
              team: a.team || '미분류',
              category: a.category,
              industry: a.industry || '미분류',
              sector: a.sector || '미분류',
              monthlyData: {}
            });
          }

          const entry = employeeCategoryMap.get(baseKey)!;
          if (!entry.monthlyData[monthPart]) {
            entry.monthlyData[monthPart] = {
              last_year_weight: 0,
              last_year_amount: 0
            };
          }
          entry.monthlyData[monthPart].last_year_weight = a.weight || 0;
          entry.monthlyData[monthPart].last_year_amount = a.amount || 0;
        }
      });

      // Merge goals data
      result.data.goals?.forEach((g: any) => {
        const monthPart = g.month?.split('-')[1] || g.month;
        const baseKey = `${g.employee_name}_${g.category}_${g.industry}_${g.sector}`;
        const existing = employeeCategoryMap.get(baseKey);
        if (existing && existing.monthlyData[monthPart]) {
          existing.monthlyData[monthPart].target_weight = g.target_weight;
          existing.monthlyData[monthPart].target_amount = g.target_amount;
        }
      });

      const sheetData: any[] = [];

      // Header - one row for all 12 months
      const headerRow = ['사업소', '팀', '담당자', '카테고리', '산업분류', '영일분류'];
      for (let m = 1; m <= 12; m++) {
        const month = m.toString().padStart(2, '0');
        headerRow.push(`${m}월 목표(중량L)`, `${m}월 목표(금액원)`);
      }
      sheetData.push(headerRow);

      // Data rows
      const sortedEntries = Array.from(employeeCategoryMap.values()).sort((a, b) => {
        const br = compareOffices(a.branch, b.branch, displayOrder.office);
        if (br !== 0) return br;
        const tc = compareTeams(a.team, b.team, displayOrder.teamB2c, displayOrder.teamB2b);
        if (tc !== 0) return tc;
        const ec = compareEmployees(
          a.team,
          a.employee_name,
          b.employee_name,
          displayOrder.empB2c,
          displayOrder.empB2b
        );
        if (ec !== 0) return ec;
        return a.category.localeCompare(b.category);
      });

      sortedEntries.forEach(entry => {
        const row: (string | number)[] = [
          entry.branch,
          entry.team,
          entry.employee_name,
          entry.category,
          entry.industry,
          entry.sector
        ];

        for (let m = 1; m <= 12; m++) {
          const month = m.toString().padStart(2, '0');
          const monthData = entry.monthlyData[month];
          if (monthData) {
            row.push(
              monthData.target_weight || 0,
              monthData.target_amount || 0
            );
          } else {
            row.push(0, 0);
          }
        }

        sheetData.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // 사업소
        { wch: 15 }, // 팀
        { wch: 15 }, // 담당자
        { wch: 15 }, // 카테고리
        { wch: 15 }, // 산업분류
        { wch: 15 }  // 영일분류
      ];
      // Add column widths for 12 months x 2 columns each
      for (let m = 0; m < 12; m++) {
        colWidths.push({ wch: 15 }, { wch: 15 });
      }
      ws['!cols'] = colWidths;

      const categoryTypeLabel = categoryType === 'tier' ? '등급' :
                                 categoryType === 'division' ? '모빌제품' :
                                 categoryType === 'family' ? '제품군' :
                                 categoryType === 'business_type' ? 'AUTO 제품' : '산업별';
      XLSX.utils.book_append_sheet(wb, ws, `${categoryTypeLabel} 목표설정`);
      XLSX.writeFile(wb, generateFilename(`${year}년_${categoryTypeLabel}_목표설정_템플릿`));

      setMessage({ type: 'success', text: '템플릿 다운로드 완료. 연간 데이터가 포함되어 있습니다.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Template download error:', error);
      setMessage({ type: 'error', text: '템플릿 다운로드 중 오류가 발생했습니다.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleExcelUpload = async (uploadedData: any[]) => {
    setIsProcessing(true);
    setMessage(null);

    try {
      if (!uploadedData || uploadedData.length === 0) {
        setMessage({ type: 'error', text: '업로드된 데이터가 없습니다.' });
        return;
      }

      const sheet = uploadedData[0];
      const newEditing = new Map(editingGoals);
      let updateCount = 0;

      // Skip header row (row 0), process data rows (row 1+)
      for (let i = 1; i < sheet.data.length; i++) {
        const row = sheet.data[i];
        // Need at least 6 base columns + 2 columns per month (24 for 12 months) = 30 columns minimum
        if (!row || row.length < 30) continue;

        const employeeName = row[2]; // Column 2: 담당자
        const category = row[3]; // Column 3: 카테고리
        const industry = row[4]; // Column 4: 산업분류
        const sector = row[5]; // Column 5: 영일분류

        if (!employeeName || !category) continue;

        // Process all 12 months
        for (let m = 1; m <= 12; m++) {
          const month = m.toString().padStart(2, '0');
          const weightColIndex = 6 + (m - 1) * 2; // Column for weight
          const amountColIndex = 7 + (m - 1) * 2; // Column for amount

          const goalWeight = parseFloat(row[weightColIndex]) || 0;
          const goalAmount = parseFloat(row[amountColIndex]) || 0;

          // Only set goal if at least one value is non-zero
          if (goalWeight > 0 || goalAmount > 0) {
            const key = `${employeeName}_${category}_${industry}_${sector}_${month}`;
            newEditing.set(key, {
              weight: goalWeight,
              amount: goalAmount
            });
            updateCount++;
          }
        }
      }

      setEditingGoals(newEditing);

      // Update the branches state to reflect uploaded goals
      setBranches(prevBranches => {
        return prevBranches.map(branch => ({
          ...branch,
          teams: branch.teams.map(team => ({
            ...team,
            employees: team.employees.map(emp => {
              const key = goalEditKey(emp);
              const uploaded = newEditing.get(key);
              if (uploaded) {
                return {
                  ...emp,
                  target_weight: uploaded.weight,
                  target_amount: uploaded.amount
                };
              }
              return emp;
            })
          }))
        }));
      });

      setMessage({
        type: 'success',
        text: `${updateCount}개 목표가 반영되었습니다. "전체 저장"을 눌러 확정하세요.`
      });
    } catch (error) {
      console.error('Excel upload error:', error);
      setMessage({ type: 'error', text: '업로드 중 오류가 발생했습니다.' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const toggleBranch = (branch: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branch)) {
      newExpanded.delete(branch);
    } else {
      newExpanded.add(branch);
    }
    setExpandedBranches(newExpanded);
  };

  const toggleTeam = (branch: string, team: string) => {
    const key = `${branch}_${team}`;
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedTeams(newExpanded);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getGrowthColor = (rate?: number) => {
    if (rate === undefined || rate === null) return 'text-zinc-400';
    if (rate >= 10) return 'text-green-600 dark:text-green-400';
    if (rate >= 0) return 'text-blue-600 dark:text-blue-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  const totalEntries = branches.reduce((sum, b) =>
    sum + b.teams.reduce((teamSum, t) => teamSum + t.employees.length, 0), 0
  );
  const totalLastYearWeight = branches.reduce((sum, b) => sum + b.total_last_year_weight, 0);
  const totalLastYearAmount = branches.reduce((sum, b) => sum + b.total_last_year_amount, 0);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-zinc-500" />
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="bg-transparent font-bold text-lg focus:outline-none cursor-pointer border-b-2 border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y.toString()}>{y}년</option>
                ))}
              </select>
            </div>

            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-semibold focus:outline-none cursor-pointer border-b-2 border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCategoryType('industry_sector')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  categoryType === 'industry_sector'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                산업별
              </button>
              <button
                onClick={() => setCategoryType('business_type')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  categoryType === 'business_type'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                AUTO 제품
              </button>
              <button
                onClick={() => setCategoryType('division')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  categoryType === 'division'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                모빌제품
              </button>
              <button
                onClick={() => setCategoryType('tier')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  categoryType === 'tier'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                등급
              </button>
              <button
                onClick={() => setCategoryType('family')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  categoryType === 'family'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                제품군
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExcelDownloadButton
              label="템플릿 다운로드"
              onClick={handleTemplateDownload}
              variant="secondary"
            />
            <ExcelUploadButton
              label="목표 업로드"
              onUpload={handleExcelUpload}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Coverage Summary */}
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">총 항목수</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {totalEntries}개
                </p>
              </div>
              <div className="h-12 w-px bg-zinc-200 dark:border-zinc-800" />
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">작년 총 중량</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {formatNumber(totalLastYearWeight)}L
                </p>
              </div>
              <div className="h-12 w-px bg-zinc-200 dark:border-zinc-800" />
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">작년 총 금액</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {formatNumber(totalLastYearAmount)}원
                </p>
              </div>
            </div>

            {message && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
                message.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {message.text}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">일괄 목표 설정</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={applyCopyFromLastYear}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm font-medium transition-colors"
            >
              <Copy className="w-4 h-4" />
              작년 실적 복사
            </button>

            <button
              onClick={() => applyGrowthRate(5)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm font-medium transition-colors"
            >
              <Percent className="w-4 h-4" />
              +5% 성장
            </button>

            <button
              onClick={() => applyGrowthRate(10)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm font-medium transition-colors"
            >
              <Percent className="w-4 h-4" />
              +10% 성장
            </button>

            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600" />

            <button
              onClick={saveAllGoals}
              disabled={isSaving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              전체 저장
            </button>
          </div>
        </div>
      </div>

      {/* Branch/Team Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            담당자별 목표 설정 ({categoryTypeLabel(categoryType)})
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">작년 실적을 참고하여 목표를 설정하세요. 각 항목별로 즉시 저장하거나, 모두 입력 후 "전체 저장"을 누르세요.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
              <tr className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                <th className="py-2 px-1 text-left w-14 min-w-0">사업소</th>
                <th className="py-2 px-1 text-left w-14 min-w-0">팀</th>
                <th className="py-2 px-1 text-left w-16 min-w-0">담당자</th>
                <th className="py-2 px-1.5 text-left w-24 min-w-0">카테고리</th>
                <th className="py-2 px-1.5 text-left w-20 min-w-0">산업분류</th>
                <th className="py-2 px-1.5 text-left w-20 min-w-0">영일분류</th>
                <th className="py-2 px-2 text-right bg-zinc-100 dark:bg-zinc-800 w-[7.5rem]">작년 중량(L)</th>
                <th className="py-2 px-2 text-right bg-zinc-100 dark:bg-zinc-800 w-[7.5rem]">작년 금액(원)</th>
                <th className="py-2 px-2 text-right bg-blue-50 dark:bg-blue-900/20 w-[7rem]">목표 중량(L)</th>
                <th className="py-2 px-2 text-right bg-blue-50 dark:bg-blue-900/20 w-[7rem]">목표 금액(원)</th>
                <th className="py-2 px-1 text-center w-16">저장</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {branches.map((branch) => {
                const isBranchExpanded = expandedBranches.has(branch.branch);
                const totalBranchEntries = branch.teams.reduce((sum, t) => sum + t.employees.length, 0);

                return (
                  <Fragment key={`branch-${branch.branch}`}>
                    {/* Branch Header Row */}
                    <tr
                      className="bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                      onClick={() => toggleBranch(branch.branch)}
                    >
                      <td className="py-1.5 px-1 w-14 min-w-0 align-middle">
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0">
                          {isBranchExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-zinc-400" /> : <ChevronRight className="w-3 h-3 shrink-0 text-zinc-400" />}
                          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 break-words">{branch.branch}</span>
                          <span className="text-[10px] leading-tight font-normal text-zinc-500 shrink-0">({totalBranchEntries}개 항목)</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-1 w-14" />
                      <td className="py-1.5 px-1 w-16" />
                      <td className="py-1.5 px-1.5 w-24" />
                      <td className="py-1.5 px-1.5 w-20" />
                      <td className="py-1.5 px-1.5 w-20" />
                      <td className="py-1.5 px-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {formatNumber(branch.total_last_year_weight)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {formatNumber(branch.total_last_year_amount)}
                      </td>
                      <td className="py-1.5 px-2"></td>
                      <td className="py-1.5 px-2"></td>
                      <td className="py-1.5 px-2"></td>
                    </tr>

                    {/* Team Rows */}
                    {isBranchExpanded && branch.teams.map((team) => {
                      const teamKey = `${branch.branch}_${team.team}`;
                      const isTeamExpanded = expandedTeams.has(teamKey);

                      return (
                        <Fragment key={`team-${teamKey}`}>
                          {/* Team Header Row */}
                          <tr
                            className="bg-green-50/20 dark:bg-green-900/5 hover:bg-green-50/40 dark:hover:bg-green-900/10 cursor-pointer transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTeam(branch.branch, team.team);
                            }}
                          >
                            <td className="py-1.5 px-1 w-14" />
                            <td className="py-1.5 px-1 w-14 min-w-0 align-middle">
                              <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0">
                                {isTeamExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-zinc-400" /> : <ChevronRight className="w-3 h-3 shrink-0 text-zinc-400" />}
                                <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200 break-words">{team.team}</span>
                                <span className="text-[10px] leading-tight text-zinc-500 shrink-0">({team.employees.length}개 항목)</span>
                              </div>
                            </td>
                            <td className="py-1.5 px-1 w-16" />
                            <td className="py-1.5 px-1.5 w-24" />
                            <td className="py-1.5 px-1.5 w-20" />
                            <td className="py-1.5 px-1.5 w-20" />
                            <td className="py-1.5 px-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                              {formatNumber(team.total_last_year_weight)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                              {formatNumber(team.total_last_year_amount)}
                            </td>
                            <td className="py-1.5 px-2"></td>
                            <td className="py-1.5 px-2"></td>
                            <td className="py-1.5 px-2"></td>
                          </tr>

                          {/* Employee-Category Rows */}
                          {isTeamExpanded && team.employees.map((entry) => {
                            return (
                              <tr
                                key={`employee-${entry.employee_name}-${entry.category}-${entry.industry}-${entry.sector}`}
                                className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                              >
                                <td className="py-1.5 px-1 w-14"></td>
                                <td className="py-1.5 px-1 w-14"></td>
                                <td className="py-1.5 px-1 w-16 min-w-0 font-medium text-xs text-zinc-800 dark:text-zinc-200 pl-1 break-words">
                                  {entry.employee_name}
                                </td>
                                <td className="py-1.5 px-1.5 text-xs text-zinc-600 dark:text-zinc-400 min-w-0 break-words">
                                  {entry.category}
                                </td>
                                <td className="py-1.5 px-1.5 text-xs text-zinc-600 dark:text-zinc-400 min-w-0 break-words">
                                  {entry.industry}
                                </td>
                                <td className="py-1.5 px-1.5 text-xs text-zinc-600 dark:text-zinc-400 min-w-0 break-words">
                                  {entry.sector}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                  {formatNumber(entry.last_year_weight)}
                                </td>
                                <td className="py-1.5 px-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                  {formatNumber(entry.last_year_amount)}
                                </td>
                                <td className="py-1.5 px-1">
                                  <input
                                    type="number"
                                    className="w-full min-w-0 px-1 py-0.5 text-right text-xs border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="0"
                                    value={entry.target_weight || ''}
                                    onChange={(e) => handleGoalChange(entry, 'weight', parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                                <td className="py-1.5 px-1">
                                  <input
                                    type="number"
                                    className="w-full min-w-0 px-1 py-0.5 text-right text-xs border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="0"
                                    value={entry.target_amount || ''}
                                    onChange={(e) => handleGoalChange(entry, 'amount', parseFloat(e.target.value) || 0)}
                                  />
                                </td>
                                <td className="py-1.5 px-1 text-center">
                                  <button
                                    onClick={() => handleSaveIndividual(entry)}
                                    className="px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                  >
                                    저장
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <p className="font-semibold mb-2">💡 사용 팁:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>작년 실적 복사:</strong> 작년과 동일한 목표를 빠르게 설정</li>
          <li><strong>성장률 적용:</strong> 작년 대비 일정 비율 성장 목표 일괄 설정</li>
          <li><strong>템플릿 다운로드:</strong> 작년 실적이 포함된 Excel 파일 다운로드하여 오프라인 작업</li>
          <li><strong>목표 업로드:</strong> Excel에서 편집한 목표를 업로드하여 일괄 반영</li>
          <li><strong>개별 저장:</strong> 각 항목의 저장 버튼으로 즉시 저장 가능</li>
          <li><strong>전체 저장:</strong> 모든 변경사항을 한 번에 저장</li>
        </ul>
      </div>
    </div>
  );
}
