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
  X,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Activity {
  id: number;
  activity_date: string;
  activity_type: 'completed_task' | 'planned_task' | 'issue' | 'meeting' | 'other';
  activity_label: string;
  activity_summary: string;
  customer_name?: string;
  location?: string;
  products_mentioned: string[];
  outcome?: string;
  issue_severity?: 'low' | 'medium' | 'high';
  action_taken?: string;
  resolved_by?: string;
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
  message_date: string;
  activity_label: string;
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
  activity_label: string;
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

interface CompanyMessage {
  id: number;
  chat_date: string;
  user_name: string;
  message: string;
  chat_room?: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeStat[]>([]);
  const [searchTerm, setSearchTerm] = useState(''); // New search term state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'tracker' | 'companies' | 'products' | 'calendar' | 'issues'>('tracker');
  
  // Data for selected employee
  const [trackerData, setTrackerData] = useState<FollowUpMatch[]>([]);
  const [summaryData, setSummaryData] = useState<EmployeeSummary | null>(null);
  const [calendarActivities, setCalendarActivities] = useState<Activity[]>([]); // New state
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date()); 
  
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getFirstDayOfMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const getLastDayOfMonthStr = () => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Filters for tracker
  const [startDate, setStartDate] = useState(getFirstDayOfMonthStr());
  const [endDate, setEndDate] = useState(getLastDayOfMonthStr());
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'missed' | 'future'>('all');

  // Source messages modal
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceMessages, setSourceMessages] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [showCompanyMessagesModal, setShowCompanyMessagesModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [companyMessages, setCompanyMessages] = useState<CompanyMessage[]>([]);
  const [loadingCompanyMessages, setLoadingCompanyMessages] = useState(false);
  const [showProductMessagesModal, setShowProductMessagesModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [productMessages, setProductMessages] = useState<CompanyMessage[]>([]);
  const [loadingProductMessages, setLoadingProductMessages] = useState(false);

  const [markingActivityId, setMarkingActivityId] = useState<number | null>(null);

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
  }, [startDate, endDate]);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeDetails(selectedEmployee);
    }
  }, [selectedEmployee, startDate, endDate]);

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate
      });
      const response = await apiFetch(`/api/employees?${params}`);
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

  const markActivityAsCompleted = async (activityId: number) => {
    setMarkingActivityId(activityId);
    try {
      const res = await apiFetch(`/api/employees/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: 'completed_task',
          completion_reason: '관리자 보고로 완료 처리'
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || '업데이트 실패');
        return;
      }
      if (selectedEmployee) {
        await loadEmployeeDetails(selectedEmployee);
      }
      await loadEmployees();
    } catch (e) {
      console.error(e);
      alert('업데이트 중 오류가 발생했습니다.');
    } finally {
      setMarkingActivityId(null);
    }
  };

  const confirmMarkPlannedAsCompleted = (activityId: number) => {
    if (
      !window.confirm(
        '이 예정 항목을 완료로 변경합니다. 활동 유형이 "예정"에서 "완료"로 바뀌며 Follow-up 통계에 반영됩니다. 계속할까요?\n\n완료 사유: 관리자 보고로 완료 처리'
      )
    ) {
      return;
    }
    void markActivityAsCompleted(activityId);
  };

  const isCompletedActivityType = (t: string) =>
    t === 'completed_task' || t === 'work_completed' || t === 'sales_activity';

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
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of current year
        endDate: new Date().toISOString().split('T')[0] // Today
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

  const loadCompanyMessages = async (companyName: string) => {
    if (!selectedEmployee) return;

    setLoadingCompanyMessages(true);
    setSelectedCompany(companyName);
    setCompanyMessages([]);
    setShowCompanyMessagesModal(true);

    try {
      const params = new URLSearchParams({
        employee: selectedEmployee,
        company: companyName
      });
      const response = await apiFetch(`/api/employees/company-messages?${params}`);
      const data = await response.json();

      if (data.success) {
        setCompanyMessages(data.data.messages || []);
      }
    } catch (error) {
      console.error('Error loading company messages:', error);
    } finally {
      setLoadingCompanyMessages(false);
    }
  };

  const loadProductMessages = async (productName: string) => {
    if (!selectedEmployee) return;

    setLoadingProductMessages(true);
    setSelectedProduct(productName);
    setProductMessages([]);
    setShowProductMessagesModal(true);

    try {
      const params = new URLSearchParams({
        employee: selectedEmployee,
        product: productName
      });
      const response = await apiFetch(`/api/employees/product-messages?${params}`);
      const data = await response.json();

      if (data.success) {
        setProductMessages(data.data.messages || []);
      }
    } catch (error) {
      console.error('Error loading product messages:', error);
    } finally {
      setLoadingProductMessages(false);
    }
  };

  const filteredMatches = trackerData.filter(match => {
    if (statusFilter === 'all') return true;
    return match.status === statusFilter;
  });

  return (
    <div className="flex bg-gray-50 overflow-hidden h-screen">
      {/* Sidebar - Employee List */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-xl z-10">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            직원 현황
          </h2>
          <div className="mt-3 relative">
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
        
        <div className="flex-1 overflow-y-scroll p-3 space-y-1.5">
          {loadingEmployees ? (
            <div className="text-center py-8 text-gray-500">직원 목록을 불러오는 중...</div>
          ) : (
            <>
              {employees.length > 0 && employees.every(e => e.total === 0) && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-bold text-amber-800 text-center">
                    이번 달 데이터가 없습니다
                  </p>
                </div>
              )}
              {filteredEmployees.map(emp => (
              <button
                key={emp.employee_name}
                onClick={() => setSelectedEmployee(emp.employee_name)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  selectedEmployee === emp.employee_name
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-white border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-sm text-gray-900 block leading-tight truncate">{emp.employee_name}</span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{emp.department || '영업팀'}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform flex-shrink-0 ${
                    selectedEmployee === emp.employee_name ? 'rotate-90 text-blue-500' : 'text-gray-300'
                  }`} />
                </div>
                <div className="mt-2 flex items-center gap-2">
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
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedEmployee && summaryData ? (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h1 className="truncate text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
                      {selectedEmployee}
                    </h1>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-blue-100">
                      {summaryData.profile.employment_status || 'ACTIVE'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="font-medium text-gray-600">
                        {summaryData.profile.department || '영업팀'} / {summaryData.profile.position || '직원'}
                      </span>
                    </span>
                    <span className="hidden text-gray-300 sm:inline" aria-hidden>
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="font-medium text-gray-600">{summaryData.profile.team || '본사'}</span>
                    </span>
                  </div>
                </div>

                <div className="grid shrink-0 grid-cols-3 gap-0 rounded-lg border border-gray-200/80 bg-gray-50/80 py-2 px-1 sm:grid-cols-3 sm:min-w-[16rem] md:min-w-[18rem]">
                  <div className="min-w-0 flex flex-col items-center justify-center border-r border-gray-200/90 px-2 py-0.5 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">총 방문수</p>
                    <p className="text-lg font-semibold tabular-nums text-gray-900">{summaryData.companies.length}</p>
                  </div>
                  <div className="min-w-0 flex flex-col items-center justify-center border-r border-gray-200/90 px-2 py-0.5 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">언급 품목</p>
                    <p className="text-lg font-semibold tabular-nums text-gray-900">{summaryData.products.length}</p>
                  </div>
                  <div className="min-w-0 flex flex-col items-center justify-center px-2 py-0.5 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Follow-up</p>
                    <p className="text-lg font-semibold tabular-nums text-purple-600">
                      {employees.find(e => e.employee_name === selectedEmployee)?.followUpRate}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
                {[
                  { id: 'tracker', label: 'Follow-up Tracker', icon: CheckCircle2 },
                  { id: 'calendar', label: 'Activity Calendar', icon: LayoutGrid },
                  { id: 'issues', label: 'Issues & Problems', icon: AlertTriangle },
                  { id: 'companies', label: 'Managed Companies', icon: Building2 },
                  { id: 'products', label: 'Handled Products', icon: Package },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-2.5 sm:text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-scroll p-8">
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
                          {Array.from({ length: 12 }, (_, i) => {
                            const now = new Date();
                            const currentYearNum = now.getFullYear();
                            const currentMonthNum = now.getMonth();
                            const selectedYear = currentMonth.getFullYear();
                            
                            if (selectedYear > currentYearNum) return null;
                            if (selectedYear === currentYearNum && i > currentMonthNum) return null;
                            
                            return (
                              <option key={i} value={i}>{i + 1}월</option>
                            );
                          }).filter(Boolean)}
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
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full" />
                        <span className="text-xs font-bold text-gray-500">완료</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        <span className="text-xs font-bold text-gray-500">예정</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                        <span className="text-xs font-bold text-gray-500">이슈</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full" />
                        <span className="text-xs font-bold text-gray-500">미팅</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-500 rounded-full" />
                        <span className="text-xs font-bold text-gray-500">기타</span>
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
                          days.push(<div key={`empty-${i}`} className="min-h-32 border-r border-b border-gray-100 bg-gray-50/20" />);
                        }
                        
                        // Days in month
                        for (let d = 1; d <= daysInMonth; d++) {
                          const year = currentMonth.getFullYear();
                          const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
                          const day = String(d).padStart(2, '0');
                          const dateStr = `${year}-${month}-${day}`;
                          const dayActivities = calendarActivities.filter(a => a.activity_date === dateStr);
                          const today = new Date();
                          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                          const isToday = todayStr === dateStr;

                          days.push(
                            <div key={d} className={`min-h-32 border-r border-b border-gray-100 p-3 transition-colors hover:bg-blue-50/30 ${
                              isToday ? 'bg-blue-50/50' : ''
                            }`}>
                              <span className={`inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded-lg mb-2 ${
                                isToday ? 'bg-blue-600 text-white' : 'text-gray-900'
                              }`}>
                                {d}
                              </span>
                              <div className="space-y-2">
                                {dayActivities.map((act) => {
                                  const typeConfig: Record<string, { bg: string, border: string, text: string, icon: string }> = {
                                    completed_task: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', icon: '✓' },
                                    work_completed: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', icon: '✓' },
                                    sales_activity: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', icon: '✓' },
                                    planned_task: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: '📅' },
                                    planning: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: '📅' },
                                    issue: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: '⚠️' },
                                    issue_reported: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: '⚠️' },
                                    meeting: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', icon: '👥' },
                                    other: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900', icon: '📝' }
                                  };
                                  const config = typeConfig[act.activity_type as keyof typeof typeConfig] || typeConfig.other;

                                  return (
                                    <div
                                      key={act.id}
                                      className={`p-2 rounded-lg text-[10px] leading-tight border transition-all hover:scale-[1.02] cursor-default ${config.bg} ${config.border} ${config.text}`}
                                    >
                                      <div className="font-black mb-1 flex items-center gap-1">
                                        <span>{config.icon}</span>
                                        {act.activity_label || act.customer_name || '업무'}
                                      </div>
                                      {act.location && (
                                        <div className="text-[9px] text-gray-500 mb-1">📍 {act.location}</div>
                                      )}
                                      {act.products_mentioned && act.products_mentioned.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {act.products_mentioned.map((p: string, pIdx: number) => (
                                            <span key={pIdx} className="bg-white/80 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-600 border border-slate-100">
                                              {p}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {!isCompletedActivityType(act.activity_type) && (
                                        <button
                                          type="button"
                                          disabled={markingActivityId === act.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void confirmMarkPlannedAsCompleted(act.id);
                                          }}
                                          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-emerald-300/80 bg-white/90 py-1 text-[9px] font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                                        >
                                          {markingActivityId === act.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                          ) : (
                                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                                          )}
                                          완료로 표시
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
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
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    <div className="flex min-w-0 items-center bg-white py-2 px-3 rounded-lg border border-gray-200">
                      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-7 w-[8.25rem] shrink-0 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-900 [color-scheme:light] focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          />
                          <span className="shrink-0 text-xs font-bold text-gray-400">~</span>
                          <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-7 w-[8.25rem] shrink-0 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-900 [color-scheme:light] focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          />
                        </div>
                        <div className="h-4 w-px shrink-0 bg-gray-200" />
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Filter className="h-3.5 w-3.5 text-gray-400" />
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="h-7 w-[6.75rem] shrink-0 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-900 [color-scheme:light] focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          >
                            <option value="all">모든 상태</option>
                            <option value="completed">완료됨</option>
                            <option value="missed">미완료</option>
                            <option value="future">예정됨</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center bg-white py-1.5 px-2.5 rounded-lg border border-gray-200">
                      <div className="flex min-w-0 flex-1 items-center gap-x-1 gap-y-0.5 overflow-x-auto text-[9px] leading-none sm:overflow-visible">
                        <span className="shrink-0 font-medium text-gray-500">기준</span>
                        <span className="shrink-0 text-gray-300" aria-hidden>·</span>
                        <label className="inline-flex shrink-0 items-center gap-0.5" title="우수">
                          <span className="font-bold text-green-600">우≤</span>
                          <input 
                            type="number" 
                            value={thresholds.good} 
                            onChange={(e) => setThresholds({ ...thresholds, good: parseInt(e.target.value) || 0 })}
                            className="h-6 w-7 rounded border border-green-200/90 bg-green-50/90 p-0 text-center text-[11px] font-bold tabular-nums text-green-900 focus:outline-none focus:ring-1 focus:ring-green-500/50"
                          />
                        </label>
                        <span className="shrink-0 text-gray-300" aria-hidden>·</span>
                        <label className="inline-flex shrink-0 items-center gap-0.5" title="보통">
                          <span className="font-bold text-orange-600">보≤</span>
                          <input 
                            type="number" 
                            value={thresholds.warning} 
                            onChange={(e) => setThresholds({ ...thresholds, warning: parseInt(e.target.value) || 0 })}
                            className="h-6 w-7 rounded border border-orange-200/90 bg-orange-50/90 p-0 text-center text-[11px] font-bold tabular-nums text-orange-900 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                          />
                        </label>
                        <span className="ml-0.5 inline-flex shrink-0 items-center rounded border border-red-200/90 bg-red-50/90 px-1 py-px font-bold text-red-700 tabular-nums" title="이 일수 초과 시 경고">
                          경고 {'>'} {thresholds.warning}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tracker Items */}
                  <div className="grid gap-4">
                    {loadingDetails ? (
                      <div className="text-center py-12 text-gray-500">로딩 중...</div>
                    ) : filteredMatches.length > 0 ? (
                      filteredMatches.map(match => {
                        const cycleDays = getCycleDays(match.planned.message_date, match.planned.next_action_date);
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
                                    계획: {formatDate(match.planned.message_date)} → 예정: {formatDate(match.planned.next_action_date)}
                                  </p>
                                </div>
                                {match.planned.activity_label && (
                                  <h3 className="text-sm font-bold text-gray-900 mb-1">{match.planned.activity_label}</h3>
                                )}
                                <p className="text-xs text-gray-600 leading-relaxed mb-1">
                                  {match.planned.next_action}
                                </p>
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
                              {match.actual.activity_label && (
                                <h4 className="text-sm font-bold text-gray-900 mb-1">{match.actual.activity_label}</h4>
                              )}
                              <p className="text-gray-600 text-xs leading-relaxed mb-3">
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
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                                  <p className="text-sm font-bold text-red-700">
                                    해당 예정일에 관련 업무 수행 기록이 확인되지 않습니다.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={markingActivityId === match.planned.id}
                                  onClick={() => confirmMarkPlannedAsCompleted(match.planned.id)}
                                  className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 sm:self-auto"
                                >
                                  {markingActivityId === match.planned.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                                  )}
                                  완료로 수정
                                </button>
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

              {activeTab === 'issues' && (
                <div className="max-w-5xl">
                  <div className="space-y-4">
                    {loadingDetails ? (
                      <div className="text-center py-12 text-gray-500">로딩 중...</div>
                    ) : calendarActivities.filter(a => a.activity_type === 'issue').length > 0 ? (
                      calendarActivities
                        .filter(a => a.activity_type === 'issue')
                        .sort((a, b) => b.activity_date.localeCompare(a.activity_date))
                        .map((issue, idx) => (
                          <div key={idx} className="bg-white p-6 rounded-2xl border-l-4 border-red-500 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-black uppercase tracking-wider">
                                    Issue
                                  </span>
                                  {issue.issue_severity && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                      issue.issue_severity === 'high' ? 'bg-red-200 text-red-800' :
                                      issue.issue_severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                                      'bg-yellow-200 text-yellow-800'
                                    }`}>
                                      {issue.issue_severity}
                                    </span>
                                  )}
                                  <span className="text-sm font-bold text-gray-500">
                                    {formatDate(issue.activity_date)}
                                  </span>
                                </div>
                                <h3 className="text-sm font-bold text-gray-900 mb-2">{issue.activity_label}</h3>
                                <p className="text-xs text-gray-700 leading-relaxed mb-3">
                                  {issue.activity_summary}
                                </p>
                                <div className="space-y-2">
                                  {issue.customer_name && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <Building2 className="w-4 h-4" />
                                      <span className="font-bold">{issue.customer_name}</span>
                                    </div>
                                  )}
                                  {issue.action_taken && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Action Taken</p>
                                      <p className="text-xs text-gray-900">{issue.action_taken}</p>
                                    </div>
                                  )}
                                  {issue.resolved_by && (
                                    <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                                      <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Resolved By</p>
                                      <p className="text-xs text-gray-900">{issue.resolved_by}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {issue.products_mentioned && issue.products_mentioned.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                                {issue.products_mentioned.map((p: string, pIdx: number) => (
                                  <span key={pIdx} className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold text-gray-700">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                        <AlertTriangle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 font-bold">보고된 이슈가 없습니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'companies' && (
                <div className="max-w-5xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {summaryData.companies.map((company, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => loadCompanyMessages(company.customer_name)}
                        className="w-full text-left bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
                      >
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
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'products' && (
                <div className="max-w-5xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {summaryData.products.map((product, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => loadProductMessages(product.product_name)}
                        className="w-full text-left bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all group"
                      >
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
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : selectedEmployee && loadingDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-2">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold">직원 상세 정보를 불러오는 중...</p>
          </div>
        ) : selectedEmployee && !summaryData ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 px-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
            <p className="text-lg font-bold text-gray-800">요약 정보를 불러오지 못했습니다</p>
            <p className="text-sm mt-1 mb-4">
              <code className="text-xs bg-gray-100 px-1 rounded">/api/employee-summary</code> 응답을 확인해 주세요.
            </p>
            <button
              type="button"
              onClick={() => selectedEmployee && loadEmployeeDetails(selectedEmployee)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
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

      {/* Company Messages Modal */}
      {showCompanyMessagesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-1">업체 관련 메시지</h2>
                <p className="text-sm text-gray-600">
                  {selectedEmployee} - {selectedCompany}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCompanyMessagesModal(false);
                  setSelectedCompany(null);
                  setCompanyMessages([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingCompanyMessages ? (
                <div className="text-center py-12 text-gray-500">로딩 중...</div>
              ) : companyMessages.length > 0 ? (
                companyMessages.map((msg, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
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
                      {msg.chat_room && (
                        <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded font-bold">
                          {msg.chat_room}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {msg.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="font-bold">관련 메시지를 찾을 수 없습니다.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  총 <span className="font-bold text-gray-900">{companyMessages.length}</span>개의 메시지
                </p>
                <button
                  onClick={() => {
                    setShowCompanyMessagesModal(false);
                    setSelectedCompany(null);
                    setCompanyMessages([]);
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

      {/* Product Messages Modal */}
      {showProductMessagesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-1">제품 관련 메시지</h2>
                <p className="text-sm text-gray-600">
                  {selectedEmployee} - {selectedProduct}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowProductMessagesModal(false);
                  setSelectedProduct(null);
                  setProductMessages([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingProductMessages ? (
                <div className="text-center py-12 text-gray-500">로딩 중...</div>
              ) : productMessages.length > 0 ? (
                productMessages.map((msg, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
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
                      {msg.chat_room && (
                        <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-1 rounded font-bold">
                          {msg.chat_room}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {msg.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="font-bold">관련 메시지를 찾을 수 없습니다.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  총 <span className="font-bold text-gray-900">{productMessages.length}</span>개의 메시지
                </p>
                <button
                  onClick={() => {
                    setShowProductMessagesModal(false);
                    setSelectedProduct(null);
                    setProductMessages([]);
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
