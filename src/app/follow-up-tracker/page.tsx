"use client";

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, TrendingUp, Users, Calendar, Filter, Award } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface PlannedTask {
  id: number;
  employee_name: string;
  activity_date: string;
  next_action: string;
  next_action_date: string;
  customer_name?: string;
  confidence_score: number;
}

interface ActualActivity {
  id: number;
  employee_name: string;
  activity_date: string;
  activity_type: string;
  activity_summary: string;
  customer_name?: string;
  confidence_score: number;
}

interface FollowUpMatch {
  planned: PlannedTask;
  actual: ActualActivity | null;
  status: 'completed' | 'missed' | 'future';
}

interface Stats {
  total: number;
  completed: number;
  missed: number;
  future: number;
  followUpRate: string;
}

interface EmployeeStats {
  employee_name: string;
  total: number;
  completed: number;
  missed: number;
  future: number;
  followUpRate: string;
}

export default function FollowUpTrackerPage() {
  const [matches, setMatches] = useState<FollowUpMatch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [startDate, setStartDate] = useState('2024-02-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'missed' | 'future'>('all');

  // Filter options
  const [availableEmployees, setAvailableEmployees] = useState<string[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [employeeFilter, customerFilter, startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(employeeFilter && { employee: employeeFilter }),
        ...(customerFilter && { customer: customerFilter })
      });

      const response = await apiFetch(`/api/follow-up-tracker?${params}`);
      const data = await response.json();

      if (data.success) {
        setMatches(data.data.matches);
        setStats(data.data.stats);
        setEmployeeStats(data.data.employeeStats);
        setAvailableEmployees(data.data.filters.employees);
        setAvailableCustomers(data.data.filters.customers);
      } else {
        console.error('Error loading follow-up data:', data.error);
      }
    } catch (error) {
      console.error('Error loading follow-up data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = matches.filter(match => {
    if (statusFilter === 'all') return true;
    return match.status === statusFilter;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                업무 Follow-up 추적 시스템
              </h1>
              <p className="text-gray-600">
                직원들이 계획한 업무를 실제로 수행했는지 추적하고 책임성을 측정합니다
              </p>
            </div>
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">직원</label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체</option>
                {availableEmployees.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">고객사</label>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">전체</option>
                {availableCustomers.map(cust => (
                  <option key={cust} value={cust}>{cust}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">전체</option>
                <option value="completed">완료</option>
                <option value="missed">미완료</option>
                <option value="future">예정</option>
              </select>
            </div>
          </div>

          {/* Overall Stats */}
          {stats && (
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600">총 계획</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600">완료</span>
                </div>
                <p className="text-2xl font-bold text-green-700">{stats.completed}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-gray-600">미완료</span>
                </div>
                <p className="text-2xl font-bold text-red-700">{stats.missed}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-600">예정</span>
                </div>
                <p className="text-2xl font-bold text-gray-700">{stats.future}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-gray-600">Follow-up율</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">{stats.followUpRate}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">
        {/* Employee Leaderboard */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-600" />
              직원별 Follow-up 순위
            </h2>
            <p className="text-sm text-gray-500 mt-1">계획 대비 실행률</p>
          </div>
          <div className="p-6 space-y-3 max-h-[600px] overflow-y-auto">
            {employeeStats.map((emp, idx) => (
              <div key={emp.employee_name} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${
                      idx === 0 ? 'text-yellow-600' :
                      idx === 1 ? 'text-gray-400' :
                      idx === 2 ? 'text-orange-600' :
                      'text-gray-600'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-gray-900">{emp.employee_name}</span>
                  </div>
                  <span className="text-lg font-bold text-purple-600">
                    {emp.followUpRate}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <p className="text-gray-500">완료</p>
                    <p className="font-semibold text-green-600">{emp.completed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">미완료</p>
                    <p className="font-semibold text-red-600">{emp.missed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">예정</p>
                    <p className="font-semibold text-gray-600">{emp.future}</p>
                  </div>
                </div>
              </div>
            ))}
            {employeeStats.length === 0 && !loading && (
              <p className="text-center text-gray-500 py-8">데이터가 없습니다</p>
            )}
          </div>
        </div>

        {/* Follow-up Details */}
        <div className="col-span-2 bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Follow-up 상세 내역
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {statusFilter === 'all' ? '전체' :
               statusFilter === 'completed' ? '완료' :
               statusFilter === 'missed' ? '미완료' : '예정'} 업무 ({filteredMatches.length}개)
            </p>
          </div>
          <div className="p-6 space-y-3 max-h-[600px] overflow-y-auto">
            {filteredMatches.map((match) => (
              <div
                key={match.planned.id}
                className={`border-l-4 rounded-lg p-4 ${
                  match.status === 'completed' ? 'border-green-500 bg-green-50' :
                  match.status === 'missed' ? 'border-red-500 bg-red-50' :
                  'border-gray-400 bg-gray-50'
                }`}
              >
                {/* Planned Task */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{match.planned.employee_name}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        match.status === 'completed' ? 'bg-green-200 text-green-800' :
                        match.status === 'missed' ? 'bg-red-200 text-red-800' :
                        'bg-gray-200 text-gray-800'
                      }`}>
                        {match.status === 'completed' ? '✅ 완료' :
                         match.status === 'missed' ? '❌ 미완료' :
                         '⏰ 예정'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      계획일: {formatDate(match.planned.activity_date)}
                    </span>
                  </div>
                  <div className="bg-white rounded p-3 mb-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">📋 계획한 업무:</p>
                    <p className="text-sm text-gray-900">{match.planned.next_action}</p>
                    {match.planned.customer_name && (
                      <p className="text-xs text-blue-600 mt-1">👥 고객: {match.planned.customer_name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      📅 예정일: {formatDate(match.planned.next_action_date)}
                    </p>
                  </div>
                </div>

                {/* Actual Activity */}
                {match.actual && (
                  <div className="bg-white rounded p-3 border-t-2 border-green-300">
                    <p className="text-sm font-medium text-green-700 mb-1">✅ 실제 수행한 업무:</p>
                    <p className="text-sm text-gray-900">{match.actual.activity_summary}</p>
                    {match.actual.customer_name && (
                      <p className="text-xs text-blue-600 mt-1">👥 고객: {match.actual.customer_name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      📅 수행일: {formatDate(match.actual.activity_date)} |
                      신뢰도: {(match.actual.confidence_score * 100).toFixed(0)}%
                    </p>
                  </div>
                )}

                {!match.actual && match.status === 'missed' && (
                  <div className="bg-red-100 rounded p-3 border-t-2 border-red-300">
                    <p className="text-sm font-medium text-red-700">
                      ❌ {formatDate(match.planned.next_action_date)}에 해당 업무 기록이 없습니다
                    </p>
                  </div>
                )}
              </div>
            ))}
            {filteredMatches.length === 0 && !loading && (
              <p className="text-center text-gray-500 py-8">
                {statusFilter === 'all' ? '데이터가 없습니다' :
                 statusFilter === 'completed' ? '완료된 업무가 없습니다' :
                 statusFilter === 'missed' ? '미완료 업무가 없습니다' :
                 '예정된 업무가 없습니다'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📊 Follow-up 추적 방식</h3>
          <p className="text-sm text-blue-800">
            직원이 "내일 X 고객 방문 예정"이라고 계획하면, 다음날 실제로 해당 고객을 방문했는지 확인합니다.
            고객명과 날짜가 매칭되면 ✅ 완료, 기록이 없으면 ❌ 미완료로 표시됩니다.
            <br />
            <strong className="mt-2 block">제외 데이터:</strong> "퇴근" 메시지, 낮은 신뢰도(&lt;70%) 데이터는 제외됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
