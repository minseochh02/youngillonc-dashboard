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
          substr(전표번호, 1, 7) as month,
          CASE 
            WHEN 부서명 = 'MB' THEN 'MB'
            WHEN 부서명 LIKE '%화성%' THEN '화성'
            WHEN 부서명 LIKE '%창원%' THEN '창원'
            WHEN 부서명 LIKE '%남부%' THEN '남부'
            WHEN 부서명 LIKE '%중부%' THEN '중부'
            WHEN 부서명 LIKE '%서부%' THEN '서부'
            WHEN 부서명 LIKE '%동부%' THEN '동부'
            WHEN 부서명 LIKE '%제주%' THEN '제주'
            WHEN 부서명 LIKE '%부산%' THEN '부산'
            ELSE REPLACE(REPLACE(COALESCE(부서명, '기타'), '사업소', ''), '지사', '')
          END as branch,
          SUM(CASE 
            WHEN (계좌 NOT LIKE '%카드%' AND 계좌 NOT LIKE '%이니시스%') 
              OR (계좌 LIKE '%우리-%' OR 계좌 LIKE '%기업-%' OR 계좌 LIKE '%국민-%' OR 계좌 LIKE '%신한-%' OR 계좌 LIKE '%농협-%' OR 계좌 LIKE '%하나-%')
            THEN CAST(REPLACE(금액, ',', '') AS NUMERIC) ELSE 0 END) as cash,
          SUM(CASE 
            WHEN (계좌 LIKE '%카드%' OR 계좌 LIKE '%이니시스%')
              AND (계좌 NOT LIKE '%우리-%' AND 계좌 NOT LIKE '%기업-%' AND 계좌 NOT LIKE '%국민-%' AND 계좌 NOT LIKE '%신한-%' AND 계좌 NOT LIKE '%농협-%' AND 계좌 NOT LIKE '%하나-%')
            THEN CAST(REPLACE(금액, ',', '') AS NUMERIC) ELSE 0 END) as card
        FROM deposits
        WHERE 전표번호 LIKE '${year}-%'
          AND 계정명 = '외상매출금'
          AND (부서명 LIKE '%사업소%' OR 부서명 LIKE '%지사%' OR 부서명 = 'MB')
        GROUP BY 1, 2
      ) d
      FULL OUTER JOIN (
        SELECT 
          substr(일자, 1, 7) as month,
          CASE 
            WHEN 부서명 = 'MB' THEN 'MB'
            WHEN 부서명 LIKE '%화성%' THEN '화성'
            WHEN 부서명 LIKE '%창원%' THEN '창원'
            WHEN 부서명 LIKE '%남부%' THEN '남부'
            WHEN 부서명 LIKE '%중부%' THEN '중부'
            WHEN 부서명 LIKE '%서부%' THEN '서부'
            WHEN 부서명 LIKE '%동부%' THEN '동부'
            WHEN 부서명 LIKE '%제주%' THEN '제주'
            WHEN 부서명 LIKE '%부산%' THEN '부산'
            ELSE REPLACE(REPLACE(COALESCE(부서명, '기타'), '사업소', ''), '지사', '')
          END as branch,
          SUM(증가금액) as notes
        FROM promissory_notes
        WHERE 일자 LIKE '${year}-%' AND 증감구분 = '증가'
          AND (부서명 LIKE '%사업소%' OR 부서명 LIKE '%지사%' OR 부서명 = 'MB')
        GROUP BY 1, 2
      ) n ON d.month = n.month AND d.branch = n.branch
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
