import { Metadata } from 'next';
import BulkGoalSettingTab from '@/components/closing-meeting/BulkGoalSettingTab';
import { Target, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '일괄 목표 설정 | 영일온씨',
  description: '팀별 매출 목표를 일괄 설정하고 관리합니다',
};

export default function BulkGoalSettingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/dashboard/closing-meeting"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Target className="w-8 h-8" />
            <h1 className="text-3xl font-bold">일괄 목표 설정</h1>
          </div>
          <p className="text-blue-100 ml-14">
            작년 실적을 참고하여 팀별 매출 목표를 빠르게 설정하세요
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">한눈에 보기</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">전체 팀 조회</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">빠른 설정</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">일괄 적용</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">작년 참조</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">실적 기반</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Excel 지원</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">다운/업로드</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Component */}
        <BulkGoalSettingTab />

        {/* Quick Guide */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            빠른 시작 가이드
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-indigo-100 dark:border-indigo-900">
              <p className="font-bold text-indigo-600 dark:text-indigo-400 mb-2">🎯 시나리오 1: 작년과 동일한 목표 설정</p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-2">
                <li>연도, 월, 유형(B2C/B2B) 선택</li>
                <li>"작년 실적 복사" 버튼 클릭</li>
                <li>"전체 저장" 클릭</li>
                <li>✅ 완료!</li>
              </ol>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-indigo-100 dark:border-indigo-900">
              <p className="font-bold text-purple-600 dark:text-purple-400 mb-2">📈 시나리오 2: 작년 대비 10% 성장 목표</p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-2">
                <li>연도, 월, 유형(B2C/B2B) 선택</li>
                <li>"+10% 성장" 버튼 클릭</li>
                <li>필요시 개별 팀 조정</li>
                <li>"전체 저장" 클릭</li>
              </ol>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-indigo-100 dark:border-indigo-900">
              <p className="font-bold text-green-600 dark:text-green-400 mb-2">📊 시나리오 3: Excel로 일괄 설정</p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-2">
                <li>"템플릿 다운로드" 클릭</li>
                <li>Excel에서 목표 수정</li>
                <li>"목표 업로드" 버튼으로 업로드</li>
                <li>"전체 저장" 클릭</li>
              </ol>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-indigo-100 dark:border-indigo-900">
              <p className="font-bold text-blue-600 dark:text-blue-400 mb-2">✏️ 시나리오 4: 팀별 개별 설정</p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-2">
                <li>사업소를 클릭하여 팀 목록 확인</li>
                <li>각 팀의 목표 중량/금액 입력</li>
                <li>팀별 저장 버튼 또는 전체 저장</li>
                <li>✅ 성장률 자동 계산!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
