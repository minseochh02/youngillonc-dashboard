import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Monthly Collections Status (외상매출금 월계)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2026';

    // SQL to aggregate monthly collection data by branch
    // Logic: Using clients table via 거래처코드 for both ledger and promissory notes
    const query = `
      SELECT 
        COALESCE(d.month, n.month) as month,
        COALESCE(d.branch, n.branch) as branch,
        (COALESCE(d.cash, 0) + COALESCE(d.card, 0) + COALESCE(n.notes, 0)) as totalCollection,
        COALESCE(d.cash, 0) as cash,
        COALESCE(n.notes, 0) as notes,
        COALESCE(d.card, 0) as card
      FROM (
        SELECT 
          substr(l.일자, 1, 7) as month,
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
            WHEN (l.적요 NOT LIKE '%카드%' AND l.적요 NOT LIKE '%이니시스%' AND l.적요 NOT LIKE '%삼성%' AND l.적요 NOT LIKE '%비씨%' 
                  AND l.적요 NOT LIKE '%현대%' AND l.적요 NOT LIKE '%롯데%'
                  AND NOT (l.적요 LIKE '농협%' AND length(l.적요) > 5)
                  AND NOT (l.적요 LIKE '하나%' AND length(l.적요) > 5)
                  AND NOT (l.적요 LIKE '우리%' AND length(l.적요) > 5 AND l.적요 NOT LIKE '%-%'))
              AND l.적요 NOT LIKE '%할인%'
            THEN COALESCE(l.대변금액, 0) ELSE 0 END) as cash,
          SUM(CASE 
            WHEN (l.적요 LIKE '%카드%' OR l.적요 LIKE '%이니시스%' OR l.적요 LIKE '%삼성%' OR l.적요 LIKE '%비씨%' 
                  OR l.적요 LIKE '%현대%' OR l.적요 LIKE '%롯데%' 
                  OR (l.적요 LIKE '농협%' AND length(l.적요) > 5)
                  OR (l.적요 LIKE '하나%' AND length(l.적요) > 5)
                  OR (l.적요 LIKE '우리%' AND length(l.적요) > 5 AND l.적요 NOT LIKE '%-%'))
            THEN COALESCE(l.대변금액, 0) ELSE 0 END) as card
        FROM ledger l
        LEFT JOIN clients c ON l.거래처코드 = c.거래처코드
        WHERE l.일자 LIKE '${year}-%'
          AND l.계정코드 = '1089'
          AND l.대변금액 > 0
        GROUP BY 1, 2
      ) d
      FULL OUTER JOIN (
        SELECT 
          substr(p.일자, 1, 7) as month,
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
        WHERE 일자 LIKE '${year}-%' AND 증감구분 = '증가'
        GROUP BY 1, 2
      ) n ON d.month = n.month AND d.branch = n.branch
      WHERE COALESCE(d.branch, n.branch) != '기타'
      ORDER BY month ASC, totalCollection DESC
    `;

    const resultData = await executeSQL(query);
    const data = resultData?.rows || [];

    return NextResponse.json({
      success: true,
      data,
      year
    });
  } catch (error: any) {
    console.error('Monthly Collections API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch monthly collection status'
    }, { status: 500 });
  }
}
