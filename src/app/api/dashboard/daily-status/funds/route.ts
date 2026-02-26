import { NextResponse } from 'next/server';

/**
 * API Endpoint to fetch Daily Funds Status (자금현황)
 * Current implementation uses data from the provided image.
 * This can be connected to specific database tables once their mapping is confirmed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-04';

    // Mock data based on the provided image-ea5c5f15-eaaf-46a7-9c44-77512cf7520a.png
    // In a real implementation, this would aggregate data from several account tables.
    const data = {
      krw: [
        { category: "보통예금", prev: 890272593, inc: 165499936, dec: 216479394, current: 839293135 },
        { category: "받을어음", prev: 1010472355, inc: 23276000, dec: 0, current: 1033748355 },
        { category: "적금", prev: 700000000, inc: 0, dec: 0, current: 700000000 },
        { category: "보험", prev: 284928000, inc: 0, dec: 0, current: 284928000 },
        { category: "기타단기금융상품", prev: 3570587122, inc: 0, dec: 0, current: 3570587122 },
        { category: "퇴직연금", prev: 891061296, inc: 0, dec: 0, current: 891061296 },
      ],
      foreign: [
        { category: "외화예금 (USD)", prev: 211342.00, inc: 0, dec: 0, current: 211342.00, currency: "USD" },
        { category: "외화예금 (EUR)", prev: 41150.00, inc: 0, dec: 0, current: 41150.00, currency: "EUR" },
        { category: "외화예금 (JPY)", prev: 530620.00, inc: 0, dec: 0, current: 530620.00, currency: "JPY" },
        { category: "외화정기예금 (USD)", prev: 102502.00, inc: 0, dec: 0, current: 102502.00, currency: "USD" },
      ],
      loans: [
        { category: "한도대출잔액", prev: 490000000, inc: 0, dec: 0, current: 490000000 },
        { category: "단기차입금", prev: 9300000000, inc: 0, dec: 0, current: 9300000000 },
        { category: "장기차입금", prev: 0, inc: 0, dec: 0, current: 0 },
      ]
    };

    return NextResponse.json({
      success: true,
      data,
      date
    });
  } catch (error: any) {
    console.error('Funds API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch funds status data'
    }, { status: 500 });
  }
}
