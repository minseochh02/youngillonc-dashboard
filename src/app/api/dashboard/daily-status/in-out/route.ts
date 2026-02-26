import { NextResponse } from 'next/server';

/**
 * API Endpoint to fetch Daily Deposit and Withdrawal Status (입출금현황)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-04';

    // Mock data based on provided image-e07e6873-f02d-4a30-bc6f-2596fa2c2be1.png
    const data = {
      deposits: [
        { type: "외상매출금", source: "승창엘리베이터 주식회사", amount: 105600, detail: "서울-기업" },
        { type: "외상매출금", source: "삼광오엔씨주식회사", amount: 2241580, detail: "서울-기업" },
        { type: "외상매출금", source: "(주)한국유니엄", amount: 329010, detail: "서울-기업" },
        { type: "외상매출금", source: "주식회사 수경피에스티", amount: 7196200, detail: "서울-기업" },
        { type: "외상매출금", source: "주식회사 에스디테크", amount: 214500, detail: "서울-기업" },
        { type: "외상매출금", source: "(주)더율컴퍼니", amount: 126500, detail: "서울-기업" },
        { type: "외상매출금", source: "삼광오엔씨주식회사", amount: 2962410, detail: "서울-기업" },
        { type: "외상매출금", source: "주식회사 링크잇", amount: 308000, detail: "서울-기업" },
        { type: "외상매출금", source: "기아오토큐 지산점", amount: 2190000, detail: "우리-중부" },
        { type: "외상매출금", source: "모빌원", amount: 210000, detail: "우리-중부" },
        { type: "외상매출금", source: "북천안오일나라", amount: 1980000, detail: "우리-중부" },
        { type: "외상매출금", source: "에덴자동차정비3급", amount: 2380000, detail: "우리-중부" },
        { type: "미수금(카드)", source: "비씨카드", amount: 269956, detail: "비씨" },
        { type: "미수금(카드)", source: "신한카드", amount: 1371120, detail: "신한" },
        { type: "외상매출금", source: "대진자동차경정비", amount: 708300, detail: "중부-기업" },
        { type: "외상매출금", source: "쌍용모터스", amount: 154000, detail: "중부-기업" },
        { type: "외상매출금", source: "배곤스마트카", amount: 1862000, detail: "중부-기업" },
        { type: "외상매출금", source: "주안자동차서비스", amount: 320000, detail: "중부-기업" },
        { type: "외상매출금", source: "정비1번가", amount: 675000, detail: "중부-기업" },
        { type: "미수금", source: "(주)케이지이니시스", amount: 270760, detail: "KG이니시스(쇼핑몰)-프로카정비" },
        { type: "외상매출금", source: "씨앤엘선경윤활유", amount: 810700, detail: "창원-우리" },
        { type: "외상매출금", source: "범한자동차 주식회사", amount: 2475000, detail: "창원-우리" },
        { type: "외상매출금", source: "범한자동차 주식회사", amount: 2209900, detail: "창원-우리" },
        { type: "외상매출금", source: "협진모터스", amount: 800000, detail: "동부-우리" },
        { type: "외상매출금", source: "주식회사 시흥교통", amount: 682000, detail: "윤활유대" },
        { type: "외상매출금", source: "백성운수(주)", amount: 1050000, detail: "윤활유대" },
        { type: "외상매출금", source: "평택여객(주)", amount: 5190000, detail: "윤활유대" },
        { type: "외상매출금", source: "주식회사 국제카도크", amount: 4111000, detail: "윤활유대" },
        { type: "외상매출금", source: "제주모빌", amount: 4296400, detail: "제주-우리" },
      ],
      withdrawals: [
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
      ]
    };

    return NextResponse.json({
      success: true,
      data,
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
