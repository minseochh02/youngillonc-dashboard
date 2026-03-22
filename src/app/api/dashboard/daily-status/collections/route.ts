import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Daily Collections Status (외상매출금 수금 현황)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-02-04';

    // SQL to aggregate collection data
    // 1. Cash and Card from 'deposits' (Branch categorized by client group)
    // 2. Notes from 'promissory_notes' (Branch categorized by client group via 거래처코드)
    const query = `
      SELECT 
        COALESCE(d.branch, n.branch) as branch,
        (COALESCE(d.cash, 0) + COALESCE(d.card, 0) + COALESCE(n.notes, 0)) as totalCollection,
        COALESCE(d.cash, 0) as cash,
        COALESCE(n.notes, 0) as notes,
        COALESCE(d.card, 0) as card,
        0 as other1,
        0 as other2
      FROM (
        SELECT 
          CASE 
            WHEN c.거래처그룹1명 LIKE '%MB%' THEN 'MB'
            WHEN c.거래처그룹1명 LIKE '%서울%' THEN 'MB'
            WHEN c.거래처그룹1명 LIKE '%벤츠%' THEN 'MB'
            WHEN c.거래처그룹1명 LIKE '%화성%' THEN '화성'
            WHEN c.거래처그룹1명 LIKE '%창원%' THEN '창원'
            WHEN c.거래처그룹1명 LIKE '%경남%' THEN '창원'
            WHEN c.거래처그룹1명 LIKE '%남부%' THEN '남부'
            WHEN c.거래처그룹1명 LIKE '%중부%' THEN '중부'
            WHEN c.거래처그룹1명 LIKE '%서부%' THEN '서부'
            WHEN c.거래처그룹1명 LIKE '%인천%' THEN '서부'
            WHEN c.거래처그룹1명 LIKE '%동부%' THEN '동부'
            WHEN c.거래처그룹1명 LIKE '%하남%' THEN '동부'
            WHEN c.거래처그룹1명 LIKE '%제주%' THEN '제주'
            WHEN c.거래처그룹1명 LIKE '%부산%' THEN '부산'
            ELSE '기타'
          END as branch,
          SUM(CASE 
            WHEN (d.계좌 NOT LIKE '%카드%' AND d.계좌 NOT LIKE '%이니시스%')
              OR (d.계좌 LIKE '%우리-%' OR d.계좌 LIKE '%기업-%' OR d.계좌 LIKE '%국민-%' OR d.계좌 LIKE '%신한-%' OR d.계좌 LIKE '%농협-%' OR d.계좌 LIKE '%하나-%')
            THEN CAST(REPLACE(d.금액, ',', '') AS NUMERIC) ELSE 0 END) as cash,
          SUM(CASE 
            WHEN (d.계좌 LIKE '%카드%' OR d.계좌 LIKE '%이니시스%')
              AND (d.계좌 NOT LIKE '%우리-%' AND d.계좌 NOT LIKE '%기업-%' AND d.계좌 NOT LIKE '%국민-%' AND d.계좌 NOT LIKE '%신한-%' AND d.계좌 NOT LIKE '%농협-%' AND d.계좌 NOT LIKE '%하나-%')
            THEN CAST(REPLACE(d.금액, ',', '') AS NUMERIC) ELSE 0 END) as card
        FROM deposits d
        LEFT JOIN clients c ON d.거래처코드 = c.거래처코드
        WHERE d.일자 = '${date}'
          AND d.계정명 = '외상매출금'
        GROUP BY 1
      ) d
      FULL OUTER JOIN (
        SELECT 
          CASE 
            WHEN c.거래처그룹1명 LIKE '%MB%' THEN 'MB'
            WHEN c.거래처그룹1명 LIKE '%서울%' THEN 'MB'
            WHEN c.거래처그룹1명 LIKE '%벤츠%' THEN 'MB'
            WHEN c.거래처그룹1명 LIKE '%화성%' THEN '화성'
            WHEN c.거래처그룹1명 LIKE '%창원%' THEN '창원'
            WHEN c.거래처그룹1명 LIKE '%경남%' THEN '창원'
            WHEN c.거래처그룹1명 LIKE '%남부%' THEN '남부'
            WHEN c.거래처그룹1명 LIKE '%중부%' THEN '중부'
            WHEN c.거래처그룹1명 LIKE '%서부%' THEN '서부'
            WHEN c.거래처그룹1명 LIKE '%인천%' THEN '서부'
            WHEN c.거래처그룹1명 LIKE '%동부%' THEN '동부'
            WHEN c.거래처그룹1명 LIKE '%하남%' THEN '동부'
            WHEN c.거래처그룹1명 LIKE '%제주%' THEN '제주'
            WHEN c.거래처그룹1명 LIKE '%부산%' THEN '부산'
            ELSE '기타'
          END as branch,
          SUM(증가금액) as notes
        FROM promissory_notes p
        LEFT JOIN clients c ON p.거래처코드 = c.거래처코드
        WHERE 일자 = '${date}' AND 증감구분 = '증가'
        GROUP BY 1
      ) n ON d.branch = n.branch
      WHERE COALESCE(d.branch, n.branch) != '기타'
      ORDER BY totalCollection DESC
    `;

    const resultData = await executeSQL(query);
    const data = resultData?.rows || [];

    return NextResponse.json({
      success: true,
      data,
      date
    });
  } catch (error: any) {
    console.error('Collections API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch collection status data'
    }, { status: 500 });
  }
}
