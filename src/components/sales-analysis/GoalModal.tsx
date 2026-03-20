"use client";

import { useState, useEffect } from 'react';
import { X, Target, Calendar, TrendingUp } from 'lucide-react';

interface Goal {
  id: string;
  name: string;
  dimension: {
    type: 'employee' | 'client' | 'product' | 'all';
    grouping?: string; // e.g., 'branch', 'team', 'individual', 'industry', 'region', 'group1', etc.
    value?: string; // specific value like 'MB', '1맥심팀', etc.
  };
  period: {
    startDate: string;
    endDate: string;
  };
  metric: 'total_amount' | 'total_quantity' | 'total_weight' | 'transaction_count' | 'client_count';
  targetValue: number;
  createdAt: string;
}

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  filterOptions?: {
    employees: { name: string }[];
    teams: { name: string }[];
    branches: { name: string }[];
    industries: { code: string; name: string }[];
    regions: { code: string }[];
    productGroup1: { code: string }[];
    productGroup2: { code: string }[];
    productGroup3: { code: string }[];
  } | null;
}

export function GoalModal({ isOpen, onClose, onSave, filterOptions }: GoalModalProps) {
  const [goalName, setGoalName] = useState('');
  const [dimensionType, setDimensionType] = useState<'employee' | 'client' | 'product' | 'all'>('all');
  const [grouping, setGrouping] = useState('');
  const [specificValue, setSpecificValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [metric, setMetric] = useState<Goal['metric']>('total_amount');
  const [targetValue, setTargetValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Set default dates to current quarter
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const quarter = Math.floor(month / 3);
      const quarterStart = new Date(year, quarter * 3, 1);
      const quarterEnd = new Date(year, (quarter + 1) * 3, 0);

      setStartDate(quarterStart.toISOString().split('T')[0]);
      setEndDate(quarterEnd.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!goalName || !startDate || !endDate || !targetValue) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    const goal: Omit<Goal, 'id' | 'createdAt'> = {
      name: goalName,
      dimension: {
        type: dimensionType,
        ...(grouping && { grouping }),
        ...(specificValue && { value: specificValue })
      },
      period: {
        startDate,
        endDate
      },
      metric,
      targetValue: parseFloat(targetValue.replace(/,/g, ''))
    };

    onSave(goal);
    handleClose();
  };

  const handleClose = () => {
    setGoalName('');
    setDimensionType('all');
    setGrouping('');
    setSpecificValue('');
    setStartDate('');
    setEndDate('');
    setMetric('total_amount');
    setTargetValue('');
    onClose();
  };

  const getGroupingOptions = () => {
    switch (dimensionType) {
      case 'employee':
        return [
          { value: 'branch', label: '사업소별' },
          { value: 'team', label: '팀별' },
          { value: 'individual', label: '개인별' }
        ];
      case 'client':
        return [
          { value: 'industry', label: '업종별' },
          { value: 'region', label: '지역별' }
        ];
      case 'product':
        return [
          { value: 'group1', label: '품목그룹1' },
          { value: 'group2', label: '품목그룹2' },
          { value: 'group3', label: '품목그룹3' }
        ];
      default:
        return [];
    }
  };

  const getSpecificValueOptions = () => {
    if (!filterOptions || !grouping) return [];

    switch (grouping) {
      case 'branch':
        return filterOptions.branches.map(b => ({ value: b.name, label: b.name }));
      case 'team':
        return filterOptions.teams.map(t => ({ value: t.name, label: t.name }));
      case 'individual':
        return filterOptions.employees.map(e => ({ value: e.name, label: e.name }));
      case 'industry':
        return filterOptions.industries.map(i => ({
          value: i.code,
          label: `${i.code}${i.name ? ` - ${i.name}` : ''}`
        }));
      case 'region':
        return filterOptions.regions.map(r => ({ value: r.code, label: r.code }));
      case 'group1':
        return filterOptions.productGroup1.map(p => ({ value: p.code, label: p.code }));
      case 'group2':
        return filterOptions.productGroup2.map(p => ({ value: p.code, label: p.code }));
      case 'group3':
        return filterOptions.productGroup3.map(p => ({ value: p.code, label: p.code }));
      default:
        return [];
    }
  };

  const formatNumber = (value: string) => {
    const num = value.replace(/,/g, '');
    if (!num) return '';
    return parseFloat(num).toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">목표 추가</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Goal Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              목표 이름 *
            </label>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="예: 2026년 1분기 MB사업소 매출 목표"
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          {/* Dimension Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              목표 범위
            </label>
            <select
              value={dimensionType}
              onChange={(e) => {
                setDimensionType(e.target.value as typeof dimensionType);
                setGrouping('');
                setSpecificValue('');
              }}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">전체</option>
              <option value="employee">사원</option>
              <option value="client">거래처</option>
              <option value="product">품목</option>
            </select>
          </div>

          {/* Grouping */}
          {dimensionType !== 'all' && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                집계 기준
              </label>
              <select
                value={grouping}
                onChange={(e) => {
                  setGrouping(e.target.value);
                  setSpecificValue('');
                }}
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">선택하세요</option>
                {getGroupingOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Specific Value */}
          {grouping && getSpecificValueOptions().length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                특정 항목 (선택사항)
              </label>
              <select
                value={specificValue}
                onChange={(e) => setSpecificValue(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">전체 (집계 기준 전체에 적용)</option>
                {getSpecificValueOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 mt-1">
                비어있으면 모든 {getGroupingOptions().find(g => g.value === grouping)?.label}에 동일한 목표가 적용됩니다
              </p>
            </div>
          )}

          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                시작일 *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                종료일 *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Metric */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              목표 지표
            </label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Goal['metric'])}
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="total_amount">합계 (금액)</option>
              <option value="total_quantity">수량</option>
              <option value="total_weight">중량</option>
              <option value="transaction_count">거래건수</option>
              <option value="client_count">거래처수</option>
            </select>
          </div>

          {/* Target Value */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              목표값 *
            </label>
            <input
              type="text"
              value={targetValue}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d]/g, '');
                setTargetValue(formatNumber(value));
              }}
              placeholder="1,000,000"
              className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            <p className="text-xs text-zinc-500 mt-1">
              {metric === 'total_amount' && '금액 단위: 원 (₩)'}
              {metric === 'total_quantity' && '수량 단위: 개'}
              {metric === 'total_weight' && '용량 단위: L'}
              {metric === 'transaction_count' && '거래건수'}
              {metric === 'client_count' && '거래처 수'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
            >
              목표 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
