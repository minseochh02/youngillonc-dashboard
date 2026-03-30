"use client";

import { useState, useEffect } from 'react';
import { Database, Users, Building2, Package, Tags, MapPin, Settings, Loader2, Save, CheckCircle2, AlertCircle, X, ArrowRight, Info } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { ExcelUploadButton } from '@/components/ExcelUploadButton';
import { generateFilename } from '@/lib/excel-export';
import * as XLSX from 'xlsx';

interface StagedDiff {
  type: 'new' | 'modified' | 'unchanged';
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
    description: '사원 마스터 - 팀 배정, 사업소 배정 정보 포함',
    rowCount: '~65',
    keyColumns: ['사원_담당_코드', '사원_담당_명', 'b2b팀', 'b2b사업소', 'b2c_팀', '전체사업소'],
  },
  {
    id: 'employee_category',
    label: '사원분류 (Employee Category)',
    icon: Users,
    description: '사원 카테고리 - B2B/B2C팀, 사업소 배정',
    rowCount: '~47',
    keyColumns: ['담당자', 'b2b팀', 'b2b사업소', 'b2c_팀', '전체사업소'],
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
];

export default function DataManagementPage() {
  const [activeTable, setActiveTable] = useState(baselineTables[0].id);
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [stagedDiffs, setStagedDiffs] = useState<StagedDiff[] | null>(null);

  useEffect(() => {
    cancelStaging();
    fetchTableData();
  }, [activeTable]);

  const fetchTableData = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/dashboard/data-management?table=${activeTable}`);
      const result = await response.json();
      if (result.success) {
        setTableData(result.data);
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

      setStagedDiffs(diffs);
    }
  };

  const saveStagedData = async () => {
    if (!stagedDiffs) return;

    const rowsToSave = stagedDiffs
      .filter(d => d.type === 'new' || d.type === 'modified')
      .map(d => d.data);

    if (rowsToSave.length === 0) {
      setMessage({ type: 'error', text: '저장할 변경 사항이 없습니다.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await apiFetch('/api/dashboard/data-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: activeTable, rows: rowsToSave }),
      });
      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: 'success', text: `${rowsToSave.length}개의 데이터가 성공적으로 반영되었습니다.` });
        setStagedDiffs(null);
        fetchTableData(); // Refresh data
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

  return (
    <div className="space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {baselineTables.map((table) => {
          const Icon = table.icon;
          const isActive = activeTable === table.id;

          return (
            <button
              key={table.id}
              onClick={() => setActiveTable(table.id)}
              className={`
                p-4 rounded-xl border-2 transition-all text-left
                ${isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-700'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold mb-1 ${isActive ? 'text-blue-900 dark:text-blue-100' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {table.label}
                  </h3>
                  <p className={`text-xs mb-2 ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {table.description}
                  </p>
                  <div className={`text-xs font-medium ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
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
              <div className="flex items-center gap-2">
                <ExcelDownloadButton 
                  label="내보내기" 
                  onClick={handleDownload}
                  variant="secondary"
                />
                <ExcelUploadButton 
                  label="가져오기"
                  onUpload={handleUpload}
                />
              </div>
            </div>
          </div>

          {/* Key Columns Info */}
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

          {/* Table Content */}
          <div className="overflow-x-auto min-h-[400px]">
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
                      disabled={isSaving || stagedDiffs.filter(d => d.type === 'new' || d.type === 'modified').length === 0}
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
                      {Object.keys(stagedDiffs[0].data).map(key => (
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
                        ${diff.type === 'unchanged' ? 'opacity-60' : ''}
                        hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors
                      `}>
                        <td className="px-4 py-2.5 font-bold">
                          {diff.type === 'new' && <span className="text-green-600 dark:text-green-400">신규</span>}
                          {diff.type === 'modified' && <span className="text-blue-600 dark:text-blue-400">수정</span>}
                          {diff.type === 'unchanged' && <span className="text-zinc-400">-</span>}
                        </td>
                        {Object.entries(diff.data).map(([key, val], i) => {
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
            ) : tableData.length > 0 ? (
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    {Object.keys(tableData[0]).map(key => (
                      <th key={key} className="px-4 py-3 font-bold text-zinc-600 dark:text-zinc-400">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {tableData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      {Object.values(row).map((val: any, i) => (
                        <td key={i} className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                          {val?.toString() || '-'}
                        </td>
                      ))}
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
            {!isLoading && tableData.length > 50 && (
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
