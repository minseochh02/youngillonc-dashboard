import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Daily Funds Status (자금현황)
 * Combines data from deposits (inc) and expenses (dec)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-04';

    // 1. Calculate KRW flow from deposits (inc) and expenses (dec)
    // We categorize the flows to match the treasury report structure
    const krwQuery = `
      SELECT 
        (SELECT SUM(CAST(REPLACE(금액, ',', '') AS NUMERIC)) FROM deposits WHERE 전표번호 = '${date}' AND 계정명 = '외상매출금') as ordinaryInc,
        (SELECT SUM(CAST(REPLACE(금액, ',', '') AS NUMERIC)) FROM expenses WHERE 전표번호 = '${date}') as totalDec,
        (SELECT SUM(증가금액) FROM promissory_notes WHERE 일자 = '${date}' AND 증감구분 = '증가') as notesInc
    `;
    const krwResult = await executeSQL(krwQuery);
    const flow = krwResult?.rows?.[0] || { ordinaryInc: 0, totalDec: 0, notesInc: 0 };

    const ordinaryInc = Number(flow.ordinaryInc) || 0;
    const totalDec = Number(flow.totalDec) || 0;
    const notesInc = Number(flow.notesInc) || 0;

    // Only DB-driven categories: no baseline/mock. prev=0 so "current" = 당일 순변동.
    const data = {
      krw: [
        {
          category: "보통예금 (당일)",
          prev: 0,
          inc: ordinaryInc,
          dec: totalDec,
          current: ordinaryInc - totalDec,
        },
        {
          category: "받을어음 (당일)",
          prev: 0,
          inc: notesInc,
          dec: 0,
          current: notesInc,
        },
      ],
      foreign: [],
      loans: [],
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
