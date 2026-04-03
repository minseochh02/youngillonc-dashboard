"use client";

import { useState, useEffect } from 'react';
import { Loader2, Save, Calendar, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
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

const GOAL_TYPES = [
  { id: 'category', label: '월간총괄 (품목그룹)' },
  { id: 'b2c-auto', label: 'B2C 품목그룹별' },
  { id: 'b2b-il', label: 'B2B IL 팀별' },
];

const CATEGORIES = ['MB', 'AVI + MAR', 'AUTO', 'IL'];

// Helper function to detect special employees (no fleet/lcc breakdown)
function isSpecialEmployee(employeeName: string): boolean {
  const specialPatterns = ['사무실 동부', '사무실 서부', '사무실 중부', '남부지사'];
  return specialPatterns.some(pattern => employeeName.includes(pattern));
}

export default function GoalSettingTab() {
  const { includeVat } = useVatInclude();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [activeGoalType, setActiveGoalType] = useState('category');
  const [activeTarget, setActiveTarget] = useState(CATEGORIES[0]);
  const [teams, setTeams] = useState<{ [key: string]: string[] }>({ 'b2c-auto': [], 'b2b-il': [] });
  const [goals, setGoals] = useState<{ [key: string]: Goal }>({});
  const [actuals, setActuals] = useState<{ [key: string]: Actual }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [year, includeVat]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(
        withIncludeVat(`/api/dashboard/closing-meeting?tab=goal-setting&year=${year}`, includeVat)
      );
      const result = await response.json();
      
      if (result.success) {
        const goalMap: { [key: string]: Goal } = {};
        result.data.goals.forEach((g: Goal) => {
          if (g.year === year) {
            const key = `${g.goal_type}_${g.target_name}_${g.month}`;
            goalMap[key] = g;
          }
        });
        setGoals(goalMap);

        const actualMap: { [key: string]: Actual } = {};
        result.data.prevYearActual.forEach((a: Actual) => {
          const key = `${a.goal_type_group}_${a.target_name}_${a.month}`;
          actualMap[key] = a;
        });
        setActuals(actualMap);

        // Process all available teams and branches
        const b2cTeams = new Set<string>();
        const b2bTeams = new Set<string>();
        const branches = new Set<string>();

        if (result.data.allTeams) {
          result.data.allTeams.forEach((t: { name: string, type: string }) => {
            if (t.type === 'b2c-auto') b2cTeams.add(t.name);
            else if (t.type === 'b2b-il') b2bTeams.add(t.name);
            else if (t.type === 'branch') branches.add(t.name);
          });
        }

        // Extract B2C targets including fleet/lcc breakdown from goals
        const b2cTargets = new Set<string>();
        result.data.goals.forEach((g: Goal) => {
          if (g.goal_type === 'b2c-auto' && g.year === year) {
            b2cTargets.add(g.target_name);
          }
        });

        const sortedB2CTargets = Array.from(b2cTargets).sort();
        const sortedB2BTeams = Array.from(b2bTeams).sort();
        const sortedBranches = Array.from(branches).sort();

        const allCategoryTargets = Array.from(new Set([...CATEGORIES, ...sortedBranches]));

        setTeams({
          'category': allCategoryTargets,
          'b2c-auto': sortedB2CTargets.length > 0 ? sortedB2CTargets : CATEGORIES,
          'b2b-il': sortedB2BTeams,
        });

        // Set default target if not already set or invalid for new type
        if (activeGoalType === 'category' && !allCategoryTargets.includes(activeTarget)) {
          setActiveTarget(allCategoryTargets[0]);
        } else if (activeGoalType === 'b2c-auto' && sortedB2CTargets.length > 0 && !sortedB2CTargets.includes(activeTarget)) {
          setActiveTarget(sortedB2CTargets[0]);
        } else if (activeGoalType === 'b2b-il' && sortedB2BTeams.length > 0 && !sortedB2BTeams.includes(activeTarget)) {
          setActiveTarget(sortedB2BTeams[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch goal setting data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoalChange = (month: string, field: 'target_weight' | 'target_amount', value: string) => {
    const numValue = parseFloat(value.replace(/,/g, '')) || 0;
    const key = `${activeGoalType}_${activeTarget}_${month}`;
    setGoals(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { year, month, goal_type: activeGoalType, target_name: activeTarget, target_weight: 0, target_amount: 0 }),
        [field]: numValue
      }
    }));
  };

  const saveGoal = async (month: string) => {
    const key = `${activeGoalType}_${activeTarget}_${month}`;
    const goal = goals[key];
    if (!goal) return;

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/dashboard/closing-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goal),
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: `${month}월 목표가 저장되었습니다.` });
      } else {
        setMessage({ type: 'error', text: '저장에 실패했습니다.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const saveAllGoals = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const allGoalList = Object.values(goals).filter(g => g.year === year);
      
      const response = await apiFetch('/api/dashboard/closing-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allGoalList),
      });
      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: '모든 목표가 저장되었습니다.' });
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

  const handleTemplateDownload = async () => {
    try {
      // Fetch employee data from employee_category table
      const empResponse = await apiFetch('/api/dashboard/data-management?table=employee_category');
      const empData = await empResponse.json();
      const employees = empData.data || [];

      // Fetch employee-industry relationships using SQL query
      const industryResponse = await apiFetch('/api/dashboard/data-management?table=employee_industries');
      const industryData = await industryResponse.json();
      const industryRows = industryData?.data || [];

      // Build employee -> industries mapping
      const employeeIndustries = new Map<string, Array<{ 산업분류: string; 섹터분류: string }>>();

      industryRows.forEach((row: any) => {
        const employeeName = row.employee_name;
        if (!employeeName) return;

        if (!employeeIndustries.has(employeeName)) {
          employeeIndustries.set(employeeName, []);
        }

        employeeIndustries.get(employeeName)!.push({
          산업분류: row.산업분류 || '',
          섹터분류: row.섹터분류 || ''
        });
      });

      // Filter B2B employees (where b2c_팀 = 'B2B')
      const b2bEmployees = employees.filter((e: any) => e.b2c_팀 === 'B2B');

      // Filter B2C employees (where b2c_팀 != 'B2B' and b2c_팀 is not null/empty)
      const b2cEmployees = employees.filter((e: any) => e.b2c_팀 && e.b2c_팀 !== 'B2B');

      const wb = XLSX.utils.book_new();

      // Create B2B사업계획 Sheet
      const b2bHeaders = ['사업소', 'b2b팀', '담당자', '산업분류', 'sector',
                          '1월', '2월', '3월', '4월', '5월', '6월',
                          '7월', '8월', '9월', '10월', '11월', '12월'];

      const b2bRows: any[] = [];
      b2bEmployees.forEach((emp: any) => {
        const employeeName = emp.담당자;
        const industries = employeeIndustries.get(employeeName);

        if (industries && industries.length > 0) {
          // Create one row per industry/sector combination
          industries.forEach((industry) => {
            const row = [
              emp.전체사업소 || '',  // Column 0: Location
              emp.b2b팀 || '',        // Column 1: Team
              employeeName || '',     // Column 2: Employee
              industry.산업분류,       // Column 3: Industry
              industry.섹터분류        // Column 4: Sector
            ];

            // Add 12 months of goal values (columns 5-16)
            for (let m = 1; m <= 12; m++) {
              const month = m.toString().padStart(2, '0');
              const goal = goals[`b2b-il_${emp.b2b팀}_${month}`];
              row.push(goal?.target_weight || 0);
            }

            b2bRows.push(row);
          });
        } else {
          // No industry data - create single row with empty industry/sector
          const row = [
            emp.전체사업소 || '',
            emp.b2b팀 || '',
            employeeName || '',
            '',  // Empty industry
            ''   // Empty sector
          ];

          for (let m = 1; m <= 12; m++) {
            const month = m.toString().padStart(2, '0');
            const goal = goals[`b2b-il_${emp.b2b팀}_${month}`];
            row.push(goal?.target_weight || 0);
          }

          b2bRows.push(row);
        }
      });

      const ws1 = XLSX.utils.aoa_to_sheet([b2bHeaders, ...b2bRows]);
      XLSX.utils.book_append_sheet(wb, ws1, 'B2B사업계획');

      // Create B2C사업계획(중량) Sheet
      const b2cWeightHeaders = ['b2c_팀', '담당자', '구분',
                                 '1월', '2월', '3월', '4월', '5월', '6월',
                                 '7월', '8월', '9월', '10월', '11월', '12월'];

      const b2cWeightRows: any[] = [];
      b2cEmployees.forEach((emp: any) => {
        const employeeName = emp.담당자 || '';

        if (isSpecialEmployee(employeeName)) {
          // Special employee: single row with blank 구분
          const row = [
            emp.b2c_팀 || '',
            employeeName,
            ''  // Blank 구분 for special employees
          ];

          // Add 12 months of weight goals (columns 3-14)
          for (let m = 1; m <= 12; m++) {
            const month = m.toString().padStart(2, '0');
            const goal = goals[`b2c-auto_${emp.b2c_팀}_${month}`];
            row.push(goal?.target_weight || 0);
          }

          b2cWeightRows.push(row);
        } else {
          // Regular employee: 2 rows (fleet, lcc)
          ['fleet', 'lcc'].forEach(category => {
            const row = [
              emp.b2c_팀 || '',
              employeeName,
              category
            ];

            // Add 12 months of weight goals (columns 3-14)
            for (let m = 1; m <= 12; m++) {
              const month = m.toString().padStart(2, '0');
              const goalKey = `b2c-auto_${emp.b2c_팀}-${category}_${month}`;
              const goal = goals[goalKey];
              row.push(goal?.target_weight || 0);
            }

            b2cWeightRows.push(row);
          });
        }
      });

      const ws2 = XLSX.utils.aoa_to_sheet([b2cWeightHeaders, ...b2cWeightRows]);
      XLSX.utils.book_append_sheet(wb, ws2, 'B2C사업계획(중량)');

      // Create B2C사업계획(금액) Sheet (no 구분 column - team level only)
      const b2cAmountHeaders = ['b2c_팀', '담당자',
                                 '1월', '2월', '3월', '4월', '5월', '6월',
                                 '7월', '8월', '9월', '10월', '11월', '12월'];

      const b2cAmountRows = b2cEmployees.map((emp: any) => {
        const row = [
          emp.b2c_팀 || '',
          emp.담당자 || ''
        ];

        // Add 12 months of amount goals (columns 2-13)
        // Amounts are stored at team level (not split by fleet/lcc)
        for (let m = 1; m <= 12; m++) {
          const month = m.toString().padStart(2, '0');

          // Try to find team-level goal first, or sum fleet/lcc if available
          let amount = 0;
          const teamGoal = goals[`b2c-auto_${emp.b2c_팀}_${month}`];
          if (teamGoal) {
            amount = teamGoal.target_amount;
          } else {
            // Sum fleet and lcc amounts if they exist
            const fleetGoal = goals[`b2c-auto_${emp.b2c_팀}-fleet_${month}`];
            const lccGoal = goals[`b2c-auto_${emp.b2c_팀}-lcc_${month}`];
            amount = (fleetGoal?.target_amount || 0) + (lccGoal?.target_amount || 0);
          }

          row.push(amount);
        }

        return row;
      });

      const ws3 = XLSX.utils.aoa_to_sheet([b2cAmountHeaders, ...b2cAmountRows]);
      XLSX.utils.book_append_sheet(wb, ws3, 'B2C사업계획(금액)');

      XLSX.writeFile(wb, generateFilename(`사업계획서_${year}`));
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
      // Validate sheet names
      const b2bSheet = uploadedData.find(s => s.sheetName === 'B2B사업계획');
      const b2cWeightSheet = uploadedData.find(s => s.sheetName === 'B2C사업계획(중량)');
      const b2cAmountSheet = uploadedData.find(s => s.sheetName === 'B2C사업계획(금액)');

      if (!b2bSheet || !b2cWeightSheet || !b2cAmountSheet) {
        setMessage({ type: 'error', text: '필수 시트가 없습니다: B2B사업계획, B2C사업계획(중량), B2C사업계획(금액)' });
        setIsProcessing(false);
        return;
      }

      // Fetch employee_category for validation
      const empResponse = await apiFetch('/api/dashboard/data-management?table=employee_category');
      const empData = await empResponse.json();
      const employees = empData.data || [];

      // Create lookup maps
      const b2bTeamMap = new Map<string, string>(); // employee name → b2b팀
      const b2cTeamMap = new Map<string, string>(); // employee name → b2c_팀
      employees.forEach((emp: any) => {
        if (emp.b2c_팀 === 'B2B' && emp.b2b팀) {
          b2bTeamMap.set(emp.담당자, emp.b2b팀);
        } else if (emp.b2c_팀 && emp.b2c_팀 !== 'B2B') {
          b2cTeamMap.set(emp.담당자, emp.b2c_팀);
        }
      });

      // Parse and aggregate B2B sheet
      const b2bGoals = new Map<string, { weight: number; amount: number }>();

      // Skip header row (row 0), process data rows (row 1+)
      for (let i = 1; i < b2bSheet.data.length; i++) {
        const row = b2bSheet.data[i];
        if (!row || row.length < 17) continue;

        const employeeName = row[2]; // Column 2: 담당자
        if (!employeeName) continue;

        // Validate employee exists in employee_category
        const teamName = b2bTeamMap.get(employeeName);
        if (!teamName) {
          console.warn(`B2B employee not found in employee_category: ${employeeName}`);
          continue;
        }

        // Aggregate monthly values (columns 5-16) by team
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
          const month = (monthIdx + 1).toString().padStart(2, '0');
          const key = `${teamName}_${month}`;
          const value = parseFloat(row[5 + monthIdx]) || 0;

          if (!b2bGoals.has(key)) {
            b2bGoals.set(key, { weight: 0, amount: 0 });
          }
          const existing = b2bGoals.get(key)!;
          existing.weight += value;
        }
      }

      // Parse and aggregate B2C weight sheet
      const b2cWeights = new Map<string, number>();

      // Skip header row (row 0), process data rows (row 1+)
      for (let i = 1; i < b2cWeightSheet.data.length; i++) {
        const row = b2cWeightSheet.data[i];
        if (!row || row.length < 15) continue;

        const teamName = row[0];      // Column 0: b2c_팀
        const employeeName = row[1];  // Column 1: 담당자
        const category = row[2];      // Column 2: 구분 (fleet, lcc, or blank)

        if (!employeeName) continue;

        const empTeam = b2cTeamMap.get(employeeName);
        if (!empTeam) {
          console.warn(`B2C employee not found in employee_category: ${employeeName}`);
          continue;
        }

        // Aggregate monthly weights (columns 3-14)
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
          const month = (monthIdx + 1).toString().padStart(2, '0');

          // Create key based on whether category is specified
          let key: string;
          if (category && category.trim() !== '') {
            // Regular employee with fleet/lcc
            key = `${empTeam}-${category}_${month}`;
          } else {
            // Special employee (no category)
            key = `${empTeam}_${month}`;
          }

          const value = parseFloat(row[3 + monthIdx]) || 0;

          if (!b2cWeights.has(key)) {
            b2cWeights.set(key, 0);
          }
          b2cWeights.set(key, b2cWeights.get(key)! + value);
        }
      }

      // Parse and aggregate B2C amount sheet
      const b2cAmounts = new Map<string, number>();

      // Skip header row (row 0), process data rows (row 1+)
      for (let i = 1; i < b2cAmountSheet.data.length; i++) {
        const row = b2cAmountSheet.data[i];
        if (!row || row.length < 14) continue;

        const employeeName = row[1]; // Column 1: 담당자
        if (!employeeName) continue;

        const teamName = b2cTeamMap.get(employeeName);
        if (!teamName) continue;

        // Aggregate monthly amounts (columns 2-13) by team
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
          const month = (monthIdx + 1).toString().padStart(2, '0');
          const key = `${teamName}_${month}`;
          const value = parseFloat(row[2 + monthIdx]) || 0;

          if (!b2cAmounts.has(key)) {
            b2cAmounts.set(key, 0);
          }
          b2cAmounts.set(key, b2cAmounts.get(key)! + value);
        }
      }

      // Update local state for preview
      const newGoals = { ...goals };
      let updateCount = 0;

      // Add B2B goals
      for (const [key, data] of b2bGoals.entries()) {
        const [teamName, month] = key.split('_');
        const goalKey = `b2b-il_${teamName}_${month}`;
        newGoals[goalKey] = {
          year,
          month,
          goal_type: 'b2b-il',
          target_name: teamName,
          target_weight: Math.round(data.weight),
          target_amount: 0
        };
        updateCount++;
      }

      // Add B2C goals
      // Handle weights (which may have fleet/lcc breakdown) and amounts (team level only)
      const allB2CKeys = new Set([...b2cWeights.keys(), ...b2cAmounts.keys()]);
      for (const key of allB2CKeys) {
        const parts = key.split('_');
        const month = parts[parts.length - 1];
        const teamWithCategory = parts.slice(0, -1).join('_');

        // For amounts, try to match team-level amount to fleet/lcc goals
        let amount = b2cAmounts.get(key) || 0;
        if (amount === 0 && teamWithCategory.includes('-')) {
          // This is a fleet/lcc goal, try to get team-level amount
          const baseTeam = teamWithCategory.split('-')[0];
          const teamKey = `${baseTeam}_${month}`;
          amount = b2cAmounts.get(teamKey) || 0;
        }

        const goalKey = `b2c-auto_${teamWithCategory}_${month}`;

        newGoals[goalKey] = {
          year,
          month,
          goal_type: 'b2c-auto',
          target_name: teamWithCategory,  // e.g., "TeamA-fleet", "TeamA-lcc", or "TeamB"
          target_weight: Math.round(b2cWeights.get(key) || 0),
          target_amount: Math.round(amount)
        };
        updateCount++;
      }

      setGoals(newGoals);
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


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const currentTargets = teams[activeGoalType] || (activeGoalType === 'category' ? CATEGORIES : []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-zinc-500" />
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="bg-transparent font-bold text-lg focus:outline-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y.toString()}>{y}년 목표 설정</option>
              ))}
            </select>
          </div>
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-2" />
          <div className="flex items-center gap-2">
            <ExcelDownloadButton
              label="템플릿 다운로드"
              onClick={handleTemplateDownload}
              variant="secondary"
            />
            <ExcelUploadButton
              label="사업계획서 업로드"
              onUpload={handleExcelUpload}
              disabled={isProcessing}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {message && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
              message.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}
          <button
            onClick={saveAllGoals}
            disabled={isSaving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            전체 저장
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Goal Type and Target Selection */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">목표 유형</h3>
            </div>
            <div className="p-2">
              {GOAL_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => {
                    setActiveGoalType(type.id);
                    const nextTargets = teams[type.id] || (type.id === 'category' ? CATEGORIES : []);
                    setActiveTarget(nextTargets[0] || '');
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeGoalType === type.id
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">대상 선택</h3>
            </div>
            <div className="p-2 max-h-[400px] overflow-y-auto">
              {currentTargets.map(target => (
                <button
                  key={target}
                  onClick={() => setActiveTarget(target)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTarget === target
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {target}
                </button>
              ))}
              {currentTargets.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-zinc-500">
                  데이터가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Monthly Input Grid */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {activeTarget} 월별 목표 설정
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">전년도 실적을 참고하여 목표를 입력하세요.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-4 text-left w-20">월</th>
                    <th className="py-3 px-4 text-right bg-blue-50/50 dark:bg-blue-900/10 text-blue-600">당년 목표 (중량 L)</th>
                    <th className="py-3 px-4 text-right text-zinc-400 italic">전년 실적 (중량 L)</th>
                    <th className="py-3 px-4 text-right bg-green-50/50 dark:bg-green-900/10 text-green-600">당년 목표 (금액 원)</th>
                    <th className="py-3 px-4 text-right text-zinc-400 italic">전년 실적 (금액 원)</th>
                    <th className="py-3 px-4 text-center w-16">저장</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {months.map(month => {
                    const goalKey = `${activeGoalType}_${activeTarget}_${month}`;
                    const actualKey = `${activeGoalType}_${activeTarget}_${month}`;
                    
                    const goal = goals[goalKey] || { target_weight: 0, target_amount: 0 };
                    const actual = actuals[actualKey] || { weight: 0, amount: 0 };

                    return (
                      <tr key={month} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">{parseInt(month)}월</td>
                        <td className="py-3 px-4 bg-blue-50/20 dark:bg-blue-900/5">
                          <input
                            type="text"
                            value={goal.target_weight === 0 ? '' : goal.target_weight.toLocaleString()}
                            onChange={(e) => handleGoalChange(month, 'target_weight', e.target.value)}
                            className="w-full text-right bg-transparent border-b border-blue-200 dark:border-blue-800 focus:border-blue-500 outline-none py-1 font-mono text-blue-700 dark:text-blue-400"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-400 italic">
                          {actual.weight.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 bg-green-50/20 dark:bg-green-900/5">
                          <input
                            type="text"
                            value={goal.target_amount === 0 ? '' : goal.target_amount.toLocaleString()}
                            onChange={(e) => handleGoalChange(month, 'target_amount', e.target.value)}
                            className="w-full text-right bg-transparent border-b border-green-200 dark:border-green-800 focus:border-green-500 outline-none py-1 font-mono text-green-700 dark:text-green-400"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-400 italic">
                          {actual.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => saveGoal(month)}
                            className="p-1.5 text-zinc-400 hover:text-blue-600 transition-colors"
                            title="이 달만 저장"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

