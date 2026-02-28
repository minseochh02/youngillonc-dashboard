import { CreditCard, Info } from "lucide-react";
import DataLogicInfo from "./DataLogicInfo";

interface MobilPaymentRow {
  branch: string;
  industryGroup: string;
  il: number;
  auto: number;
  mbk: number;
  total: number;
}

interface MobilPaymentsTableProps {
  data: MobilPaymentRow[];
}

const formatNumber = (num: number) => {
  if (num === 0) return "-";
  return num.toLocaleString();
};

export default function MobilPaymentsTable({ data }: MobilPaymentsTableProps) {
  const totals = data.reduce((acc, curr) => ({
    il: acc.il + (curr.il || 0),
    auto: acc.auto + (curr.auto || 0),
    mbk: acc.mbk + (curr.mbk || 0),
    total: acc.total + (curr.total || 0),
  }), { il: 0, auto: 0, mbk: 0, total: 0 });

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-200/20 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-separate border-spacing-0">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold">
                <th className="px-6 py-4 border-r border-b border-zinc-200 dark:border-zinc-800 w-24 sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900">사업소</th>
                <th className="px-6 py-4 border-r border-b border-zinc-200 dark:border-zinc-800">IL</th>
                <th className="px-6 py-4 border-r border-b border-zinc-200 dark:border-zinc-800">AUTO</th>
                <th className="px-6 py-4 border-r border-b border-zinc-200 dark:border-zinc-800">MBK</th>
                <th className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.map((row, idx) => (
                <tr key={row.branch || idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                  <td className="px-6 py-4 border-r border-zinc-200 dark:border-zinc-800 font-bold text-zinc-900 dark:text-zinc-100 sticky left-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/40">
                    {row.branch}
                  </td>
                  <td className="px-6 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right font-medium">
                    {formatNumber(row.il)}
                  </td>
                  <td className="px-6 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right font-medium">
                    {formatNumber(row.auto)}
                  </td>
                  <td className="px-6 py-4 border-r border-zinc-200 dark:border-zinc-800 tabular-nums text-right font-medium">
                    {formatNumber(row.mbk)}
                  </td>
                  <td className="px-6 py-4 tabular-nums text-right font-bold text-zinc-900 dark:text-zinc-100">
                    {formatNumber(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50/50 dark:bg-zinc-800/30 font-bold border-t-2 border-zinc-200 dark:border-zinc-700">
              <tr>
                <td className="px-6 py-5 border-r border-zinc-200 dark:border-zinc-800 sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800/50">합계</td>
                <td className="px-6 py-5 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">
                  {formatNumber(totals.il)}
                </td>
                <td className="px-6 py-5 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">
                  {formatNumber(totals.auto)}
                </td>
                <td className="px-6 py-5 border-r border-zinc-200 dark:border-zinc-800 text-right tabular-nums">
                  {formatNumber(totals.mbk)}
                </td>
                <td className="px-6 py-5 text-right tabular-nums text-blue-600 dark:text-blue-400 text-base">
                  {formatNumber(totals.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <DataLogicInfo 
        title="모빌결제내역"
        description="모빌코리아 매입 데이터를 지사별 및 산업군(IL, AUTO, MBK)별로 분류하여 결제 규모를 집계합니다."
        steps={[
          "산업군 분류: 매입 품목의 그룹 코드에 따라 산업용(IL), 자동차용(AUTO), 특수유(MBK) 섹터로 자동 분류합니다.",
          "지사별 매핑: 각 지사(사업소)에서 발생한 모빌코리아 제품의 총 매입액을 실시간으로 합산합니다.",
          "정산 규모 파악: 지사별 산업군 비중과 당일 총 결제 예정 금액을 대조하여 자금 계획 수립을 지원합니다.",
          "데이터 정밀화: 텍스트 형태의 공급가액과 부가세를 합산하여 실제 지불되는 최종 합계 금액을 산출합니다."
        ]}
      />
    </div>
  );
}
