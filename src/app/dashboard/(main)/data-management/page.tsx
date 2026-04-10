"use client";

import { useState, useEffect } from 'react';
import { Database, Users, Building2, Package, Tags, MapPin, Settings, Loader2, Save, CheckCircle2, AlertCircle, X, Info, ArrowUp, ArrowDown, ListOrdered, GitCompare } from 'lucide-react';
import type { DisplayOrderReconcileReport } from '@/lib/display-order-reconcile';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { ExcelUploadButton } from '@/components/ExcelUploadButton';
import { generateFilename } from '@/lib/excel-export';
import * as XLSX from 'xlsx';

interface StagedDiff {
  type: 'new' | 'modified' | 'unchanged' | 'deleted';
  data: Record<string, any>;
  originalData?: Record<string, any>;
  changes?: string[];
}

const baselineTables = [
  {
    id: 'items',
    label: '품목 (Items)',
    icon: Package,
    description: '제품 마스터 데이터 - 품목코드, 품목그룹, 품목명 등',
    rowCount: '~3,317',
    keyColumns: ['품목코드', '품목그룹1코드', '품목그룹2코드', '품목그룹3코드', '품목명'],
  },
  {
    id: 'clients',
    label: '거래처 (Clients)',
    icon: Building2,
    description: '거래처 마스터 - 사업소, 담당자, 업종분류 등 포함',
    rowCount: '~10,755',
    keyColumns: ['거래처코드', '거래처명', '사업소', '담당자명', '업종분류코드', '모빌분류', '산업분류', '영일분류', '오토_대분류', '모빌_대시보드채널'],
  },
  {
    id: 'employees',
    label: '사원 (Employees)',
    icon: Users,
    description: '사원 마스터 - 사원 코드 및 명 (팀·사업소 배정은 사원분류에서 관리)',
    rowCount: '~65',
    keyColumns: ['사원_담당_코드', '사원_담당_명'],
  },
  {
    id: 'employee_category',
    label: '사원분류 (Employee Category)',
    icon: Users,
    description: '사원 카테고리 - B2B/B2C팀, 사업소 배정',
    rowCount: '~47',
    keyColumns: ['사원코드', '담당자', 'b2b팀', 'b2b사업소', 'b2c_팀', '전체사업소'],
  },
  {
    id: 'warehouses',
    label: '창고 (Warehouses)',
    icon: Building2,
    description: '창고 마스터 - 창고코드, 창고명',
    rowCount: '~25',
    keyColumns: ['창고코드', '창고명'],
  },
  {
    id: 'company_type',
    label: '업종분류 (Company Type)',
    icon: Tags,
    description: '업종 분류 정의 - 모빌분류, 산업분류, 섹터분류',
    rowCount: '~116',
    keyColumns: ['업종분류코드', '모빌분류', '산업분류', '섹터분류', '영일분류'],
  },
  {
    id: 'company_type_auto',
    label: 'AUTO 업종분류 (AUTO Classification)',
    icon: Tags,
    description: 'AUTO 채널 분류 - 대시보드채널, 거래처그룹',
    rowCount: '~35',
    keyColumns: ['업종분류코드', '오토_대분류', '모빌_대시보드채널', '거래처그룹2'],
  },
  {
    id: 'office_display_order',
    label: '사업소 노출 순서',
    icon: MapPin,
    description: '대시보드 내 사업소 표시 순서 관리 테이블',
    rowCount: 'new',
    keyColumns: ['사업소'],
  },
  {
    id: 'display_order_b2c',
    label: 'B2C 팀·사원 노출 순서',
    icon: ListOrdered,
    description: 'b2c_팀 및 팀 내 담당자 표시 순서 (사원분류 기준)',
    rowCount: '—',
    keyColumns: ['scope', '팀', '담당자'],
  },
  {
    id: 'display_order_b2b',
    label: 'B2B 팀·사원 노출 순서',
    icon: ListOrdered,
    description: 'b2b팀 및 팀 내 담당자 표시 순서 (사원분류 기준)',
    rowCount: '—',
    keyColumns: ['scope', '팀', '담당자'],
  },
  {
    id: 'display_order_reconcile',
    label: '노출순서 정합 점검',
    icon: GitCompare,
    description: '사원분류 vs 노출순서 테이블 — 누락·고아 항목',
    rowCount: '—',
    keyColumns: ['missing', 'orphan'],
  },
];

export default function DataManagementPage() {
  const [activeTable, setActiveTable] = useState(baselineTables[0].id);
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [stagedDiffs, setStagedDiffs] = useState<StagedDiff[] | null>(null);
  const isOfficeDisplayOrderTable = activeTable === 'office_display_order';
  const isChannelDisplayOrderTable =
    activeTable === 'display_order_b2c' || activeTable === 'display_order_b2b';
  const isReconcileTable = activeTable === 'display_order_reconcile';

  const [reconcileReport, setReconcileReport] = useState<DisplayOrderReconcileReport | null>(null);
  const [channelTeams, setChannelTeams] = useState<Array<{ 팀: string; 노출순서: number }>>([]);
  const [channelEmployeesByTeam, setChannelEmployeesByTeam] = useState<
    Record<string, Array<{ 담당자: string; 팀내_노출순서: number }>>
  >({});
  const [selectedChannelTeam, setSelectedChannelTeam] = useState<string>('');

  useEffect(() => {
    cancelStaging();
    fetchTableData();
  }, [activeTable]);

  const fetchTableData = async () => {
    setIsLoading(true);
    try {
      if (activeTable === 'display_order_reconcile') {
        const response = await apiFetch('/api/dashboard/display-order/reconcile');
        const result = await response.json();
        if (result.success && result.data) {
          setReconcileReport(result.data as DisplayOrderReconcileReport);
        } else {
          setReconcileReport(null);
          setMessage({ type: 'error', text: result.error || '정합 점검을 불러오지 못했습니다.' });
        }
        setTableData([]);
        return;
      }
      setReconcileReport(null);

      if (activeTable === 'display_order_b2c' || activeTable === 'display_order_b2b') {
        const scope = activeTable === 'display_order_b2c' ? 'b2c' : 'b2b';
        const response = await apiFetch(`/api/dashboard/display-order?scope=${scope}`);
        const result = await response.json();
        if (result.success) {
          const teams = (result.teams || []) as Array<{ 팀: string; 노출순서: number }>;
          const byTeam = (result.employeesByTeam || {}) as Record<
            string,
            Array<{ 담당자: string; 팀내_노출순서: number }>
          >;
          setChannelTeams(teams);
          setChannelEmployeesByTeam(byTeam);
          setSelectedChannelTeam((prev) => {
            if (prev && byTeam[prev]) return prev;
            return teams[0]?.팀 ?? '';
          });
        }
        setTableData([]);
      } else {
        const response = await apiFetch(`/api/dashboard/data-management?table=${activeTable}`);
        const result = await response.json();
        if (result.success) {
          if (activeTable === 'office_display_order') {
            const sorted = [...(result.data || [])].sort((a, b) => Number(a?.노출순서 ?? 0) - Number(b?.노출순서 ?? 0));
            setTableData(sorted);
          } else {
            setTableData(result.data);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch table data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelStaging = () => {
    setStagedDiffs(null);
  };

  const activeTableInfo = baselineTables.find(t => t.id === activeTable);
  const getVisibleColumns = (row?: Record<string, any>) =>
    Object.keys(row || {}).filter((key) => key !== 'id');

  const handleDownload = async () => {
    if (tableData.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(tableData);
    XLSX.utils.book_append_sheet(wb, ws, activeTableInfo?.label.substring(0, 31) || activeTable);
    
    XLSX.writeFile(wb, generateFilename(`${activeTableInfo?.label || activeTable}_데이터`));
  };

  const handleUpload = async (uploadedData: any[]) => {
    if (uploadedData.length === 0) return;

    // Use the first sheet's data
    const sheet = uploadedData[0];
    const data = sheet.data; // This is a 2D array [row][col]
    
    if (data.length < 2) {
      setMessage({ type: 'error', text: '유효한 데이터를 찾을 수 없습니다.' });
      return;
    }

    const headers = data[0];
    const uploadedRows: Record<string, any>[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.length === 0) continue;
      
      const rowData: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        if (header) {
          rowData[header] = row[index];
        }
      });
      uploadedRows.push(rowData);
    }

    if (uploadedRows.length > 0) {
      // Calculate differences
      const diffs: StagedDiff[] = [];
      const pk = activeTableInfo?.keyColumns[0] || Object.keys(tableData[0] || {})[0];

      const currentDataMap = new Map(tableData.map(r => [String(r[pk]), r]));
      const uploadedDataMap = new Map(uploadedRows.map(r => [String(r[pk]), r]));

      uploadedRows.forEach(uRow => {
        const uPkValue = String(uRow[pk]);
        const existingRow = currentDataMap.get(uPkValue);

        if (!existingRow) {
          diffs.push({ type: 'new', data: uRow });
        } else {
          const changes: string[] = [];
          Object.keys(uRow).forEach(key => {
            if (uRow[key] !== undefined && String(uRow[key]) !== String(existingRow[key])) {
              changes.push(key);
            }
          });

          if (changes.length > 0) {
            diffs.push({ type: 'modified', data: uRow, originalData: existingRow, changes });
          } else {
            diffs.push({ type: 'unchanged', data: uRow });
          }
        }
      });

      // Find rows in current table that are not in uploaded file (deleted)
      tableData.forEach(cRow => {
        const cPkValue = String(cRow[pk]);
        if (!uploadedDataMap.has(cPkValue)) {
          diffs.push({ type: 'deleted' as any, data: cRow });
        }
      });

      setStagedDiffs(diffs);
    }
  };

  const saveStagedData = async () => {
    if (!stagedDiffs) return;

    const rowsToSave = stagedDiffs
      .filter(d => d.type === 'new' || d.type === 'modified')
      .map(d => d.data);

    const rowsToDelete = stagedDiffs
      .filter(d => d.type === 'deleted')
      .map(d => d.data);

    if (rowsToSave.length === 0 && rowsToDelete.length === 0) {
      setMessage({ type: 'error', text: '저장할 변경 사항이 없습니다.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      // Save new/modified rows if any
      if (rowsToSave.length > 0) {
        const response = await apiFetch('/api/dashboard/data-management', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableName: activeTable, rows: rowsToSave }),
        });
        const result = await response.json();

        if (!result.success) {
          setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
          setIsSaving(false);
          setTimeout(() => setMessage(null), 3000);
          return;
        }
      }

      // Delete removed rows if any
      if (rowsToDelete.length > 0) {
        const pk = activeTableInfo?.keyColumns[0] || Object.keys(tableData[0] || {})[0];
        const deleteKey = activeTable === 'employee_category' && pk === '사원코드' ? '담당자' : pk;

        // Build deletion filters for each row using the primary key
        for (const row of rowsToDelete) {
          const pkValue = row[deleteKey];
          if (pkValue !== undefined && pkValue !== null) {
            const deleteResponse = await apiFetch('/api/dashboard/data-management', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tableName: activeTable,
                deletionFilter: { filters: { [deleteKey]: String(pkValue) } }
              }),
            });
            const deleteResult = await deleteResponse.json();

            if (!deleteResult.success) {
              setMessage({ type: 'error', text: '삭제 중 오류가 발생했습니다.' });
              setIsSaving(false);
              setTimeout(() => setMessage(null), 3000);
              return;
            }
          }
        }
      }

      const totalChanges = rowsToSave.length + rowsToDelete.length;
      setMessage({ type: 'success', text: `${totalChanges}개의 데이터가 성공적으로 반영되었습니다.` });
      setStagedDiffs(null);
      fetchTableData(); // Refresh data
    } catch (error) {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleMoveOfficeRow = async (index: number, direction: 'up' | 'down') => {
    if (!isOfficeDisplayOrderTable || isSaving || stagedDiffs || tableData.length === 0) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tableData.length) return;

    const reordered = [...tableData];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    const normalizedRows = reordered.map((row, idx) => ({
      ...row,
      노출순서: idx + 1,
    }));

    setTableData(normalizedRows);
    setIsSaving(true);
    setMessage(null);

    try {
      const rowsToSave = normalizedRows.map((row) => ({
        사업소: row.사업소,
        노출순서: row.노출순서,
      }));

      const response = await apiFetch('/api/dashboard/data-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: 'office_display_order', rows: rowsToSave }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '순서 저장 실패');
      }

      setMessage({ type: 'success', text: '노출 순서가 업데이트되었습니다.' });
    } catch (error) {
      setMessage({ type: 'error', text: '노출 순서 저장 중 오류가 발생했습니다.' });
      await fetchTableData();
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const channelScope = activeTable === 'display_order_b2b' ? 'b2b' : 'b2c';

  const handleMoveChannelTeam = async (index: number, direction: 'up' | 'down') => {
    if (!isChannelDisplayOrderTable || isSaving || channelTeams.length === 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= channelTeams.length) return;
    const next = [...channelTeams];
    [next[index], next[target]] = [next[target], next[index]];
    const normalized = next.map((row, idx) => ({ ...row, 노출순서: idx + 1 }));
    setChannelTeams(normalized);
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch('/api/dashboard/display-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replaceTeams',
          scope: channelScope,
          rows: normalized.map((r) => ({ 팀: r.팀, 노출순서: r.노출순서 })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '저장 실패');
      setMessage({ type: 'success', text: '팀 노출 순서가 저장되었습니다.' });
    } catch {
      setMessage({ type: 'error', text: '팀 순서 저장 중 오류가 발생했습니다.' });
      fetchTableData();
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleMoveChannelEmployee = async (index: number, direction: 'up' | 'down') => {
    if (!isChannelDisplayOrderTable || isSaving || !selectedChannelTeam) return;
    const list = [...(channelEmployeesByTeam[selectedChannelTeam] || [])].sort(
      (a, b) => a.팀내_노출순서 - b.팀내_노출순서
    );
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const normalized = list.map((row, idx) => ({ ...row, 팀내_노출순서: idx + 1 }));
    setChannelEmployeesByTeam((prev) => ({
      ...prev,
      [selectedChannelTeam]: normalized,
    }));
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch('/api/dashboard/display-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replaceTeamEmployees',
          scope: channelScope,
          팀: selectedChannelTeam,
          rows: normalized.map((r) => ({ 담당자: r.담당자, 팀내_노출순서: r.팀내_노출순서 })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '저장 실패');
      setMessage({ type: 'success', text: '사원 노출 순서가 저장되었습니다.' });
    } catch {
      setMessage({ type: 'error', text: '사원 순서 저장 중 오류가 발생했습니다.' });
      fetchTableData();
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              데이터 관리
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              기준 정보 테이블 조회 및 수정
            </p>
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
          {isSaving && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              저장 중...
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
              기준 정보 테이블 관리
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              이 페이지에서는 매출/구매 데이터 분석에 사용되는 기준 정보(거래처, 품목, 사원, 업종분류 등)를 조회하고 수정할 수 있습니다.
              변경 사항은 모든 대시보드 및 보고서에 즉시 반영됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* Table Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
        {baselineTables.map((table) => {
          const Icon = table.icon;
          const isActive = activeTable === table.id;

          return (
            <button
              key={table.id}
              onClick={() => setActiveTable(table.id)}
              className={`
                p-2.5 rounded-lg border transition-all text-left
                ${isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-500/20'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-700'
                }
              `}
            >
              <div className="flex items-start gap-2">
                <div className={`p-1.5 rounded-md shrink-0 ${isActive ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-xs font-semibold leading-tight mb-0.5 ${isActive ? 'text-blue-900 dark:text-blue-100' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {table.label}
                  </h3>
                  <p className={`text-[11px] leading-snug line-clamp-2 mb-1 ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {table.description}
                  </p>
                  <div className={`text-[10px] font-medium tabular-nums ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                    {table.rowCount} rows
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Table Details */}
      {activeTableInfo && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm w-full min-w-0 max-w-full">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {activeTableInfo.label}
                </h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {activeTableInfo.description}
                </p>
              </div>
              {!isChannelDisplayOrderTable && !isReconcileTable && (
                <div className="flex items-center gap-2">
                  <ExcelDownloadButton
                    label="내보내기"
                    onClick={handleDownload}
                    variant="secondary"
                  />
                  <ExcelUploadButton label="가져오기" onUpload={handleUpload} />
                </div>
              )}
            </div>
          </div>

          {/* Key Columns Info */}
          {!isReconcileTable && (
            <div className="px-6 py-4 bg-zinc-50/30 dark:bg-zinc-800/20 border-b border-zinc-200 dark:border-zinc-800">
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
                주요 컬럼
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeTableInfo.keyColumns.map((col) => (
                  <span
                    key={col}
                    className="px-2 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[11px] font-mono text-zinc-600 dark:text-zinc-400"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
          {isReconcileTable && (
            <div className="px-6 py-4 bg-amber-50/40 dark:bg-amber-950/15 border-b border-amber-200/80 dark:border-amber-900/50">
              <p className="text-sm text-amber-900 dark:text-amber-200/90 leading-relaxed">
                사원분류(<code className="text-xs bg-amber-100/80 dark:bg-amber-900/40 px-1 rounded">전체사업소</code>,{' '}
                <code className="text-xs bg-amber-100/80 dark:bg-amber-900/40 px-1 rounded">b2c_팀</code>,{' '}
                <code className="text-xs bg-amber-100/80 dark:bg-amber-900/40 px-1 rounded">b2b팀</code>)과 노출순서 테이블을 비교합니다.
                <strong className="font-semibold"> 누락</strong>은 EC에는 있으나 노출순서에 없는 키(또는 정규화 후 매칭 불가),
                <strong className="font-semibold"> 고아</strong>는 노출순서에만 남은 키입니다. 사업소는 대시보드와 동일하게 정규화합니다.
              </p>
            </div>
          )}

          {/* Table Content */}
          <div className="overflow-x-auto min-h-[400px] w-full max-w-full">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>데이터를 불러오는 중...</p>
              </div>
            ) : stagedDiffs ? (
              <div className="flex flex-col h-full">
                <div className="bg-amber-50 dark:bg-amber-900/10 px-6 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                    <Info className="w-4 h-4" />
                    <span className="text-sm font-bold">변경 사항 확인</span>
                    <span className="text-xs ml-2">
                      신규: {stagedDiffs.filter(d => d.type === 'new').length} |
                      수정: {stagedDiffs.filter(d => d.type === 'modified').length} |
                      삭제: {stagedDiffs.filter(d => d.type === 'deleted').length} |
                      동일: {stagedDiffs.filter(d => d.type === 'unchanged').length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelStaging}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      취소
                    </button>
                    <button
                      onClick={saveStagedData}
                      disabled={isSaving || (stagedDiffs.filter(d => d.type === 'new' || d.type === 'modified' || d.type === 'deleted').length === 0)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      변경 사항 저장
                    </button>
                  </div>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3 font-bold text-zinc-600 dark:text-zinc-400 w-16">상태</th>
                      {getVisibleColumns(stagedDiffs[0].data).map(key => (
                        <th key={key} className="px-4 py-3 font-bold text-zinc-600 dark:text-zinc-400">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {stagedDiffs.map((diff, idx) => (
                      <tr key={idx} className={`
                        ${diff.type === 'new' ? 'bg-green-50/50 dark:bg-green-900/10' : ''}
                        ${diff.type === 'modified' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                        ${diff.type === 'deleted' ? 'bg-red-50/50 dark:bg-red-900/10 opacity-75' : ''}
                        ${diff.type === 'unchanged' ? 'opacity-60' : ''}
                        hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors
                      `}>
                        <td className="px-4 py-2.5 font-bold">
                          {diff.type === 'new' && <span className="text-green-600 dark:text-green-400">신규</span>}
                          {diff.type === 'modified' && <span className="text-blue-600 dark:text-blue-400">수정</span>}
                          {diff.type === 'deleted' && <span className="text-red-600 dark:text-red-400">삭제</span>}
                          {diff.type === 'unchanged' && <span className="text-zinc-400">-</span>}
                        </td>
                        {Object.entries(diff.data)
                          .filter(([key]) => key !== 'id')
                          .map(([key, val], i) => {
                          const isChanged = diff.type === 'modified' && diff.changes?.includes(key);
                          return (
                            <td key={i} className={`px-4 py-2.5 whitespace-nowrap ${isChanged ? 'font-bold text-blue-700 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                              <div className="flex flex-col">
                                {isChanged && (
                                  <span className="text-[10px] text-zinc-400 line-through mb-0.5">
                                    {diff.originalData?.[key] || '-'}
                                  </span>
                                )}
                                <span>{val?.toString() || '-'}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : isReconcileTable ? (
              <div className="p-6 space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-zinc-500">
                    {reconcileReport
                      ? `생성: ${new Date(reconcileReport.generatedAt).toLocaleString('ko-KR')}`
                      : '점검 데이터를 불러오는 중이거나 오류가 났습니다.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchTableData()}
                    disabled={isLoading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    다시 불러오기
                  </button>
                </div>
                {reconcileReport && (
                  <>
                    {(() => {
                      const o = reconcileReport.offices;
                      const c = reconcileReport.b2c;
                      const b = reconcileReport.b2b;
                      const issueCount =
                        o.missingInDisplayOrder.length +
                        o.orphanInDisplayOrder.length +
                        c.teams.missing.length +
                        c.teams.orphan.length +
                        c.employees.missing.length +
                        c.employees.orphan.length +
                        b.teams.missing.length +
                        b.teams.orphan.length +
                        b.employees.missing.length +
                        b.employees.orphan.length;
                      return issueCount === 0 ? (
                        <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50/80 dark:bg-green-950/20 px-4 py-3 text-sm text-green-800 dark:text-green-200">
                          <CheckCircle2 className="w-5 h-5 shrink-0" />
                          정합 이슈 없음 — 사원분류와 노출순서 키가 일치합니다.
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                          <AlertCircle className="w-5 h-5 shrink-0" />
                          총 <strong>{issueCount}</strong>건의 누락·고아 항목이 있습니다. 아래를 참고해 사업소 테이블을 추가하거나,{' '}
                          <code className="text-xs bg-amber-100/80 dark:bg-amber-900/40 px-1 rounded">npm run seed-display-order</code> 등으로 누락 행을 채울 수 있습니다.
                        </div>
                      );
                    })()}
                    <div className="grid gap-6 lg:grid-cols-1">
                      <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        <h5 className="text-sm font-bold px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                          사업소 (office_display_order)
                        </h5>
                        <div className="p-4 grid md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-semibold text-red-700 dark:text-red-300 mb-2">
                              누락 ({reconcileReport.offices.missingInDisplayOrder.length})
                            </p>
                            <ul className="max-h-40 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700 p-2 font-mono space-y-0.5">
                              {reconcileReport.offices.missingInDisplayOrder.length === 0 ? (
                                <li className="text-zinc-400">—</li>
                              ) : (
                                reconcileReport.offices.missingInDisplayOrder.map((x) => (
                                  <li key={x}>{x}</li>
                                ))
                              )}
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                              고아 ({reconcileReport.offices.orphanInDisplayOrder.length})
                            </p>
                            <ul className="max-h-40 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700 p-2 font-mono space-y-0.5">
                              {reconcileReport.offices.orphanInDisplayOrder.length === 0 ? (
                                <li className="text-zinc-400">—</li>
                              ) : (
                                reconcileReport.offices.orphanInDisplayOrder.map((x) => (
                                  <li key={x}>{x}</li>
                                ))
                              )}
                            </ul>
                          </div>
                        </div>
                      </section>
                      {(['b2c', 'b2b'] as const).map((scope) => {
                        const block = scope === 'b2c' ? reconcileReport.b2c : reconcileReport.b2b;
                        const label = scope === 'b2c' ? 'B2C (b2c_팀)' : 'B2B (b2b팀)';
                        return (
                          <section key={scope} className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                            <h5 className="text-sm font-bold px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                              팀·사원 — {label}
                            </h5>
                            <div className="p-4 grid md:grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="font-semibold text-red-700 dark:text-red-300 mb-2">
                                  팀 누락 ({block.teams.missing.length})
                                </p>
                                <ul className="max-h-28 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700 p-2 font-mono">
                                  {block.teams.missing.length === 0 ? (
                                    <li className="text-zinc-400">—</li>
                                  ) : (
                                    block.teams.missing.map((t) => <li key={t}>{t}</li>)
                                  )}
                                </ul>
                                <p className="font-semibold text-red-700 dark:text-red-300 mt-4 mb-2">
                                  사원 누락 ({block.employees.missing.length})
                                </p>
                                <ul className="max-h-36 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700 p-2 font-mono space-y-0.5">
                                  {block.employees.missing.length === 0 ? (
                                    <li className="text-zinc-400">—</li>
                                  ) : (
                                    block.employees.missing.map((r) => (
                                      <li key={`${r.팀}\t${r.담당자}`}>
                                        {r.팀} / {r.담당자}
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </div>
                              <div>
                                <p className="font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                                  팀 고아 ({block.teams.orphan.length})
                                </p>
                                <ul className="max-h-28 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700 p-2 font-mono">
                                  {block.teams.orphan.length === 0 ? (
                                    <li className="text-zinc-400">—</li>
                                  ) : (
                                    block.teams.orphan.map((t) => <li key={t}>{t}</li>)
                                  )}
                                </ul>
                                <p className="font-semibold text-zinc-600 dark:text-zinc-400 mt-4 mb-2">
                                  사원 고아 ({block.employees.orphan.length})
                                </p>
                                <ul className="max-h-36 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700 p-2 font-mono space-y-0.5">
                                  {block.employees.orphan.length === 0 ? (
                                    <li className="text-zinc-400">—</li>
                                  ) : (
                                    block.employees.orphan.map((r) => (
                                      <li key={`${r.팀}\t${r.담당자}`}>
                                        {r.팀} / {r.담당자}
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </div>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : isChannelDisplayOrderTable ? (
              <div className="p-6 space-y-8">
                <div>
                  <h5 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-3">팀 노출 순서</h5>
                  {channelTeams.length === 0 ? (
                    <p className="text-sm text-zinc-500">사원분류에 해당 채널 팀 데이터가 없습니다.</p>
                  ) : (
                    <table className="w-full text-xs text-left border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                      <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                        <tr>
                          <th className="px-4 py-2 font-bold text-zinc-600 dark:text-zinc-400">노출순서</th>
                          <th className="px-4 py-2 font-bold text-zinc-600 dark:text-zinc-400">팀</th>
                          <th className="px-4 py-2 w-36">순서 이동</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {channelTeams.map((row, idx) => (
                          <tr key={row.팀}>
                            <td className="px-4 py-2 font-semibold">{row.노출순서}</td>
                            <td className="px-4 py-2">{row.팀}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveChannelTeam(idx, 'up')}
                                  disabled={isSaving || idx === 0}
                                  className="inline-flex items-center justify-center p-1.5 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
                                  title="위로"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveChannelTeam(idx, 'down')}
                                  disabled={isSaving || idx === channelTeams.length - 1}
                                  className="inline-flex items-center justify-center p-1.5 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
                                  title="아래로"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <h5 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-3">팀 내 사원 순서</h5>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <label className="text-xs text-zinc-500">팀 선택</label>
                    <select
                      className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-800"
                      value={selectedChannelTeam}
                      onChange={(e) => setSelectedChannelTeam(e.target.value)}
                    >
                      {channelTeams.map((t) => (
                        <option key={t.팀} value={t.팀}>
                          {t.팀}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!selectedChannelTeam ? (
                    <p className="text-sm text-zinc-500">팀을 선택하세요.</p>
                  ) : (
                    <table className="w-full text-xs text-left border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                      <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                        <tr>
                          <th className="px-4 py-2 font-bold text-zinc-600 dark:text-zinc-400">팀내 순서</th>
                          <th className="px-4 py-2 font-bold text-zinc-600 dark:text-zinc-400">담당자</th>
                          <th className="px-4 py-2 w-36">순서 이동</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {([...(channelEmployeesByTeam[selectedChannelTeam] || [])].sort(
                          (a, b) => a.팀내_노출순서 - b.팀내_노출순서
                        )).map((row, idx, arr) => (
                          <tr key={row.담당자}>
                            <td className="px-4 py-2 font-semibold">{row.팀내_노출순서}</td>
                            <td className="px-4 py-2">{row.담당자}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveChannelEmployee(idx, 'up')}
                                  disabled={isSaving || idx === 0}
                                  className="inline-flex items-center justify-center p-1.5 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveChannelEmployee(idx, 'down')}
                                  disabled={isSaving || idx === arr.length - 1}
                                  className="inline-flex items-center justify-center p-1.5 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : tableData.length > 0 ? (
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    {isOfficeDisplayOrderTable ? (
                      <>
                        <th className="px-4 py-3 font-bold text-zinc-600 dark:text-zinc-400">노출순서</th>
                        <th className="px-4 py-3 font-bold text-zinc-600 dark:text-zinc-400">사업소</th>
                        <th className="px-4 py-3 font-bold text-zinc-600 dark:text-zinc-400 w-36">순서 이동</th>
                      </>
                    ) : (
                      getVisibleColumns(tableData[0]).map(key => (
                        <th key={key} className="px-4 py-3 font-bold text-zinc-600 dark:text-zinc-400">
                          {key}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {tableData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      {isOfficeDisplayOrderTable ? (
                        <>
                          <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap font-semibold">
                            {row?.노출순서 ?? '-'}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                            {row?.사업소?.toString() || '-'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleMoveOfficeRow(idx, 'up')}
                                disabled={isSaving || idx === 0}
                                className="inline-flex items-center justify-center p-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                                title="위로 이동"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveOfficeRow(idx, 'down')}
                                disabled={isSaving || idx === tableData.length - 1}
                                className="inline-flex items-center justify-center p-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                                title="아래로 이동"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        Object.entries(row)
                          .filter(([key]) => key !== 'id')
                          .map(([, val], i) => (
                          <td key={i} className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                            {val?.toString() || '-'}
                          </td>
                        ))
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
                <Database className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-1">데이터가 없습니다</p>
                <p className="text-sm">엑셀 가져오기를 통해 데이터를 추가해 보세요.</p>
              </div>
            )}
            {!isLoading && !isChannelDisplayOrderTable && !isReconcileTable && tableData.length > 50 && (
              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-800 text-center">
                <p className="text-xs text-zinc-500">
                  전체 {tableData.length.toLocaleString()}개 행 중 상위 50개만 표시됩니다. 전체 데이터는 내보내기를 통해 확인하세요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Future Features Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            📝 행 편집
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            테이블 행을 클릭하여 인라인 편집 또는 모달을 통한 상세 편집 (준비 중)
          </p>
        </div>
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            🔍 검색 및 필터
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            컬럼별 검색, 필터링, 정렬 기능으로 빠른 데이터 탐색 (준비 중)
          </p>
        </div>
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            💾 일괄 작업
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            엑셀 가져오기/내보내기를 통한 대량 데이터 관리 기능 활성화
          </p>
        </div>
      </div>
    </div>
  );
}
