import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET() {
  // Query with b2c사업소
  const query1 = `
    SELECT
      'b2c사업소' as source,
      CASE
        WHEN ec.b2c사업소 LIKE '%동부%' THEN '동부'
        WHEN ec.b2c사업소 LIKE '%서부%' THEN '서부'
        WHEN ec.b2c사업소 LIKE '%중부%' THEN '중부'
        WHEN ec.b2c사업소 LIKE '%남부%' THEN '남부'
        WHEN ec.b2c사업소 LIKE '%제주%' THEN '제주'
        ELSE '본부'
      END as branch,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
    FROM (
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량 FROM sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량 FROM east_division_sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량 FROM west_division_sales
    ) s
    LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE s.일자 LIKE '2026-02%'
      AND e.사원_담당_명 != '김도량'
      AND i.품목그룹1코드 IN ('PVL', 'CVL')
      AND ec.b2c사업소 IS NOT NULL
    GROUP BY branch
    HAVING branch = '동부'
  `;

  // Query with 전체사업소
  const query2 = `
    SELECT
      '전체사업소' as source,
      CASE
        WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
        WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
        WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
        WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
        WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
        ELSE '본부'
      END as branch,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as total_weight
    FROM (
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량 FROM sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량 FROM east_division_sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 담당자코드, 품목코드, 중량 FROM west_division_sales
    ) s
    LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    WHERE s.일자 LIKE '2026-02%'
      AND e.사원_담당_명 != '김도량'
      AND i.품목그룹1코드 IN ('PVL', 'CVL')
      AND ec.전체사업소 IS NOT NULL
    GROUP BY branch
    HAVING branch = '동부'
  `;

  const result1 = await executeSQL(query1);
  const result2 = await executeSQL(query2);

  return NextResponse.json({
    b2c사업소: result1,
    전체사업소: result2
  });
}
