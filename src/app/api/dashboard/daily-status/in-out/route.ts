import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Daily Deposit and Withdrawal Status (입출금현황)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-04';

    // 1. Fetch real Inflow data from 'deposits'
    const depositQuery = `
      SELECT 
        계정명 as type,
        거래처명 as source,
        CAST(REPLACE(금액, ',', '') AS NUMERIC) as amount,
        계좌 as detail
      FROM deposits
      WHERE 전표번호 = '${date}'
      ORDER BY amount DESC
    `;
    const depositResult = await executeSQL(depositQuery);
    const realDeposits = depositResult?.rows || [];

    // 2. Fetch withdrawal data (Currently limited data availability in DB)
    // We maintain the high-fidelity mock data structure for withdrawals 
    // until the corresponding database table is provided.
    const mockWithdrawals = [
      { type: "지급수수료 판관비 기타", source: "외환-서울(36805)", amount: 500, detail: "계좌간이동-하나/36805(외환)" },
      { type: "선급금", source: "모빌코리아윤활유(주)울산", amount: 80000000, detail: "윤활유대(IL,AUTO)" },
      { type: "외상매입금", source: "지에스엠비즈 주식회사", amount: 5000000, detail: "윤활유대" },
      { type: "현금 시재금-서울", source: "서울", amount: 546000, detail: "1월말" },
      { type: "현금 시재금-창원", source: "창원", amount: 38000, detail: "1월말" },
      { type: "현금 시재금-화성", source: "화성", amount: 10000, detail: "1월말" },
      { type: "선급금", source: "MC.ENERGY(일본)", amount: 12437894, detail: "UNIREX N3 - 30 P/L, UNIREX N2 - 5 P/L 수" },
      { type: "지급수수료 판관비 기타", source: "기업-서울(095)", amount: 10000, detail: "송금수수료" },
      { type: "지급수수료 판관비 기타", source: "기업-서울(095)", amount: 8000, detail: "전신료" },
      { type: "미지급비용", source: "청송퀵청송퀵-김필환", amount: 176000, detail: "용차운임(에스피네이처)" },
      { type: "미지급비용", source: "개별화물-박유산", amount: 253000, detail: "용차운임(지에스아시아퍼시픽)" },
    ];

    return NextResponse.json({
      success: true,
      data: {
        deposits: realDeposits,
        withdrawals: mockWithdrawals
      },
      date
    });
  } catch (error: any) {
    console.error('InOut API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch in-out status data'
    }, { status: 500 });
  }
}
