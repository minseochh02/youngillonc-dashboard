"use client";

import { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Package,
  ChevronRight,
  Search,
  Calendar,
  Filter,
  TrendingUp,
  Briefcase,
  ChevronLeft,
  LayoutGrid,
  MessageSquare,
  X
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Activity {
  id: number;
  activity_date: string;
  activity_type: string;
  activity_summary: string;
  customer_name?: string;
  products_mentioned: string[];
  confidence_score: number;
}

interface EmployeeStat {
  employee_name: string;
  department?: string;
  total: number;
  completed: number;
  missed: number;
  future: number;
  followUpRate: string;
}

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

interface EmployeeSummary {
  companies: Array<{
    customer_name: string;
    visit_count: number;
    last_visit: string;
  }>;
  products: Array<{
    product_name: string;
    mention_count: number;
    last_mentioned: string;
    category1?: string;
    category2?: string;
  }>;
  profile: {
    employee_name: string;
    department?: string;
    position?: string;
    team?: string;
    employment_status?: string;
  };
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeStat[]>([]);
  const [searchTerm, setSearchTerm] = useState(''); // New search term state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'tracker' | 'companies' | 'products' | 'calendar'>('tracker');
  
  // Data for selected employee
  const [trackerData, setTrackerData] = useState<FollowUpMatch[]>([]);
  const [summaryData, setSummaryData] = useState<EmployeeSummary | null>(null);
  const [calendarActivities, setCalendarActivities] = useState<Activity[]>([]); // New state
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 2, 1)); // Default to March 2026
  
  // Filters for tracker
  const [startDate, setStartDate] = useState('2024-02-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'missed' | 'future'>('all');

  // Source messages modal
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceMessages, setSourceMessages] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [loadingSource, setLoadingSource] = useState(false);

  // Follow-up Cycle Thresholds
  const [thresholds, setThresholds] = useState({ good: 1, warning: 7 });

  // Helper to calculate days between plan and target
  const getCycleDays = (plannedDate: string, targetDate: string) => {
    const start = new Date(plannedDate);
    const end = new Date(targetDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getCycleStatus = (days: number) => {
    if (days <= thresholds.good) return { label: '우수', color: 'bg-green-100 text-green-700 border-green-200' };
    if (days <= thresholds.warning) return { label: '보통', color: 'bg-orange-100 text-orange-700 border-orange-200' };
    return { label: '경고', color: 'bg-red-100 text-red-700 border-red-200' };
  };

  // Filtered employees for the sidebar
  const filteredEmployees = employees.filter(emp => 
    emp.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeDetails(selectedEmployee);
    }
  }, [selectedEmployee, startDate, endDate]);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const response = await apiFetch(`/api/employees`);
      const data = await response.json();
      if (data.success) {
        setEmployees(data.data.employeeStats);
        if (data.data.employeeStats.length > 0 && !selectedEmployee) {
          setSelectedEmployee(data.data.employeeStats[0].employee_name);
        }
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadEmployeeDetails = async (name: string) => {
    setLoadingDetails(true);
    try {
      // 1. Load tracker data (planned vs actual matches)
      const trackerParams = new URLSearchParams({
        employee: name,
        startDate,
        endDate
      });
      const trackerRes = await apiFetch(`/api/employees?${trackerParams}`);
      const trackerDataJson = await trackerRes.json();
      
      // 2. Load summary data (companies and products)
      const summaryParams = new URLSearchParams({ employee: name });
      const summaryRes = await apiFetch(`/api/employee-summary?${summaryParams}`);
      const summaryDataJson = await summaryRes.json();

      if (trackerDataJson.success) {
        setTrackerData(trackerDataJson.data.matches);
      }
      
      if (summaryDataJson.success) {
        setSummaryData(summaryDataJson.data);
      }

      // 3. Load full activities for the calendar
      const calParams = new URLSearchParams({ 
        employee: name,
        startDate: '2024-01-01',
        endDate: '2026-12-31'
      });
      const calRes = await apiFetch(`/api/employees/activities?${calParams}`);
      const calDataJson = await calRes.json();
      if (calDataJson.success) {
        setCalendarActivities(calDataJson.data);
      }
    } catch (error) {
      console.error('Error loading employee details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const loadSourceMessages = async (activityId: number, activityData: any) => {
    setLoadingSource(true);
    setSelectedActivity(activityData);
    setShowSourceModal(true);

    try {
      const response = await apiFetch(`/api/activities/${activityId}/messages`);
      const data = await response.json();

      if (data.success) {
        setSourceMessages(data.data.messages);
      }
    } catch (error) {
      console.error('Error loading source messages:', error);
    } finally {
      setLoadingSource(false);
    }
  };

  const filteredMatches = trackerData.filter(match => {
    if (statusFilter === 'all') return true;
    return match.status === statusFilter;
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {/* Sidebar - Employee List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            직원 현황
          </h2>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="직원 또는 팀 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingEmployees ? (
            <div className="text-center py-8 text-gray-500">직원 목록을 불러오는 중...</div>
          ) : (
            filteredEmployees.map(emp => (
              <button
                key={emp.employee_name}
                onClick={() => setSelectedEmployee(emp.employee_name)}
                className={`w-full text-left p-4 rounded-2xl transition-all border ${
                  selectedEmployee === emp.employee_name
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-white border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block leading-tight">{emp.employee_name}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{emp.department || '영업팀'}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${
                    selectedEmployee === emp.employee_name ? 'rotate-90 text-blue-500' : 'text-gray-300'
                  }`} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${emp.followUpRate}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-purple-600 whitespace-nowrap">
                    {emp.followUpRate}%
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedEmployee && summaryData ? (
          <>
            {/* Header */}
            <div className="bg-white p-8 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">{selectedEmployee}</h1>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider">
                      {summaryData.profile.employment_status || 'ACTIVE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4" />
                      <span className="text-sm font-medium">{summaryData.profile.department || '영업팀'} / {summaryData.profile.position || '직원'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      <span className="text-sm font-medium">{summaryData.profile.team || '본사'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-6 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">총 방문수</p>
                    <p className="text-2xl font-black text-gray-900">{summaryData.companies.length}</p>
                  </div>
                  <div className="text-center border-x border-gray-200 px-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">언급 품목</p>
                    <p className="text-2xl font-black text-gray-900">{summaryData.products.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Follow-up</p>
                    <p className="text-2xl font-black text-purple-600">
                      {employees.find(e => e.employee_name === selectedEmployee)?.followUpRate}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-8 mt-10">
                {[
                  { id: 'tracker', label: 'Follow-up Tracker', icon: CheckCircle2 },
                  { id: 'calendar', label: 'Visit Calendar', icon: LayoutGrid },
                  { id: 'companies', label: 'Managed Companies', icon: Building2 },
                  { id: 'products', label: 'Handled Products', icon: Package },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 pb-4 text-sm font-bold transition-all relative ${
                      activeTab === tab.id
                        ? 'text-blue-600'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {activeTab === 'calendar' && (
                <div className="max-w-6xl mx-auto space-y-6">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <select 
                          value={currentMonth.getFullYear()}
                          onChange={(e) => setCurrentMonth(new Date(parseInt(e.target.value), currentMonth.getMonth(), 1))}
                          className="text-xl font-black bg-gray-50 border-none rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          {[2024, 2025, 2026].map(year => (
                            <option key={year} value={year}>{year}년</option>
                          ))}
                        </select>
                        <select 
                          value={currentMonth.getMonth()}
                          onChange={(e) => setCurrentMonth(new Date(currentMonth.getFullYear(), parseInt(e.target.value), 1))}
                          className="text-xl font-black bg-gray-50 border-none rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i}>{i + 1}월</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <button 
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
                        >
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                      <button 
                        onClick={() => setCurrentMonth(new Date(2026, 2, 1))}
                        className="px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100"
                      >
                        오늘
                      </button>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        <span className="text-xs font-bold text-gray-500">방문 업무</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full" />
                        <span className="text-xs font-bold text-gray-500">제품 협의</span>
                      </div>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
                      {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                        <div key={day} className={`py-4 text-center text-xs font-black uppercase tracking-widest ${
                          idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-400'
                        }`}>
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7">
                      {(() => {
                        const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
                        const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
                        const days = [];
                        
                        // Empty cells for days before start of month
                        for (let i = 0; i < firstDayOfMonth; i++) {
                          days.push(<div key={`empty-${i}`} className="h-48 border-r border-b border-gray-100 bg-gray-50/20" />);
                        }
                        
                        // Days in month
                        for (let d = 1; d <= daysInMonth; d++) {
                          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                          const dateStr = date.toISOString().split('T')[0];
                          const dayActivities = calendarActivities.filter(a => a.activity_date === dateStr);
                          const isToday = new Date().toISOString().split('T')[0] === dateStr;

                          days.push(
                            <div key={d} className={`h-48 border-r border-b border-gray-100 p-3 transition-colors hover:bg-blue-50/30 ${
                              isToday ? 'bg-blue-50/50' : ''
                            }`}>
                              <span className={`inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded-lg mb-2 ${
                                isToday ? 'bg-blue-600 text-white' : 'text-gray-900'
                              }`}>
                                {d}
                              </span>
                              <div className="space-y-2 max-h-[120px] overflow-y-auto no-scrollbar">
                                {dayActivities.map((act, idx) => (
                                  <div 
                                    key={idx} 
                                    className={`p-2 rounded-lg text-[10px] leading-tight border transition-all hover:scale-[1.02] cursor-default ${
                                      act.activity_type === 'customer_visit' ? 'bg-blue-50 border-blue-100 text-blue-900' :
                                      act.activity_type === 'product_discussion' ? 'bg-purple-50 border-purple-100 text-purple-900' :
                                      'bg-gray-50 border-gray-100 text-gray-900'
                                    }`}
                                  >
                                    <div className="font-black mb-1 flex items-center gap-1">
                                      {act.activity_type === 'customer_visit' ? '🏢' : '🛢️'}
                                      {act.customer_name || '기타 업무'}
                                    </div>
                                    {act.products_mentioned.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {act.products_mentioned.map((p, pIdx) => (
                                          <span key={pIdx} className="bg-white/80 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-600 border border-slate-100">
                                            {p}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return days;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tracker' && (
                <div className="space-y-6 max-w-5xl">
                  {/* Tracker Controls with Cycle Thresholds */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-sm border-none bg-gray-100 rounded-lg py-1.5 focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-400 font-bold">~</span>
                          <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-sm border-none bg-gray-100 rounded-lg py-1.5 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="h-6 w-px bg-gray-200 mx-2" />
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-gray-400" />
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="text-sm border-none bg-gray-100 rounded-lg py-1.5 focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="all">모든 상태</option>
                            <option value="completed">완료됨</option>
                            <option value="missed">미완료</option>
                            <option value="future">예정됨</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-4 w-full">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">관리 주기 설정 (일)</span>
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-[10px] font-bold text-green-600">우수 ≤</span>
                            <input 
                              type="number" 
                              value={thresholds.good} 
                              onChange={(e) => setThresholds({ ...thresholds, good: parseInt(e.target.value) || 0 })}
                              className="w-12 text-center text-sm font-bold bg-green-50 border-none rounded-lg py-1 text-green-700 focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-[10px] font-bold text-orange-600">보통 ≤</span>
                            <input 
                              type="number" 
                              value={thresholds.warning} 
                              onChange={(e) => setThresholds({ ...thresholds, warning: parseInt(e.target.value) || 0 })}
                              className="w-12 text-center text-sm font-bold bg-orange-50 border-none rounded-lg py-1 text-orange-700 focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div className="flex items-center gap-1 flex-1">
                            <span className="text-[10px] font-bold text-red-600">경고 &gt; {thresholds.warning}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tracker Items */}
                  <div className="grid gap-4">
                    {loadingDetails ? (
                      <div className="text-center py-12 text-gray-500">로딩 중...</div>
                    ) : filteredMatches.length > 0 ? (
                      filteredMatches.map(match => {
                        const cycleDays = getCycleDays(match.planned.activity_date, match.planned.next_action_date);
                        const cycleStatus = getCycleStatus(cycleDays);
                        
                        return (
                          <div 
                            key={match.planned.id} 
                            className={`bg-white rounded-2xl p-6 border-l-8 shadow-sm ${
                              match.status === 'completed' ? 'border-green-500' :
                              match.status === 'missed' ? 'border-red-500' :
                              'border-gray-400'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                    match.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    match.status === 'missed' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {match.status}
                                  </span>
                                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${cycleStatus.color}`}>
                                    팔로업 주기: {cycleDays}일 ({cycleStatus.label})
                                  </span>
                                  <p className="text-xs font-bold text-gray-400">
                                    계획: {formatDate(match.planned.activity_date)} → 예정: {formatDate(match.planned.next_action_date)}
                                  </p>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">
                                  {match.planned.next_action}
                                </h3>
                                {match.planned.customer_name && (
                                  <p className="text-sm font-bold text-blue-600 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5" />
                                    {match.planned.customer_name}
                                  </p>
                                )}
                              </div>

                              <button
                                onClick={() => loadSourceMessages(match.planned.id, match.planned)}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-200 text-xs font-bold"
                              >
                                <MessageSquare className="w-4 h-4" />
                                View Source
                              </button>
                            </div>
                            {/* ... rest of the card content ... */}

                          {match.actual && (
                            <div className="mt-6 bg-green-50 rounded-xl p-5 border border-green-100">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="p-1 bg-green-500 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                </div>
                                <p className="text-xs font-bold text-green-700 uppercase tracking-widest">실제 수행 기록</p>
                              </div>
                              <p className="text-gray-900 text-sm leading-relaxed mb-3 font-medium">
                                {match.actual.activity_summary}
                              </p>
                              <div className="flex items-center justify-between pt-3 border-t border-green-200/50">
                                <div className="flex items-center gap-4">
                                  <p className="text-[10px] font-bold text-green-600 uppercase">수행일: {formatDate(match.actual.activity_date)}</p>
                                  <div className="h-3 w-px bg-green-200" />
                                  <p className="text-[10px] font-bold text-green-600 uppercase">신뢰도: {(match.actual.confidence_score * 100).toFixed(0)}%</p>
                                </div>
                                {match.actual.customer_name && (
                                  <p className="text-[10px] font-black text-green-700 bg-green-200/50 px-2 py-0.5 rounded">
                                    {match.actual.customer_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {!match.actual && match.status === 'missed' && (
                            <div className="mt-6 bg-red-50 rounded-xl p-5 border border-red-100">
                              <div className="flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-500" />
                                <p className="text-sm font-bold text-red-700">해당 예정일에 관련 업무 수행 기록이 확인되지 않습니다.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                    ) : (
                      <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                        <Clock className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 font-bold">조건에 맞는 데이터가 없습니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'companies' && (
                <div className="max-w-5xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {summaryData.companies.map((company, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                              <Building2 className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-black text-gray-900 text-lg leading-tight mb-1">{company.customer_name}</h3>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">마지막 방문: {formatDate(company.last_visit)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-blue-600">{company.visit_count}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">방문 횟수</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'products' && (
                <div className="max-w-5xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {summaryData.products.map((product, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                              <Package className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="font-black text-gray-900 text-lg leading-tight mb-1">{product.product_name}</h3>
                              <div className="flex gap-2 mb-1">
                                {product.category1 && (
                                  <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">
                                    {product.category1}
                                  </span>
                                )}
                                {product.category2 && (
                                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">
                                    {product.category2}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">마지막 언급: {formatDate(product.last_mentioned)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-purple-600">{product.mention_count}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">언급 횟수</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Users className="w-16 h-16 text-gray-200 mb-4" />
            <p className="text-lg font-bold">직원을 선택하여 상세 정보를 확인하세요.</p>
          </div>
        )}
      </div>

      {/* Source Messages Modal */}
      {showSourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-1">원본 대화 내역</h2>
                {selectedActivity && (
                  <p className="text-sm text-gray-600">
                    {selectedActivity.employee_name} - {formatDate(selectedActivity.activity_date)}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowSourceModal(false);
                  setSourceMessages([]);
                  setSelectedActivity(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Activity Summary */}
            {selectedActivity && (
              <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">추출된 활동 내용</p>
                <p className="text-sm font-bold text-gray-900">{selectedActivity.next_action}</p>
                {selectedActivity.customer_name && (
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {selectedActivity.customer_name}
                  </p>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingSource ? (
                <div className="text-center py-12 text-gray-500">
                  로딩 중...
                </div>
              ) : sourceMessages.length > 0 ? (
                sourceMessages.map((msg, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {msg.user_name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{msg.user_name}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(msg.chat_date).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap pl-10">
                      {msg.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="font-bold">원본 메시지를 찾을 수 없습니다.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  총 <span className="font-bold text-gray-900">{sourceMessages.length}</span>개의 메시지
                </p>
                <button
                  onClick={() => {
                    setShowSourceModal(false);
                    setSourceMessages([]);
                    setSelectedActivity(null);
                  }}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-bold transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
