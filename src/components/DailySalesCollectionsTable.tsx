import DataLogicInfo from "./DataLogicInfo";

interface DailyRowData {
  customer: string;
  prevBalance: number;
  salesAmount: number;
  collectionAmount: number;
  currentBalance: number;
  details?: {
    salesItems?: string;
    collectionMethod?: string;
  };
}

interface DailySalesCollectionsTableProps {
  data: DailyRowData[];
  divisionName: string;
}

const formatNumber = (num: number) => {
  if (num === 0) return "-";
  return num.toLocaleString();
};

export default function DailySalesCollectionsTable({ data, divisionName }: DailySalesCollectionsTableProps) {
  const totals = data.reduce((acc, curr) => ({
    prevBalance: acc.prevBalance + curr.prevBalance,
    salesAmount: acc.salesAmount + curr.salesAmount,
    collectionAmount: acc.collectionAmount + curr.collectionAmount,
    currentBalance: acc.currentBalance + curr.currentBalance,
  }), { prevBalance: 0, salesAmount: 0, collectionAmount: 0, currentBalance: 0 });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-200/20 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-separate border-spacing-0">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-sm">거래처명</th>
                <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800">전일잔액</th>
                <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400">금일매출</th>
                <th className="px-4 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 text-emerald-600 dark:text-emerald-400">금일수금</th>
                <th className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 font-bold">기말잔액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-zinc-400 italic">데이터가 없습니다.</td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                    <td className="sticky left-0 z-10 px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-sm font-medium bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40 text-left">
                      {row.customer}
                    </td>
                    <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums text-zinc-500">
                      {formatNumber(row.prevBalance)}
                    </td>
                    <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                      {formatNumber(row.salesAmount)}
                    </td>
                    <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(row.collectionAmount)}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                      {formatNumber(row.currentBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-zinc-50/50 dark:bg-zinc-800/50 font-bold">
                <tr>
                  <td className="sticky left-0 z-10 bg-zinc-50/50 dark:bg-zinc-800/50 px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-left">합계 ({divisionName})</td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatNumber(totals.prevBalance)}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums text-blue-600 dark:text-blue-400">
                    {formatNumber(totals.salesAmount)}
                  </td>
                  <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatNumber(totals.collectionAmount)}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatNumber(totals.currentBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <DataLogicInfo 
        title={`${divisionName} 일일매출수금 로직`}
        description="판매 데이터와 입금 데이터를 실시간으로 결합하여 거래처별 일일 채권 변동을 계산합니다."
        steps={[
          "데이터 통합: 매출(Sales) 테이블의 '공급가액+부가세'와 입금(Deposits) 테이블의 '금액'을 동일 거래처 코드로 매칭합니다.",
          "잔액 이월: 전일까지의 모든 원장 데이터를 합산하여 기초 잔액(전일잔액)을 산출합니다.",
          "사업부 필터: 선택된 탭(${divisionName})에 해당하는 거래처 그룹만 선별하여 노출합니다.",
          "실시간 계산: 전일잔액 + 금일매출 - 금일수금 = 기말잔액 공식을 적용하여 최종 미수금을 계산합니다."
        ]}
      />
    </div>
  );
}
