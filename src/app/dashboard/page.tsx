export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          대시보드 개요
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          영일 ONC 시스템 현황 및 주요 지표를 확인하세요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder cards to show the layout */}
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">오늘의 주문</h3>
          <p className="text-2xl font-bold mt-2">124 건</p>
          <div className="mt-4 text-xs text-green-600 font-medium">
            ↑ 12% vs 어제
          </div>
        </div>
        
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">총 매출</h3>
          <p className="text-2xl font-bold mt-2">₩1,240,000</p>
          <div className="mt-4 text-xs text-green-600 font-medium">
            ↑ 8.2% vs 지난주
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">미수금</h3>
          <p className="text-2xl font-bold mt-2">₩450,000</p>
          <div className="mt-4 text-xs text-red-600 font-medium">
            ↓ 2.1% vs 전월
          </div>
        </div>
      </div>
      
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[300px] flex items-center justify-center">
        <p className="text-zinc-400 italic">차트 및 상세 지표 영역 (준비 중)</p>
      </div>
    </div>
  );
}
