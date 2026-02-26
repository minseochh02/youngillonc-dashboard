import DataLogicInfo from "./DataLogicInfo";

interface SalesRowData {
  id: string;
  branch: string;
  totalSales: number;
  mobileSalesAmount: number;
  mobileSalesWeight: number;
  flagshipSalesWeight: number;
  mobilePurchaseWeight: number;
  flagshipPurchaseWeight: number;
  isTotal?: boolean;
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return num.toLocaleString();
};

interface SalesTableProps {
  data: SalesRowData[];
}

export default function SalesTable({ data }: SalesTableProps) {
  // Use data from props, and calculate totals if not provided or to ensure accuracy
  const tableData = data && data.length > 0 ? data : [];
  const maxSales = Math.max(...tableData.filter(d => !d.isTotal).map(d => d.totalSales || 0), 1);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-200/20 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-separate border-spacing-0">
            <thead>
              {/* Primary Category Header */}
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                <th rowSpan={2} className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold">사업소</th>
                <th rowSpan={2} className="px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 font-bold min-w-[160px]">총매출액</th>
                <th colSpan={3} className="px-4 py-3 border-r border-b border-zinc-200 dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 font-semibold tracking-wide">모빌제품 매출액 및 중량</th>
                <th colSpan={2} className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 font-semibold tracking-wide">모빌제품 구매 중량</th>
              </tr>
              {/* Secondary Header (Sub-categories) */}
              <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800">매출액</th>
                <th className="px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800">판매 중량</th>
                <th className="px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800">플래그십</th>
                <th className="px-3 py-3 border-r border-b border-zinc-200 dark:border-zinc-800">구매 중량</th>
                <th className="px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">플래그십</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {tableData.map((row, idx) => (
                <tr 
                  key={row.id || idx} 
                  className={`
                    group transition-all duration-200
                    ${row.isTotal ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'}
                  `}
                >
                  <td className={`
                    sticky left-0 z-10 px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-sm font-bold
                    ${row.isTotal ? 'bg-blue-50/30 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40'}
                  `}>
                    {row.branch}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`tabular-nums font-bold ${row.isTotal ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {formatNumber(row.totalSales)}
                      </span>
                      {!row.isTotal && (
                        <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500/50 rounded-full" 
                            style={{ width: `${(row.totalSales / maxSales) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-600 dark:text-zinc-300">
                    {formatNumber(row.mobileSalesAmount)}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-600 dark:text-zinc-300">
                    {formatNumber(row.mobileSalesWeight)}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-500 dark:text-zinc-400">
                    {formatNumber(row.flagshipSalesWeight)}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-amber-600/80 dark:text-amber-400/80">
                    {formatNumber(row.mobilePurchaseWeight)}
                  </td>
                  <td className="px-4 py-4 tabular-nums text-right text-amber-500/70 dark:text-amber-500/50">
                    {formatNumber(row.flagshipPurchaseWeight)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DataLogicInfo 
        title="매출현황"
        description="판매 및 구매 현황 데이터를 기반으로 지사별 핵심 성과 지표를 실시간으로 추출합니다."
        steps={[
          "사업소 통합: '사업소', '지사' 명칭을 제거하고 '화성', '창원' 등 핵심 명칭으로 데이터를 자동 병합합니다.",
          "수치 정밀화: 데이터베이스 내 콤마(,)가 포함된 텍스트 수치를 실제 계산 가능한 숫자로 변환하여 오차 없는 합계를 산출합니다.",
          "Mobil 전용 필터: 품목 그룹 코드가 IL, PVL, MB, CVL, AVI, MAR인 핵심 모빌 브랜드 제품만 선별하여 집계합니다.",
          "플래그십 식별: 내부 관리 코드 'FLA'가 지정된 고부가가치 제품군의 중량을 별도로 분리하여 표시합니다."
        ]}
      />
    </div>
  );
}
