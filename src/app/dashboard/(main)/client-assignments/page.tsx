import { Metadata } from 'next';
import ClientAssignmentManager from '@/components/client-management/ClientAssignmentManager';
import { Users, Target, TrendingUp, RefreshCw } from 'lucide-react';

export const metadata: Metadata = {
  title: '고객 배정 관리 | 영일온씨',
  description: '담당자별 고객 배정을 확인하고 관리합니다',
};

export default function ClientAssignmentsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-[1800px] mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8" />
            <h1 className="text-3xl font-bold">고객 배정 관리</h1>
          </div>
          <p className="text-indigo-100">
            담당자별 고객 배정 현황을 확인하고, 고객을 재배정하여 목표 설정의 기반을 마련하세요
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">담당자 관리</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">고객 배정 현황</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <RefreshCw className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">유연한 조정</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">고객 재배정</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">실적 분석</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">매출 성장률</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">목표 기반</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">고객별 목표</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Component */}
        <ClientAssignmentManager />

        {/* Workflow Guide */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            목표 설정 워크플로우
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-purple-100 dark:border-purple-900">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                <p className="font-bold text-purple-600 dark:text-purple-400">고객 배정 확인</p>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                현재 담당자별로 어떤 고객이 배정되어 있는지 확인하고, 작년 매출 데이터를 검토합니다.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-purple-100 dark:border-purple-900">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                <p className="font-bold text-purple-600 dark:text-purple-400">고객 재배정</p>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                필요시 고객을 다른 담당자에게 재배정합니다. 재배정하면 목표도 자동으로 따라갑니다.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-purple-100 dark:border-purple-900">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                <p className="font-bold text-purple-600 dark:text-purple-400">목표 설정</p>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                고객별 목표를 설정하면, 담당자의 총 목표는 배정된 고객 목표의 합으로 자동 계산됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* Key Concepts */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">핵심 개념</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">동적 목표 계산</p>
                <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                  담당자 목표 = 배정된 고객들의 목표 합계. 고객이 이동하면 목표도 자동으로 재계산됩니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">고객 기반 추적</p>
                <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                  어떤 고객이 목표를 달성했는지, 성장률이 어떤지 개별적으로 추적할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">유연한 재배정</p>
                <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                  조직 개편, 담당 변경 등 언제든지 고객을 재배정할 수 있으며, 이력도 추적 가능합니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">실적 기반 목표</p>
                <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                  작년 실적을 기반으로 각 고객의 잠재력을 평가하고 현실적인 목표를 설정할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
