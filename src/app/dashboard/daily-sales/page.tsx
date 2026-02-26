export default function DailySalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          일일매출수금현황
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          매출 발생 내역 및 수금 현황을 분석합니다.
        </p>
      </div>

      <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4 text-zinc-400">
          💰
        </div>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">페이지 준비 중</h3>
        <p className="text-sm text-zinc-500 max-w-xs mt-2">
          매출 및 수금 데이터를 시각화하는 모듈을 통합하고 있습니다.
        </p>
      </div>
    </div>
  );
}
