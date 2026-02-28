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
    // 1. Cash and Card from 'deposits'
    // 2. Notes from 'promissory_notes'
    const query = `
      SELECT 
        COALESCE(d.branch, n.branch) as branch,
        (COALESCE(d.cash, 0) + COALESCE(d.card, 0) + COALESCE(n.notes, 0)) as totalCollection,
        COALESCE(d.cash, 0) as cash,
        COALESCE(n.notes, 0) as notes,
        COALESCE(d.card, 0) as card,
        0 as other1, -- Placeholder for other1 as per UI
        0 as other2  -- Placeholder for other2 as per UI
      FROM (
        SELECT 
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
            ELSE REPLACE(REPLACE(부서명, '사업소', ''), '지사', '')
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
        WHERE 전표번호 = '${date}'
          AND 계정명 = '외상매출금' -- Rule: Only include Accounts Receivable (Ignore 미수금, 잡이익)
          AND (부서명 LIKE '%사업소%' OR 부서명 LIKE '%지사%' OR 부서명 = 'MB')
        GROUP BY 1
      ) d
      FULL OUTER JOIN (
        SELECT 
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
            ELSE REPLACE(REPLACE(부서명, '사업소', ''), '지사', '')
          END as branch,
          SUM(증가금액) as notes
        FROM promissory_notes
        WHERE 일자 = '${date}' AND 증감구분 = '증가'
          AND (부서명 LIKE '%사업소%' OR 부서명 LIKE '%지사%' OR 부서명 = 'MB')
        GROUP BY 1
      ) n ON d.branch = n.branch
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
