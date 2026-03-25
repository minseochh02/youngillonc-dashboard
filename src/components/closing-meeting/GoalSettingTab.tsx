"use client";

import { useState, useEffect } from 'react';
import { Loader2, Save, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

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
  { id: 'b2c-auto', label: 'B2C AUTO 팀별' },
  { id: 'b2b-il', label: 'B2B IL 팀별' },
];

const CATEGORIES = ['MB', 'AVI + MAR', 'AUTO', 'IL'];

export default function GoalSettingTab() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [activeGoalType, setActiveGoalType] = useState('category');
  const [activeTarget, setActiveTarget] = useState(CATEGORIES[0]);
  const [teams, setTeams] = useState<{ [key: string]: string[] }>({ 'b2c-auto': [], 'b2b-il': [] });
  const [goals, setGoals] = useState<{ [key: string]: Goal }>({});
  const [actuals, setActuals] = useState<{ [key: string]: Actual }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [year]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch available teams first
      const teamsRes = await apiFetch(`/api/dashboard/sales-analysis`);
      const teamsData = await teamsRes.json();
      if (teamsData.success) {
        // This is a bit of a hack, we should ideally have a cleaner way to get teams
        // but let's use what we have or just wait until we fetch goal data which might have them
      }

      // 2. Fetch goal setting data
      const response = await apiFetch(`/api/dashboard/closing-meeting?tab=goal-setting&year=${year}`);
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
        const b2cTeams = new Set<string>();
        const b2bTeams = new Set<string>();

        result.data.prevYearActual.forEach((a: Actual) => {
          const key = `${a.goal_type_group}_${a.target_name}_${a.month}`;
          actualMap[key] = a;
          
          if (a.goal_type_group === 'b2c-auto') b2cTeams.add(a.target_name);
          if (a.goal_type_group === 'b2b-il') b2bTeams.add(a.target_name);
        });
        setActuals(actualMap);
        setTeams({
          'b2c-auto': Array.from(b2cTeams).sort(),
          'b2b-il': Array.from(b2bTeams).sort(),
        });

        // Set default target if not already set or invalid for new type
        if (activeGoalType === 'b2c-auto' && b2cTeams.size > 0 && !b2cTeams.has(activeTarget)) {
          setActiveTarget(Array.from(b2cTeams).sort()[0]);
        } else if (activeGoalType === 'b2b-il' && b2bTeams.size > 0 && !b2bTeams.has(activeTarget)) {
          setActiveTarget(Array.from(b2bTeams).sort()[0]);
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
      const response = await fetch('/api/dashboard/closing-meeting', {
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
      const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
      for (const month of months) {
        const key = `${activeGoalType}_${activeTarget}_${month}`;
        const goal = goals[key];
        if (goal) {
          await fetch('/api/dashboard/closing-meeting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(goal),
          });
        }
      }
      setMessage({ type: 'success', text: '모든 목표가 저장되었습니다.' });
    } catch (error) {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
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
  const currentTargets = activeGoalType === 'category' ? CATEGORIES : teams[activeGoalType] || [];

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
                    const nextTargets = type.id === 'category' ? CATEGORIES : teams[type.id] || [];
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
                    const actualKey = `${activeGoalType === 'category' ? `category-${activeTarget}` : activeGoalType}_${activeTarget}_${month}`;
                    
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
