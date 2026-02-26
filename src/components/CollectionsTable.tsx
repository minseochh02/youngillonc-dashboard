import DataLogicInfo from "./DataLogicInfo";

interface CollectionRowData {
  branch: string;
  totalCollection: number;
  cash: number;
  notes: number;
  card: number;
  other1: number;
  other2: number;
}

interface CollectionsTableProps {
  data: CollectionRowData[];
}

const formatNumber = (num: number) => {
  if (!num || num === 0) return "-";
  return num.toLocaleString();
};

export default function CollectionsTable({ data }: CollectionsTableProps) {
  const maxCollection = Math.max(...data.map(d => d.totalCollection || 0), 1);
  
  const total = data.reduce((acc, curr) => ({
    totalCollection: acc.totalCollection + (Number(curr.totalCollection) || 0),
    cash: acc.cash + (Number(curr.cash) || 0),
    notes: acc.notes + (Number(curr.notes) || 0),
    card: acc.card + (Number(curr.card) || 0),
    other1: acc.other1 + (Number(curr.other1) || 0),
    other2: acc.other2 + (Number(curr.other2) || 0),
  }), { totalCollection: 0, cash: 0, notes: 0, card: 0, other1: 0, other2: 0 });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-200/20 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-separate border-spacing-0">
            <thead>
              {/* Unified Category Header */}
              <tr className="bg-zinc-50 dark:bg-zinc-900 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-sm">사업소</th>
                <th className="px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 text-sm">총수금금액</th>
                <th className="px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800">현금</th>
                <th className="px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800">어음</th>
                <th className="px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800">카드</th>
                <th className="px-4 py-6 border-r border-b border-zinc-200 dark:border-zinc-800">기타1</th>
                <th className="px-4 py-6 border-b border-zinc-200 dark:border-zinc-800">기타2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-zinc-400 italic">수금 내역이 없습니다.</td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={row.branch || idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                    <td className="sticky left-0 z-10 px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 text-sm font-bold bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40">
                      {row.branch}
                    </td>
                    <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800">
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="tabular-nums font-bold text-blue-600 dark:text-blue-400">
                          {formatNumber(row.totalCollection)}
                        </span>
                        <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500/50 rounded-full" 
                            style={{ width: `${(row.totalCollection / maxCollection) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-600 dark:text-zinc-300">
                      {formatNumber(row.cash)}
                    </td>
                    <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-600 dark:text-zinc-300">
                      {formatNumber(row.notes)}
                    </td>
                    <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-600 dark:text-zinc-300">
                      {formatNumber(row.card)}
                    </td>
                    <td className="px-4 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right text-zinc-400">
                      {formatNumber(row.other1)}
                    </td>
                    <td className="px-4 py-4 tabular-nums text-right text-zinc-400">
                      {formatNumber(row.other2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-blue-50/30 dark:bg-blue-900/10 font-bold">
                <tr>
                  <td className="sticky left-0 z-10 bg-blue-50/30 dark:bg-blue-900/10 px-4 py-5 border-r border-zinc-200 dark:border-zinc-800 text-blue-700 dark:text-blue-400">Total</td>
                  <td className="px-4 py-5 border-r border-zinc-200 dark:border-zinc-800 text-right text-blue-700 dark:text-blue-400 tabular-nums">
                    {formatNumber(total.totalCollection)}
                  </td>
                  <td className="px-4 py-5 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">
                    {formatNumber(total.cash)}
                  </td>
                  <td className="px-4 py-5 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">
                    {formatNumber(total.notes)}
                  </td>
                  <td className="px-4 py-5 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">
                    {formatNumber(total.card)}
                  </td>
                  <td className="px-4 py-5 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">
                    {formatNumber(total.other1)}
                  </td>
                  <td className="px-4 py-5 text-right tabular-nums">
                    {formatNumber(total.other2)}
                  </td>
                </tr>
              </tfoot>
              )}
            </table>
          </div>
        </div>

        <DataLogicInfo 
          title="외상매출금 수금"
          description="입금보고서 및 어음 관리 테이블을 결합하여 실제 수금된 자금을 정밀 집계합니다."
        steps={[
          "외상매출금 필터링: 회계 기준에 따라 '미수금'이나 '잡이익'을 제외하고 오직 '외상매출금' 계정의 입금 내역만 선별합니다.",
          "수금 수단 정밀 분류: 입금 계좌명이 '우리-', '기업-', '국민-' 등 구체적인 은행 지점 계좌인 경우, '카드' 수금 내역이 포함되어 있더라도 실제 통장에 입금 완료된 '현금'으로 우선 분류합니다. 순수 '카드' 항목은 정산 전인 PG(이니시스 등) 계좌 내역만 집계합니다.",
          "어음 실적 통합: 받을어음 테이블에서 '증가'로 기록된 신규 어음 수취 내역을 실시간으로 가져와 합산합니다.",
          "지사별 자동 배정: 어음 번호의 고유 접두어(Y, IC, N, C, P)와 부서 정보를 대조하여 각 사업소별 실적으로 정확히 매핑합니다."
        ]}
        />
    </div>
  );
}
