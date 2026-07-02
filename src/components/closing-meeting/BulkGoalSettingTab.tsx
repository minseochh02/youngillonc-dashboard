"use client";

import { useState, useEffect, Fragment, useCallback, useDeferredValue, useMemo, useRef } from 'react';
import { Loader2, Save, Calendar, CheckCircle2, AlertCircle, TrendingUp, Copy, ChevronDown, ChevronRight, UserPlus, Search, X } from 'lucide-react';
import { useVatInclude } from '@/contexts/VatIncludeContext';
import { useDisplayOrderBootstrap } from '@/hooks/useDisplayOrderBootstrap';
import { compareEmployees, compareOffices, compareTeams } from '@/lib/display-order-core';
import { apiFetch } from '@/lib/api';
import { withIncludeVat } from '@/lib/vat-query';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { ExcelUploadButton } from '@/components/ExcelUploadButton';
import { generateFilename, exportToExcel } from '@/lib/excel-export';
import * as XLSX from 'xlsx';

interface ClientGoalData {
  client_code: string;
  client_name: string;
  employee_name: string;
  branch: string;
  team: string;
  industry_code?: string;
  industry_name?: string;
  region_code?: string;
  last_year_weight: number;
  last_year_amount: number;
  target_weight?: number;
  target_amount?: number;
  goal_id?: number;
  is_manual?: boolean;
  new_client_date?: string;
  created_at?: string;
}

interface CompanyTypeOption {
  code: string;
  name: string;
  industry?: string;
  sector?: string;
}

interface EmployeeOption {
  employee_code: string;
  employee_name: string;
  branch?: string;
  team?: string;
}

interface RegionOption {
  code: string;
  province_name?: string;
  city_name?: string;
  category3?: string;
  major_category?: string;
  detail_name?: string;
  note?: string;
}

interface ClientSearchResult {
  client_code: string;
  client_name: string;
  industry_code?: string;
  industry_name?: string;
  employee_code?: string;
  employee_name?: string;
  branch?: string;
  team?: string;
  region_code?: string;
  target_weight?: number;
  target_amount?: number;
}

interface NewClientForm {
  client_code: string;
  client_name: string;
  industry_code: string;
  employee_code: string;
  new_client_date: string;
  region_code: string;
  target_weight: string;
  target_amount: string;
}

interface EmployeeGroup {
  employee_name: string;
  clients: ClientGoalData[];
  total_last_year_weight: number;
  total_last_year_amount: number;
}

interface TeamGroup {
  team: string;
  employees: EmployeeGroup[];
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

const todayIsoDate = () => {
  const now = new Date();
  const localTime = now.getTime() - now.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
};

const emptyNewClientForm = (): NewClientForm => ({
  client_code: '',
  client_name: '',
  industry_code: '',
  employee_code: '',
  new_client_date: todayIsoDate(),
  region_code: '',
  target_weight: '',
  target_amount: '',
});

const KOREAN_INITIALS = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

function getKoreanInitials(text: string) {
  return Array.from(text).map((char) => {
    const code = char.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return char;
    return KOREAN_INITIALS[Math.floor((code - 0xac00) / 588)];
  }).join('');
}

function matchesSearchText(value: string | undefined, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  const text = String(value ?? '').toLowerCase();
  if (text.includes(term)) return true;

  return getKoreanInitials(text).toLowerCase().includes(term);
}

function formatEmployeeOption(emp: EmployeeOption) {
  const context = [emp.branch, emp.team].filter(Boolean).join(' / ');
  return context ? `${emp.employee_name} (${context})` : emp.employee_name;
}

function formatCompanyTypeOption(ct: CompanyTypeOption) {
  return `${ct.code} - ${ct.name || ct.industry || '미분류'}`;
}

function formatRegionOption(region: RegionOption) {
  const label = [
    region.province_name,
    region.city_name,
    region.detail_name,
  ].filter(Boolean).join(' ');
  const category = [region.major_category, region.category3].filter(Boolean).join(' / ');
  const suffix = [label, category].filter(Boolean).join(' · ');
  return suffix ? `${region.code} - ${suffix}` : region.code;
}

function upsertClientEntry(map: Map<string, ClientGoalData>, row: Partial<ClientGoalData> & { client_code: string }) {
  const key = row.client_code;
  const existing = map.get(key);
  if (existing) {
    map.set(key, {
      ...existing,
      ...row,
      last_year_weight: row.last_year_weight ?? existing.last_year_weight,
      last_year_amount: row.last_year_amount ?? existing.last_year_amount,
    });
    return;
  }
  map.set(key, {
    client_code: row.client_code,
    client_name: row.client_name || row.client_code,
    employee_name: row.employee_name || '미분류',
    branch: row.branch || '미분류',
    team: row.team || '미분류',
    industry_code: row.industry_code,
    industry_name: row.industry_name,
    region_code: row.region_code,
    last_year_weight: row.last_year_weight ?? 0,
    last_year_amount: row.last_year_amount ?? 0,
    target_weight: row.target_weight,
    target_amount: row.target_amount,
    goal_id: row.goal_id,
    is_manual: row.is_manual,
  });
}

function buildBranchGroups(
  clientMap: Map<string, ClientGoalData>,
  displayOrder: ReturnType<typeof useDisplayOrderBootstrap>
): BranchGroup[] {
  const branchMap = new Map<string, Map<string, Map<string, ClientGoalData[]>>>();
  clientMap.forEach(entry => {
    if (!branchMap.has(entry.branch)) branchMap.set(entry.branch, new Map());
    const teamMap = branchMap.get(entry.branch)!;
    if (!teamMap.has(entry.team)) teamMap.set(entry.team, new Map());
    const empMap = teamMap.get(entry.team)!;
    if (!empMap.has(entry.employee_name)) empMap.set(entry.employee_name, []);
    empMap.get(entry.employee_name)!.push(entry);
  });

  const branchGroups: BranchGroup[] = [];
  branchMap.forEach((teamMap, branch) => {
    const teams: TeamGroup[] = [];
    let branchTotalLastYearWeight = 0;
    let branchTotalLastYearAmount = 0;

    teamMap.forEach((empMap, team) => {
      const employees: EmployeeGroup[] = [];

      empMap.forEach((clients, employeeName) => {
        const sortedClients = clients.sort((a, b) => a.client_name.localeCompare(b.client_name));
        employees.push({
          employee_name: employeeName,
          clients: sortedClients,
          total_last_year_weight: clients.reduce((sum, c) => sum + c.last_year_weight, 0),
          total_last_year_amount: clients.reduce((sum, c) => sum + c.last_year_amount, 0),
        });
      });

      employees.sort((a, b) =>
        compareEmployees(team, a.employee_name, b.employee_name, displayOrder.empB2c, displayOrder.empB2b)
      );

      const teamTotalLastYearWeight = employees.reduce((sum, e) => sum + e.total_last_year_weight, 0);
      const teamTotalLastYearAmount = employees.reduce((sum, e) => sum + e.total_last_year_amount, 0);

      teams.push({
        team,
        employees,
        total_last_year_weight: teamTotalLastYearWeight,
        total_last_year_amount: teamTotalLastYearAmount,
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
      total_last_year_amount: branchTotalLastYearAmount,
    });
  });

  return branchGroups.sort((a, b) => compareOffices(a.branch, b.branch, displayOrder.office));
}

function filterBranchGroups(branches: BranchGroup[], query: string): BranchGroup[] {
  const term = query.trim().toLowerCase();
  if (!term) return branches;

  return branches
    .map((branch) => {
      const teams = branch.teams
        .map((team) => {
          const employees = team.employees
            .map((employee) => {
              const clients = employee.clients.filter((client) =>
                [
                  client.client_code,
                  client.client_name,
                  client.region_code,
                  client.industry_name,
                  employee.employee_name,
                  team.team,
                  branch.branch,
                ]
                  .filter(Boolean)
                  .some((value) => matchesSearchText(String(value), term))
              );

              return {
                ...employee,
                clients,
                total_last_year_weight: clients.reduce((sum, c) => sum + c.last_year_weight, 0),
                total_last_year_amount: clients.reduce((sum, c) => sum + c.last_year_amount, 0),
              };
            })
            .filter((employee) => employee.clients.length > 0);

          return {
            ...team,
            employees,
            total_last_year_weight: employees.reduce((sum, e) => sum + e.total_last_year_weight, 0),
            total_last_year_amount: employees.reduce((sum, e) => sum + e.total_last_year_amount, 0),
          };
        })
        .filter((team) => team.employees.length > 0);

      return {
        ...branch,
        teams,
        total_last_year_weight: teams.reduce((sum, t) => sum + t.total_last_year_weight, 0),
        total_last_year_amount: teams.reduce((sum, t) => sum + t.total_last_year_amount, 0),
      };
    })
    .filter((branch) => branch.teams.length > 0);
}

function HighlightMatch({ text, query }: { text: unknown; query: string }) {
  const value = String(text ?? '');
  const term = query.trim();
  if (!term) return <>{value}</>;

  const lowerText = value.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const start = lowerText.indexOf(lowerTerm);

  if (start === -1) {
    const initials = getKoreanInitials(value).toLowerCase();
    if (!initials.includes(lowerTerm)) return <>{value}</>;
    return (
      <mark className="rounded bg-yellow-200 px-0.5 text-zinc-950 dark:bg-yellow-500/40 dark:text-yellow-50">
        {value}
      </mark>
    );
  }

  const end = start + term.length;
  return (
    <>
      {value.slice(0, start)}
      <mark className="rounded bg-yellow-200 px-0.5 text-zinc-950 dark:bg-yellow-500/40 dark:text-yellow-50">
        {value.slice(start, end)}
      </mark>
      {value.slice(end)}
    </>
  );
}

export default function BulkGoalSettingTab() {
  const { includeVat } = useVatInclude();
  const displayOrder = useDisplayOrderBootstrap();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));

  const [branches, setBranches] = useState<BranchGroup[]>([]);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [editingGoals, setEditingGoals] = useState<Map<string, {
    weight: number;
    amount: number;
  }>>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customGrowthRate, setCustomGrowthRate] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [manualClients, setManualClients] = useState<ClientGoalData[]>([]);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [companyTypes, setCompanyTypes] = useState<CompanyTypeOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [regionCodes, setRegionCodes] = useState<RegionOption[]>([]);
  const [isLookupsLoading, setIsLookupsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [newClientForm, setNewClientForm] = useState<NewClientForm>(() => emptyNewClientForm());
  const newClientCodeRef = useRef('');
  const newClientNameRef = useRef('');
  const [newClientTextResetKey, setNewClientTextResetKey] = useState(0);
  const [employeeOptionSearch, setEmployeeOptionSearch] = useState('');
  const [companyTypeOptionSearch, setCompanyTypeOptionSearch] = useState('');
  const [regionOptionSearch, setRegionOptionSearch] = useState('');
  const [isEmployeePickerOpen, setIsEmployeePickerOpen] = useState(false);
  const [isCompanyTypePickerOpen, setIsCompanyTypePickerOpen] = useState(false);
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);
  const deferredClientSearch = useDeferredValue(clientSearch);
  const deferredEmployeeOptionSearch = useDeferredValue(employeeOptionSearch);
  const deferredCompanyTypeOptionSearch = useDeferredValue(companyTypeOptionSearch);
  const deferredRegionOptionSearch = useDeferredValue(regionOptionSearch);
  const isTableSearchPending = clientSearch !== deferredClientSearch;
  const isEmployeeSearchPending = employeeOptionSearch !== deferredEmployeeOptionSearch;
  const isCompanyTypeSearchPending = companyTypeOptionSearch !== deferredCompanyTypeOptionSearch;
  const isRegionSearchPending = regionOptionSearch !== deferredRegionOptionSearch;

  const applyBranchGroups = useCallback((branchGroups: BranchGroup[]) => {
    setBranches(branchGroups);
    setExpandedBranches(new Set(branchGroups.map(b => b.branch)));
    setExpandedTeams(new Set(branchGroups.flatMap(b => b.teams.map(t => `${b.branch}_${t.team}`))));
    setExpandedEmployees(new Set(
      branchGroups.flatMap(b =>
        b.teams.flatMap(t => t.employees.map(e => `${b.branch}_${t.team}_${e.employee_name}`))
      )
    ));
  }, []);

  const fetchLookups = useCallback(async () => {
    if (companyTypes.length > 0 && employees.length > 0 && regionCodes.length > 0) return;
    setIsLookupsLoading(true);
    try {
      const response = await apiFetch(
        withIncludeVat(
          `/api/dashboard/closing-meeting?tab=goal-setting&year=${year}&includeLookups=true`,
          includeVat
        )
      );
      const result = await response.json();
      if (result.success && result.data.lookups) {
        setCompanyTypes(result.data.lookups.companyTypes || []);
        setEmployees(result.data.lookups.employees || []);
        setRegionCodes(result.data.lookups.regionCodes || []);
      }
    } finally {
      setIsLookupsLoading(false);
    }
  }, [companyTypes.length, employees.length, regionCodes.length, year, includeVat]);

  useEffect(() => {
    fetchBulkGoalData();
  }, [year, selectedMonth, includeVat, displayOrder.ready]);

  useEffect(() => {
    if (!showAddPanel) return;
    fetchLookups();
  }, [showAddPanel, fetchLookups]);

  const fetchBulkGoalData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(
        withIncludeVat(
          `/api/dashboard/closing-meeting?tab=goal-setting&year=${year}&month=${selectedMonth}`,
          includeVat
        )
      );
      const result = await response.json();

      if (result.success) {
        const clientMap = new Map<string, ClientGoalData>();

        result.data.clientActual?.forEach((a: any) => {
          const monthPart = a.month?.split('-')[1] || a.month;
          if (monthPart === selectedMonth && a.client_code) {
            upsertClientEntry(clientMap, {
              client_code: a.client_code,
              client_name: a.client_name || a.client_code,
              employee_name: a.employee_name || '미분류',
              branch: a.branch || '미분류',
              team: a.team || '미분류',
              industry_code: a.industry_code,
              industry_name: a.industry_name,
              region_code: a.region_code,
              last_year_weight: a.weight || 0,
              last_year_amount: a.amount || 0,
              is_manual: Boolean(Number(a.is_manual || 0)),
            });
          }
        });

        result.data.goalClients?.forEach((row: any) => {
          if (!row.client_code) return;
          upsertClientEntry(clientMap, {
            client_code: row.client_code,
            client_name: row.client_name || row.client_code,
            employee_name: row.employee_name || '미분류',
            branch: row.branch || '미분류',
            team: row.team || '미분류',
            industry_code: row.industry_code,
            industry_name: row.industry_name,
            region_code: row.region_code,
            is_manual: Boolean(Number(row.is_manual || 0)),
          });
        });

        // Load all manually created temporary clients so they exist in the grid even if they have 0 goal
        result.data.manualClients?.forEach((row: any) => {
          if (!row.client_code) return;
          upsertClientEntry(clientMap, {
            client_code: row.client_code,
            client_name: row.client_name || row.client_code,
            employee_name: row.employee_name || '미분류',
            branch: row.branch || '미분류',
            team: row.team || '미분류',
            industry_code: row.industry_code,
            industry_name: row.industry_name,
            region_code: row.region_code,
            last_year_weight: 0,
            last_year_amount: 0,
            is_manual: true,
          });
        });

        result.data.goals?.forEach((g: any) => {
          const monthPart = g.month?.split('-')[1] || g.month;
          if (monthPart === selectedMonth) {
            const existing = clientMap.get(g.client_code);
            if (existing) {
              existing.target_weight = g.target_weight;
              existing.target_amount = g.target_amount;
              existing.goal_id = g.id;
            } else {
              upsertClientEntry(clientMap, {
                client_code: g.client_code,
                client_name: g.client_code,
                employee_name: '미분류',
                branch: '미분류',
                team: '미분류',
                target_weight: g.target_weight,
                target_amount: g.target_amount,
                goal_id: g.id,
              });
            }
          }
        });

        setManualClients(result.data.manualClients || []);

        if (displayOrder.ready) {
          applyBranchGroups(buildBranchGroups(clientMap, displayOrder));
        }
      }
    } catch (error) {
      console.error('Failed to fetch bulk goal data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addClientToGrid = useCallback((client: ClientSearchResult & { is_manual?: boolean }) => {
    const clientMap = new Map<string, ClientGoalData>();
    branches.forEach(branch => {
      branch.teams.forEach(team => {
        team.employees.forEach(emp => {
          emp.clients.forEach(c => clientMap.set(c.client_code, { ...c }));
        });
      });
    });

    upsertClientEntry(clientMap, {
      client_code: client.client_code,
      client_name: client.client_name || client.client_code,
      employee_name: client.employee_name || '미분류',
      branch: client.branch || '미분류',
      team: client.team || '미분류',
      industry_code: client.industry_code,
      industry_name: client.industry_name,
      region_code: client.region_code,
      last_year_weight: 0,
      last_year_amount: 0,
      target_weight: client.target_weight,
      target_amount: client.target_amount,
      is_manual: true,
    });

    if (displayOrder.ready) {
      applyBranchGroups(buildBranchGroups(clientMap, displayOrder));
    }
  }, [applyBranchGroups, branches, displayOrder]);

  const handleCreateClientForGoals = async () => {
    const clientCode = newClientCodeRef.current.trim();
    const clientName = newClientNameRef.current.trim();
    const targetWeight = Number(newClientForm.target_weight || 0);
    const targetAmount = Number(newClientForm.target_amount || 0);

    if (!clientCode || !clientName || !newClientForm.employee_code) {
      setMessage({ type: 'error', text: '거래처코드, 거래처명, 담당자를 입력해주세요.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setIsAssigning(true);
    try {
      const response = await apiFetch('/api/dashboard/closing-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_goal_client',
          year,
          month: selectedMonth,
          client: {
            client_code: clientCode,
            client_name: clientName,
            industry_code: newClientForm.industry_code || undefined,
            employee_code: newClientForm.employee_code,
            new_client_date: newClientForm.new_client_date || todayIsoDate(),
            region_code: newClientForm.region_code.trim() || undefined,
            target_weight: Number.isFinite(targetWeight) ? targetWeight : 0,
            target_amount: Number.isFinite(targetAmount) ? targetAmount : 0,
          },
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create client');
      }

      const client = result.data.client;
      newClientCodeRef.current = '';
      newClientNameRef.current = '';
      setNewClientTextResetKey(key => key + 1);
      setNewClientForm(emptyNewClientForm());
      setEmployeeOptionSearch('');
      setCompanyTypeOptionSearch('');
      setRegionOptionSearch('');
      setClientSearch('');
      setMessage({ type: 'success', text: `${client.client_name} 거래처가 생성되어 목표 목록에 추가되었습니다.` });
      setTimeout(() => setMessage(null), 3000);
      await fetchBulkGoalData();
    } catch (error) {
      console.error('Failed to create client:', error);
      const text = error instanceof Error && error.message.includes('already exists')
        ? '이미 존재하는 거래처코드입니다.'
        : '신규 거래처 생성 중 오류가 발생했습니다.';
      setMessage({ type: 'error', text });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteClient = async (clientCode: string) => {
    if (!confirm(`거래처 코드 [${clientCode}]를 삭제하시겠습니까? 등록된 해당 거래처의 목표 데이터도 모두 삭제됩니다.`)) {
      return;
    }

    try {
      const response = await apiFetch('/api/dashboard/closing-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_goal_client',
          client_code: clientCode,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: '신규 거래처가 성공적으로 삭제되었습니다.' });
        setTimeout(() => setMessage(null), 3000);
        await fetchBulkGoalData();
      } else {
        throw new Error(result.error || '삭제 실패');
      }
    } catch (error) {
      console.error('Failed to delete manual client:', error);
      setMessage({ type: 'error', text: '거래처 삭제 중 오류가 발생했습니다.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const goalEditKey = (entry: Pick<ClientGoalData, 'client_code'>) =>
    `${entry.client_code}_${selectedMonth}`;

  const updateClientEntry = (
    branches: BranchGroup[],
    entry: ClientGoalData,
    patch: Partial<ClientGoalData>
  ): BranchGroup[] =>
    branches.map(branch => ({
      ...branch,
      teams: branch.teams.map(team => ({
        ...team,
        employees: team.employees.map(emp => ({
          ...emp,
          clients: emp.clients.map(client =>
            client.client_code === entry.client_code
              ? { ...client, ...patch }
              : client
          )
        }))
      }))
    }));

  const handleGoalChange = (entry: ClientGoalData, field: 'weight' | 'amount', value: number) => {
    const key = goalEditKey(entry);
    const current = editingGoals.get(key) || { weight: entry.target_weight || 0, amount: entry.target_amount || 0 };
    setEditingGoals(new Map(editingGoals.set(key, { ...current, [field]: value })));
    setBranches(prev =>
      updateClientEntry(prev, entry, {
        [field === 'weight' ? 'target_weight' : 'target_amount']: value
      })
    );
  };

  const handleSaveIndividual = async (entry: ClientGoalData) => {
    try {
      await saveClientGoal(entry);
      setMessage({ type: 'success', text: '목표가 저장되었습니다.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const saveClientGoal = async (entry: ClientGoalData) => {
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
          client_code: entry.client_code,
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
          team.employees.forEach(emp => {
            emp.clients.forEach(entry => {
              const key = goalEditKey(entry);
              const edited = editingGoals.get(key);
              const goalWeight = edited?.weight ?? entry.target_weight ?? 0;
              const goalAmount = edited?.amount ?? entry.target_amount ?? 0;

              if (goalWeight > 0 || goalAmount > 0) {
                allGoals.push({
                  year,
                  month: selectedMonth,
                  client_code: entry.client_code,
                  target_weight: goalWeight,
                  target_amount: goalAmount
                });
              }
            });
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
          employees: team.employees.map(emp => ({
            ...emp,
            clients: emp.clients.map(entry => {
              const key = goalEditKey(entry);
              const weight = entry.last_year_weight;
              const amount = entry.last_year_amount;
              newEditing.set(key, { weight, amount });
              return { ...entry, target_weight: weight, target_amount: amount };
            })
          }))
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
          employees: team.employees.map(emp => ({
            ...emp,
            clients: emp.clients.map(entry => {
              const key = goalEditKey(entry);
              const weight = Math.round(entry.last_year_weight * multiplier);
              const amount = Math.round(entry.last_year_amount * multiplier);
              newEditing.set(key, { weight, amount });
              return { ...entry, target_weight: weight, target_amount: amount };
            })
          }))
        }))
      }))
    );

    setEditingGoals(newEditing);
    setMessage({ type: 'success', text: `작년 대비 ${rate > 0 ? '+' : ''}${rate}% 성장 목표가 설정되었습니다. "전체 저장"을 눌러 확정하세요.` });
    setTimeout(() => setMessage(null), 3000);
  };

  const applyCustomGrowthRate = () => {
    const rate = parseFloat(customGrowthRate);
    if (Number.isNaN(rate)) {
      setMessage({ type: 'error', text: '성장률(%)을 숫자로 입력해주세요.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    applyGrowthRate(rate);
  };

  const handleCurrentDataDownload = () => {
    const exportData: Record<string, string | number>[] = [];

    branches.forEach((branch) => {
      branch.teams.forEach((team) => {
        team.employees.forEach((emp) => {
          emp.clients.forEach((entry) => {
            const key = goalEditKey(entry);
            const edited = editingGoals.get(key);
            exportData.push({
              '사업소': branch.branch,
              '팀': team.team,
              '담당자': emp.employee_name,
              '거래처코드': entry.client_code,
              '거래처명': entry.client_name,
              '작년중량(L)': entry.last_year_weight,
              '작년금액': entry.last_year_amount,
              '목표중량(L)': edited?.weight ?? entry.target_weight ?? 0,
              '목표금액': edited?.amount ?? entry.target_amount ?? 0,
            });
          });
        });
      });
    });

    if (exportData.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    exportToExcel(
      exportData,
      generateFilename(`${year}년_${selectedMonth}월_목표설정_현황`),
      { referenceDate: `${year}-${selectedMonth}` }
    );
  };

  const handleTemplateDownload = async () => {
    try {
      const wb = XLSX.utils.book_new();

      // Fetch year-round data for all 12 months
      const response = await apiFetch(
        withIncludeVat(`/api/dashboard/closing-meeting?tab=goal-setting&year=${year}`, includeVat)
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error('Failed to fetch data');
      }

      const clientMap = new Map<string, {
        client_code: string;
        client_name: string;
        employee_name: string;
        branch: string;
        team: string;
        monthlyData: { [month: string]: { last_year_weight: number; last_year_amount: number; target_weight?: number; target_amount?: number } };
      }>();

      result.data.clientActual?.forEach((a: any) => {
        const monthPart = a.month?.split('-')[1] || a.month;
        if (a.client_code) {
          if (!clientMap.has(a.client_code)) {
            clientMap.set(a.client_code, {
              client_code: a.client_code,
              client_name: a.client_name || a.client_code,
              employee_name: a.employee_name || '미분류',
              branch: a.branch || '미분류',
              team: a.team || '미분류',
              monthlyData: {}
            });
          }

          const entry = clientMap.get(a.client_code)!;
          if (!entry.monthlyData[monthPart]) {
            entry.monthlyData[monthPart] = { last_year_weight: 0, last_year_amount: 0 };
          }
          entry.monthlyData[monthPart].last_year_weight = a.weight || 0;
          entry.monthlyData[monthPart].last_year_amount = a.amount || 0;
        }
      });

      result.data.goals?.forEach((g: any) => {
        const monthPart = g.month?.split('-')[1] || g.month;
        const existing = clientMap.get(g.client_code);
        if (existing) {
          if (!existing.monthlyData[monthPart]) {
            existing.monthlyData[monthPart] = { last_year_weight: 0, last_year_amount: 0 };
          }
          existing.monthlyData[monthPart].target_weight = g.target_weight;
          existing.monthlyData[monthPart].target_amount = g.target_amount;
        }
      });

      const sheetData: any[] = [];
      const headerRow = ['사업소', '팀', '담당자', '거래처코드', '거래처명'];
      for (let m = 1; m <= 12; m++) {
        const month = m.toString().padStart(2, '0');
        headerRow.push(`${m}월 목표(중량L)`, `${m}월 목표(금액원)`);
      }
      sheetData.push(headerRow);

      // Data rows
      const sortedEntries = Array.from(clientMap.values()).sort((a, b) => {
        const br = compareOffices(a.branch, b.branch, displayOrder.office);
        if (br !== 0) return br;
        const tc = compareTeams(a.team, b.team, displayOrder.teamB2c, displayOrder.teamB2b);
        if (tc !== 0) return tc;
        const ec = compareEmployees(a.team, a.employee_name, b.employee_name, displayOrder.empB2c, displayOrder.empB2b);
        if (ec !== 0) return ec;
        return a.client_name.localeCompare(b.client_name);
      });

      sortedEntries.forEach(entry => {
        const row: (string | number)[] = [
          entry.branch,
          entry.team,
          entry.employee_name,
          entry.client_code,
          entry.client_name
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
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 14 },
        { wch: 20 }
      ];
      // Add column widths for 12 months x 2 columns each
      for (let m = 0; m < 12; m++) {
        colWidths.push({ wch: 15 }, { wch: 15 });
      }
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, '고객별 목표설정');
      XLSX.writeFile(wb, generateFilename(`${year}년_고객별_목표설정_템플릿`));

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
        // 5 base columns + 24 month columns = 29 minimum
        if (!row || row.length < 29) continue;

        const clientCode = String(row[3] || '').trim();
        if (!clientCode) continue;

        for (let m = 1; m <= 12; m++) {
          const month = m.toString().padStart(2, '0');
          const weightColIndex = 5 + (m - 1) * 2;
          const amountColIndex = 6 + (m - 1) * 2;
          const goalWeight = parseFloat(row[weightColIndex]) || 0;
          const goalAmount = parseFloat(row[amountColIndex]) || 0;

          if (goalWeight > 0 || goalAmount > 0) {
            const key = `${clientCode}_${month}`;
            newEditing.set(key, { weight: goalWeight, amount: goalAmount });
            updateCount++;
          }
        }
      }

      setEditingGoals(newEditing);

      if (selectedMonth) {
        setBranches(prevBranches =>
          prevBranches.map(branch => ({
            ...branch,
            teams: branch.teams.map(team => ({
              ...team,
              employees: team.employees.map(emp => ({
                ...emp,
                clients: emp.clients.map(client => {
                  const key = goalEditKey(client);
                  const uploaded = newEditing.get(key);
                  if (uploaded) {
                    return {
                      ...client,
                      target_weight: uploaded.weight,
                      target_amount: uploaded.amount
                    };
                  }
                  return client;
                })
              }))
            }))
          }))
        );
      }

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
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpandedTeams(newExpanded);
  };

  const toggleEmployee = (branch: string, team: string, employee: string) => {
    const key = `${branch}_${team}_${employee}`;
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpandedEmployees(newExpanded);
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

  const totalEntries = branches.reduce((sum, b) =>
    sum + b.teams.reduce((teamSum, t) =>
      teamSum + t.employees.reduce((empSum, e) => empSum + e.clients.length, 0), 0), 0
  );
  const totalLastYearWeight = branches.reduce((sum, b) => sum + b.total_last_year_weight, 0);
  const totalLastYearAmount = branches.reduce((sum, b) => sum + b.total_last_year_amount, 0);
  const visibleBranches = useMemo(
    () => filterBranchGroups(branches, deferredClientSearch),
    [branches, deferredClientSearch]
  );
  const visibleEntries = useMemo(
    () => visibleBranches.reduce((sum, b) =>
      sum + b.teams.reduce((teamSum, t) =>
        teamSum + t.employees.reduce((empSum, e) => empSum + e.clients.length, 0), 0), 0
    ),
    [visibleBranches]
  );
  const matchingEmployees = useMemo(() => employees.filter((emp) =>
    [
      emp.employee_code,
      emp.employee_name,
      emp.branch,
      emp.team,
    ].some((value) => matchesSearchText(value, deferredEmployeeOptionSearch))
  ), [employees, deferredEmployeeOptionSearch]);
  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.employee_code === newClientForm.employee_code),
    [employees, newClientForm.employee_code]
  );
  const filteredEmployees = useMemo(
    () => selectedEmployee && !matchingEmployees.some((emp) => emp.employee_code === selectedEmployee.employee_code)
      ? [selectedEmployee, ...matchingEmployees]
      : matchingEmployees,
    [matchingEmployees, selectedEmployee]
  );
  const matchingCompanyTypes = useMemo(() => companyTypes.filter((ct) =>
    [
      ct.code,
      ct.name,
      ct.industry,
      ct.sector,
    ].some((value) => matchesSearchText(value, deferredCompanyTypeOptionSearch))
  ), [companyTypes, deferredCompanyTypeOptionSearch]);
  const selectedCompanyType = useMemo(
    () => companyTypes.find((ct) => ct.code === newClientForm.industry_code),
    [companyTypes, newClientForm.industry_code]
  );
  const filteredCompanyTypes = useMemo(
    () => selectedCompanyType && !matchingCompanyTypes.some((ct) => ct.code === selectedCompanyType.code)
      ? [selectedCompanyType, ...matchingCompanyTypes]
      : matchingCompanyTypes,
    [matchingCompanyTypes, selectedCompanyType]
  );
  const employeePickerValue = useMemo(
    () => employeeOptionSearch || (selectedEmployee ? formatEmployeeOption(selectedEmployee) : ''),
    [employeeOptionSearch, selectedEmployee]
  );
  const companyTypePickerValue = useMemo(
    () => companyTypeOptionSearch || (selectedCompanyType ? formatCompanyTypeOption(selectedCompanyType) : ''),
    [companyTypeOptionSearch, selectedCompanyType]
  );
  const matchingRegionCodes = useMemo(() => regionCodes.filter((region) =>
    [
      region.code,
      region.province_name,
      region.city_name,
      region.category3,
      region.major_category,
      region.detail_name,
      region.note,
    ].some((value) => matchesSearchText(value, deferredRegionOptionSearch))
  ), [regionCodes, deferredRegionOptionSearch]);
  const selectedRegion = useMemo(
    () => regionCodes.find((region) => String(region.code) === String(newClientForm.region_code)),
    [regionCodes, newClientForm.region_code]
  );
  const filteredRegionCodes = useMemo(
    () => selectedRegion && !matchingRegionCodes.some((region) => String(region.code) === String(selectedRegion.code))
      ? [selectedRegion, ...matchingRegionCodes]
      : matchingRegionCodes,
    [matchingRegionCodes, selectedRegion]
  );
  const regionPickerValue = useMemo(
    () => regionOptionSearch || (selectedRegion ? formatRegionOption(selectedRegion) : ''),
    [regionOptionSearch, selectedRegion]
  );

  useEffect(() => {
    if (!deferredClientSearch.trim()) return;

    setExpandedBranches(prev => new Set([
      ...prev,
      ...visibleBranches.map(branch => branch.branch),
    ]));
    setExpandedTeams(prev => new Set([
      ...prev,
      ...visibleBranches.flatMap(branch => branch.teams.map(team => `${branch.branch}_${team.team}`)),
    ]));
    setExpandedEmployees(prev => new Set([
      ...prev,
      ...visibleBranches.flatMap(branch =>
        branch.teams.flatMap(team =>
          team.employees.map(employee => `${branch.branch}_${team.team}_${employee.employee_name}`)
        )
      ),
    ]));
  }, [deferredClientSearch, visibleBranches]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>데이터를 불러오는 중...</p>
      </div>
    );
  }

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

          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExcelDownloadButton
              label="현황 다운로드"
              onClick={handleCurrentDataDownload}
              disabled={branches.length === 0 || isLoading}
            />
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

        <div className="mt-4 relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="거래처명, 거래처코드, 담당자, 팀 검색..."
            className="w-full pl-9 pr-9 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {clientSearch && (
            <button
              type="button"
              onClick={() => setClientSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="검색어 지우기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {(isTableSearchPending || clientSearch.trim()) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {isTableSearchPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {isTableSearchPending
                ? '검색 중...'
                : `${visibleEntries}개 결과`}
            </span>
          </div>
        )}

        {/* Coverage Summary */}
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">총 항목수</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {deferredClientSearch.trim() ? `${visibleEntries} / ${totalEntries}개` : `${totalEntries}개`}
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

            <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg">
              <input
                type="number"
                step="0.1"
                value={customGrowthRate}
                onChange={(e) => setCustomGrowthRate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyCustomGrowthRate();
                }}
                placeholder="15"
                className="w-14 bg-transparent text-sm text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="사용자 지정 성장률"
              />
              <span className="text-xs text-zinc-500">%</span>
              <button
                type="button"
                onClick={applyCustomGrowthRate}
                className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
              >
                성장 적용
              </button>
            </div>

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

      {/* Add Client Panel */}
      <div className="relative overflow-visible bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setShowAddPanel(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">신규 거래처 생성</span>
          </div>
          {showAddPanel ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
        </button>

        {showAddPanel && (
          <div className="px-6 pb-6 border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-4">
            <p className="text-xs text-zinc-500">
              신규 거래처를 생성한 뒤 현재 월 목표 목록에 바로 추가합니다. 담당자 선택값으로 사업소와 팀이 결정됩니다.
            </p>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">거래처코드 *</span>
                  <input
                    key={`client-code-${newClientTextResetKey}`}
                    type="text"
                    defaultValue=""
                    onChange={(e) => {
                      newClientCodeRef.current = e.target.value;
                    }}
                    placeholder="예: NC00001"
                    className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">거래처명 *</span>
                  <input
                    key={`client-name-${newClientTextResetKey}`}
                    type="text"
                    defaultValue=""
                    onChange={(e) => {
                      newClientNameRef.current = e.target.value;
                    }}
                    placeholder="거래처명"
                    className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </label>

                <div
                  className="relative"
                  onBlur={() => setTimeout(() => setIsEmployeePickerOpen(false), 120)}
                >
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">담당자 *</span>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={employeePickerValue}
                      onFocus={() => setIsEmployeePickerOpen(true)}
                      onChange={(e) => {
                        setEmployeeOptionSearch(e.target.value);
                        setNewClientForm(prev => ({ ...prev, employee_code: '' }));
                        setIsEmployeePickerOpen(true);
                      }}
                      placeholder="담당자명, 코드, 사업소, 팀 검색..."
                      className="w-full rounded-full border border-zinc-300 bg-white py-2 pl-9 pr-9 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    {employeePickerValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewClientForm(prev => ({ ...prev, employee_code: '' }));
                          setEmployeeOptionSearch('');
                          setIsEmployeePickerOpen(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        aria-label="담당자 선택 지우기"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {isEmployeePickerOpen && (
                    <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-zinc-200 bg-white py-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                      {isLookupsLoading ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          불러오는 중...
                        </div>
                      ) : isEmployeeSearchPending ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          검색 중...
                        </div>
                      ) : filteredEmployees.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-zinc-500">검색 결과가 없습니다.</div>
                      ) : (
                        filteredEmployees.slice(0, 50).map((emp, index) => (
                          <button
                            key={`${emp.employee_code}-${emp.employee_name}-${index}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setNewClientForm(prev => ({ ...prev, employee_code: emp.employee_code }));
                              setEmployeeOptionSearch(formatEmployeeOption(emp));
                              setIsEmployeePickerOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          >
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              <HighlightMatch text={emp.employee_name} query={employeeOptionSearch} />
                            </div>
                            <div className="text-xs text-zinc-500">
                              <HighlightMatch text={[emp.employee_code, emp.branch, emp.team].filter(Boolean).join(' · ')} query={employeeOptionSearch} />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div
                  className="relative"
                  onBlur={() => setTimeout(() => setIsCompanyTypePickerOpen(false), 120)}
                >
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">업종분류코드</span>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={companyTypePickerValue}
                      onFocus={() => setIsCompanyTypePickerOpen(true)}
                      onChange={(e) => {
                        setCompanyTypeOptionSearch(e.target.value);
                        setNewClientForm(prev => ({ ...prev, industry_code: '' }));
                        setIsCompanyTypePickerOpen(true);
                      }}
                      placeholder="코드, 모빌분류, 산업분류 검색..."
                      className="w-full rounded-full border border-zinc-300 bg-white py-2 pl-9 pr-9 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    {companyTypePickerValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewClientForm(prev => ({ ...prev, industry_code: '' }));
                          setCompanyTypeOptionSearch('');
                          setIsCompanyTypePickerOpen(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        aria-label="업종분류 선택 지우기"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {isCompanyTypePickerOpen && (
                    <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-zinc-200 bg-white py-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                      {isLookupsLoading ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          불러오는 중...
                        </div>
                      ) : isCompanyTypeSearchPending ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          검색 중...
                        </div>
                      ) : filteredCompanyTypes.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-zinc-500">검색 결과가 없습니다.</div>
                      ) : (
                        filteredCompanyTypes.slice(0, 50).map((ct, index) => (
                          <button
                            key={`${ct.code}-${ct.name || ct.industry || '미분류'}-${index}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setNewClientForm(prev => ({ ...prev, industry_code: ct.code }));
                              setCompanyTypeOptionSearch(formatCompanyTypeOption(ct));
                              setIsCompanyTypePickerOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          >
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              <HighlightMatch text={ct.code} query={companyTypeOptionSearch} />
                              <span className="text-zinc-400"> - </span>
                              <HighlightMatch text={ct.name || ct.industry || '미분류'} query={companyTypeOptionSearch} />
                            </div>
                            <div className="text-xs text-zinc-500">
                              <HighlightMatch text={[ct.industry, ct.sector].filter(Boolean).join(' · ')} query={companyTypeOptionSearch} />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">신규일</span>
                  <input
                    type="date"
                    value={newClientForm.new_client_date}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, new_client_date: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900"
                  />
                </label>

                <div
                  className="relative"
                  onBlur={() => setTimeout(() => setIsRegionPickerOpen(false), 120)}
                >
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">지역코드</span>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={regionPickerValue}
                      onFocus={() => setIsRegionPickerOpen(true)}
                      onChange={(e) => {
                        setRegionOptionSearch(e.target.value);
                        setNewClientForm(prev => ({ ...prev, region_code: '' }));
                        setIsRegionPickerOpen(true);
                      }}
                      placeholder="지역코드, 시도명, 시군구명 검색..."
                      className="w-full rounded-full border border-zinc-300 bg-white py-2 pl-9 pr-9 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    {regionPickerValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewClientForm(prev => ({ ...prev, region_code: '' }));
                          setRegionOptionSearch('');
                          setIsRegionPickerOpen(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        aria-label="지역코드 선택 지우기"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {isRegionPickerOpen && (
                    <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-zinc-200 bg-white py-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                      {isLookupsLoading ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          불러오는 중...
                        </div>
                      ) : isRegionSearchPending ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          검색 중...
                        </div>
                      ) : filteredRegionCodes.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-zinc-500">검색 결과가 없습니다.</div>
                      ) : (
                        filteredRegionCodes.slice(0, 50).map((region, index) => (
                          <button
                            key={`${region.code}-${index}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setNewClientForm(prev => ({ ...prev, region_code: region.code }));
                              setRegionOptionSearch(formatRegionOption(region));
                              setIsRegionPickerOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          >
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              <HighlightMatch text={region.code} query={regionOptionSearch} />
                            </div>
                            <div className="text-xs text-zinc-500">
                              <HighlightMatch
                                text={[
                                  region.province_name,
                                  region.city_name,
                                  region.detail_name,
                                  region.major_category,
                                  region.category3,
                                ].filter(Boolean).join(' · ')}
                                query={regionOptionSearch}
                              />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">목표 중량(L)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={newClientForm.target_weight}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, target_weight: e.target.value }))}
                    placeholder="0"
                    className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-right focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">목표 금액(원)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={newClientForm.target_amount}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, target_amount: e.target.value }))}
                    placeholder="0"
                    className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-right focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    newClientCodeRef.current = '';
                    newClientNameRef.current = '';
                    setNewClientTextResetKey(key => key + 1);
                    setNewClientForm(emptyNewClientForm());
                    setEmployeeOptionSearch('');
                    setCompanyTypeOptionSearch('');
                    setRegionOptionSearch('');
                    setIsEmployeePickerOpen(false);
                    setIsCompanyTypePickerOpen(false);
                    setIsRegionPickerOpen(false);
                  }}
                  className="px-3 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  초기화
                </button>
                <button
                  type="button"
                  onClick={handleCreateClientForGoals}
                  disabled={isAssigning || !newClientForm.employee_code}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  생성 후 목표 목록에 추가
                </button>
              </div>
            </div>

            {/* Registered Manual Clients List */}
            {manualClients.length > 0 && (
              <div className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-3">
                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">등록된 신규 거래처 목록</h4>
                <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/45 text-zinc-500 font-bold uppercase">
                      <tr>
                        <th className="py-2 px-3">거래처코드</th>
                        <th className="py-2 px-3">거래처명</th>
                        <th className="py-2 px-3">담당자</th>
                        <th className="py-2 px-3">사업소/팀</th>
                        <th className="py-2 px-3">업종</th>
                        <th className="py-2 px-3">지역</th>
                        <th className="py-2 px-3">신규일</th>
                        <th className="py-2 px-3 text-center">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {manualClients.map((client) => (
                        <tr key={client.client_code} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="py-2 px-3 font-mono font-medium">{client.client_code}</td>
                          <td className="py-2 px-3 font-medium">{client.client_name}</td>
                          <td className="py-2 px-3">{client.employee_name}</td>
                          <td className="py-2 px-3 text-zinc-500">{client.branch} / {client.team}</td>
                          <td className="py-2 px-3 text-zinc-500">{client.industry_name || client.industry_code || '-'}</td>
                          <td className="py-2 px-3 text-zinc-500">{client.region_code || '-'}</td>
                          <td className="py-2 px-3 text-zinc-500">{client.new_client_date || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteClient(client.client_code)}
                              className="px-2 py-1 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Branch/Team Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            고객별 목표 설정
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">고객당 월별 목표 1건입니다. 담당자·팀 목표는 자동 합산됩니다. 각 항목별로 즉시 저장하거나, 모두 입력 후 &quot;전체 저장&quot;을 누르세요.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
              <tr className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                <th className="py-2 px-1 text-left w-14 min-w-0">사업소</th>
                <th className="py-2 px-1 text-left w-14 min-w-0">팀</th>
                <th className="py-2 px-1 text-left w-16 min-w-0">담당자</th>
                <th className="py-2 px-1.5 text-left w-32 min-w-0">고객</th>
                <th className="py-2 px-2 text-right bg-zinc-100 dark:bg-zinc-800 w-[7.5rem]">작년 중량(L)</th>
                <th className="py-2 px-2 text-right bg-zinc-100 dark:bg-zinc-800 w-[7.5rem]">작년 금액(원)</th>
                <th className="py-2 px-2 text-right bg-blue-50 dark:bg-blue-900/20 w-[7rem]">목표 중량(L)</th>
                <th className="py-2 px-2 text-right bg-blue-50 dark:bg-blue-900/20 w-[7rem]">목표 금액(원)</th>
                <th className="py-2 px-1 text-center w-16">저장</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isTableSearchPending && (
                <tr>
                  <td colSpan={9} className="py-10 px-4 text-center">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      검색 중...
                    </div>
                  </td>
                </tr>
              )}

              {!isTableSearchPending && visibleBranches.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    검색 조건에 맞는 고객이 없습니다.
                  </td>
                </tr>
              )}

              {!isTableSearchPending && visibleBranches.map((branch) => {
                const isBranchExpanded = expandedBranches.has(branch.branch);
                const totalBranchEntries = branch.teams.reduce((sum, t) =>
                  sum + t.employees.reduce((es, e) => es + e.clients.length, 0), 0
                );

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
                          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 break-words">
                            <HighlightMatch text={branch.branch} query={deferredClientSearch} />
                          </span>
                          <span className="text-[10px] leading-tight font-normal text-zinc-500 shrink-0">({totalBranchEntries}개 항목)</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-1 w-14" />
                      <td className="py-1.5 px-1 w-16" />
                      <td className="py-1.5 px-1.5 w-32" />
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
                                <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200 break-words">
                                  <HighlightMatch text={team.team} query={deferredClientSearch} />
                                </span>
                                <span className="text-[10px] leading-tight text-zinc-500 shrink-0">({team.employees.reduce((s, e) => s + e.clients.length, 0)}개 항목)</span>
                              </div>
                            </td>
                            <td className="py-1.5 px-1 w-16" />
                            <td className="py-1.5 px-1.5 w-32" />
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

                          {isTeamExpanded && team.employees.map((emp) => {
                            const empKey = `${branch.branch}_${team.team}_${emp.employee_name}`;
                            const isEmpExpanded = expandedEmployees.has(empKey);

                            return (
                              <Fragment key={`emp-${empKey}`}>
                                <tr
                                  className="bg-amber-50/10 dark:bg-amber-900/5 hover:bg-amber-50/30 dark:hover:bg-amber-900/10 cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEmployee(branch.branch, team.team, emp.employee_name);
                                  }}
                                >
                                  <td className="py-1.5 px-1 w-14" />
                                  <td className="py-1.5 px-1 w-14" />
                                  <td className="py-1.5 px-1 w-16 min-w-0 align-middle">
                                    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0 pl-1">
                                      {isEmpExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-zinc-400" /> : <ChevronRight className="w-3 h-3 shrink-0 text-zinc-400" />}
                                      <span className="font-medium text-xs text-zinc-800 dark:text-zinc-200 break-words">
                                        <HighlightMatch text={emp.employee_name} query={deferredClientSearch} />
                                      </span>
                                      <span className="text-[10px] leading-tight text-zinc-500 shrink-0">({emp.clients.length}개)</span>
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-1.5 w-32" />
                                  <td className="py-1.5 px-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                    {formatNumber(emp.total_last_year_weight)}
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                    {formatNumber(emp.total_last_year_amount)}
                                  </td>
                                  <td className="py-1.5 px-2" />
                                  <td className="py-1.5 px-2" />
                                  <td className="py-1.5 px-2" />
                                </tr>

                                {isEmpExpanded && emp.clients.map((entry) => (
                                  <tr
                                    key={`client-${entry.client_code}`}
                                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                                  >
                                    <td className="py-1.5 px-1 w-14" />
                                    <td className="py-1.5 px-1 w-14" />
                                    <td className="py-1.5 px-1 w-16" />
                                    <td className="py-1.5 px-1.5 text-xs text-zinc-700 dark:text-zinc-300 min-w-0 break-words pl-2">
                                      <div className="font-medium flex items-center gap-1 flex-wrap">
                                        <HighlightMatch text={entry.client_name} query={deferredClientSearch} />
                                        {entry.is_manual && (
                                          <span
                                            title="일괄 목표 설정에서 수동 생성한 거래처입니다."
                                            className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
                                          >
                                            목표생성
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-zinc-400">
                                        <HighlightMatch text={entry.client_code} query={deferredClientSearch} />
                                        {entry.region_code && (
                                          <>
                                            <span> · </span>
                                            <HighlightMatch text={entry.region_code} query={deferredClientSearch} />
                                          </>
                                        )}
                                      </div>
                                      {entry.industry_name && (
                                        <div className="text-[10px] text-zinc-500">
                                          <HighlightMatch text={entry.industry_name} query={deferredClientSearch} />
                                        </div>
                                      )}
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
                                ))}
                              </Fragment>
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
          <li><strong>성장률 적용:</strong> % 입력 후 &quot;성장 적용&quot;으로 작년 대비 목표 일괄 설정 (음수 입력 시 감소)</li>
          <li><strong>템플릿 다운로드:</strong> 작년 실적이 포함된 Excel 파일 다운로드하여 오프라인 작업</li>
          <li><strong>목표 업로드:</strong> Excel에서 편집한 목표를 업로드하여 일괄 반영</li>
          <li><strong>개별 저장:</strong> 각 항목의 저장 버튼으로 즉시 저장 가능</li>
          <li><strong>전체 저장:</strong> 모든 변경사항을 한 번에 저장</li>
        </ul>
      </div>
    </div>
  );
}
