"use client";

import { useState, useEffect } from 'react';
import { MessageSquare, Database, Calendar, Users, TrendingUp, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface RawMessage {
  id: number;
  chat_date: string;
  user_name: string;
  message: string;
  chat_room: string;
}

interface Activity {
  id: number;
  employee_name: string;
  activity_date: string;
  activity_type: string;
  activity_summary: string;
  customer_name?: string;
  location?: string;
  products_mentioned?: string;
  next_action?: string;
  next_action_date?: string;
  confidence_score: number;
}

interface DailyStandup {
  id: number;
  employee_name: string;
  report_date: string;
  completed_today?: string;
  planned_tasks?: string;
  customers_visited?: string;
  checkout_location?: string;
  confidence_score: number;
}

export default function KakaoTalkDemoPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rawMessages, setRawMessages] = useState<RawMessage[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [standups, setStandups] = useState<DailyStandup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/kakaotalk-demo?date=${selectedDate}`);
      const data = await response.json();

      if (data.success) {
        setRawMessages(data.data.rawMessages);
        setActivities(data.data.activities);
        setStandups(data.data.standups);
      } else {
        console.error('Error loading data:', data.error);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activityTypeColors: Record<string, string> = {
    customer_visit: 'bg-blue-100 text-blue-800',
    sales_activity: 'bg-green-100 text-green-800',
    work_completed: 'bg-purple-100 text-purple-800',
    planning: 'bg-yellow-100 text-yellow-800',
    issue_reported: 'bg-red-100 text-red-800',
    product_discussion: 'bg-indigo-100 text-indigo-800',
    other: 'bg-gray-100 text-gray-800'
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const uniqueEmployees = Array.from(new Set(rawMessages.map(m => m.user_name)));
  const uniqueCustomers = Array.from(new Set(activities.map(a => a.customer_name).filter(Boolean)));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                카카오톡 메시지 → AI 추출 데이터
              </h1>
              <p className="text-gray-600">
                원본 메시지와 Gemini 2.5 Flash가 추출한 구조화된 데이터를 비교해보세요
              </p>
            </div>
            <MessageSquare className="w-12 h-12 text-blue-600" />
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-4 mt-4">
            <Calendar className="w-5 h-5 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={loadData}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? '로딩 중...' : '데이터 로드'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">원본 메시지</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{rawMessages.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">추출된 활동</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{activities.length}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600">활동 직원</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{uniqueEmployees.length}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-gray-600">방문 고객사</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{uniqueCustomers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Side by Side */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 gap-6">
        {/* Left: Raw Messages */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              원본 카카오톡 메시지
            </h2>
            <p className="text-sm text-gray-500 mt-1">직원들이 보낸 실제 메시지</p>
          </div>
          <div className="p-6 space-y-4 max-h-[800px] overflow-y-auto">
            {rawMessages.map((msg) => (
              <div key={msg.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{msg.user_name}</span>
                  <span className="text-xs text-gray-500">{formatTime(msg.chat_date)}</span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))}
            {rawMessages.length === 0 && !loading && (
              <p className="text-center text-gray-500 py-8">
                선택한 날짜의 메시지가 없습니다
              </p>
            )}
          </div>
        </div>

        {/* Right: Extracted Data */}
        <div className="space-y-6">
          {/* Activities */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                추출된 활동 데이터
              </h2>
              <p className="text-sm text-gray-500 mt-1">AI가 구조화한 업무 활동</p>
            </div>
            <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
              {activities.map((activity) => (
                <div key={activity.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{activity.employee_name}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${activityTypeColors[activity.activity_type] || activityTypeColors.other}`}>
                        {activity.activity_type}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {(activity.confidence_score * 100).toFixed(0)}% 신뢰도
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{activity.activity_summary}</p>
                  {activity.customer_name && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <TrendingUp className="w-3 h-3" />
                      고객: {activity.customer_name}
                    </div>
                  )}
                  {activity.location && (
                    <div className="text-xs text-gray-500 mt-1">
                      📍 {activity.location}
                    </div>
                  )}
                  {activity.products_mentioned && JSON.parse(activity.products_mentioned).length > 0 && (
                    <div className="text-xs text-purple-600 mt-1">
                      🛢️ {JSON.parse(activity.products_mentioned).join(', ')}
                    </div>
                  )}
                  {activity.next_action && (
                    <div className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      다음: {activity.next_action}
                    </div>
                  )}
                </div>
              ))}
              {activities.length === 0 && !loading && (
                <p className="text-center text-gray-500 py-8">
                  추출된 활동이 없습니다
                </p>
              )}
            </div>
          </div>

          {/* Daily Standups */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                일일 업무 요약
              </h2>
              <p className="text-sm text-gray-500 mt-1">직원별 하루 활동 요약</p>
            </div>
            <div className="p-6 space-y-3 max-h-[350px] overflow-y-auto">
              {standups.map((standup) => {
                const completed = standup.completed_today ? JSON.parse(standup.completed_today) : [];
                const planned = standup.planned_tasks ? JSON.parse(standup.planned_tasks) : [];
                const customers = standup.customers_visited ? JSON.parse(standup.customers_visited) : [];

                return (
                  <div key={standup.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{standup.employee_name}</h3>
                      {standup.checkout_location && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          📍 {standup.checkout_location}
                        </span>
                      )}
                    </div>

                    {completed.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-green-700 mb-1">✅ 완료한 업무:</p>
                        <ul className="space-y-1">
                          {completed.slice(0, 2).map((task: any, idx: number) => (
                            <li key={idx} className="text-xs text-gray-600 ml-4">
                              • {task.task} {task.customer && `(${task.customer})`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {planned.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-blue-700 mb-1">📋 계획:</p>
                        <ul className="space-y-1">
                          {planned.slice(0, 2).map((task: any, idx: number) => (
                            <li key={idx} className="text-xs text-gray-600 ml-4">
                              • {task.task} {task.customer && `(${task.customer})`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {customers.length > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        👥 방문 고객: {customers.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
              {standups.length === 0 && !loading && (
                <p className="text-center text-gray-500 py-8">
                  일일 요약이 없습니다
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">🤖 AI 추출 정보</h3>
          <p className="text-sm text-blue-800">
            <strong>모델:</strong> Gemini 2.5 Flash |
            <strong className="ml-4">추출 데이터:</strong> 고객명, 방문 위치, 제품명, 다음 계획, 업무 상태 |
            <strong className="ml-4">신뢰도:</strong> 평균 {activities.length > 0
              ? ((activities.reduce((sum, a) => sum + a.confidence_score, 0) / activities.length) * 100).toFixed(0)
              : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}
