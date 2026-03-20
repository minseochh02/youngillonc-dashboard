"use client";

import { useState } from 'react';
import { Database, Users, Building2, Package, Tags, MapPin, Settings } from 'lucide-react';

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
    description: '거래처 마스터 - 거래처코드, 업종분류, 담당자, 지역 등',
    rowCount: '~10,755',
    keyColumns: ['거래처코드', '거래처명', '업종분류코드', '담당자코드', '지역코드'],
  },
  {
    id: 'employees',
    label: '사원 (Employees)',
    icon: Users,
    description: '사원 마스터 - 사원코드, 사원명',
    rowCount: '~65',
    keyColumns: ['사원_담당_코드', '사원_담당_명'],
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

  const activeTableInfo = baselineTables.find(t => t.id === activeTable);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {activeTableInfo.label}
                </h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {activeTableInfo.description}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                  새 항목 추가
                </button>
                <button className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">
                  가져오기
                </button>
                <button className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">
                  내보내기
                </button>
              </div>
            </div>
          </div>

          {/* Key Columns Info */}
          <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              주요 컬럼
            </p>
            <div className="flex flex-wrap gap-2">
              {activeTableInfo.keyColumns.map((col) => (
                <span
                  key={col}
                  className="px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-mono text-zinc-700 dark:text-zinc-300"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Table Content Placeholder */}
          <div className="p-8">
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <Database className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium mb-2">데이터 테이블 뷰</p>
              <p className="text-sm text-center max-w-md">
                여기에 {activeTableInfo.label} 테이블의 데이터가 표시됩니다.
                <br />
                행 편집, 추가, 삭제 기능이 구현될 예정입니다.
              </p>
            </div>
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
            테이블 행을 클릭하여 인라인 편집 또는 모달을 통한 상세 편집
          </p>
        </div>
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            🔍 검색 및 필터
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            컬럼별 검색, 필터링, 정렬 기능으로 빠른 데이터 탐색
          </p>
        </div>
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            💾 일괄 작업
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            CSV/Excel 가져오기/내보내기로 대량 데이터 관리
          </p>
        </div>
      </div>
    </div>
  );
}
