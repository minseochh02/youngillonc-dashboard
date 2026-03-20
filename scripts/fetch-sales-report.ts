
import { executeSQL } from '../egdesk-helpers';

async function main() {
  const query = `
    SELECT
      CASE
        WHEN branch IN ('서울', '화성') AND category = 'IL' THEN '서울,화성 IL'
        WHEN branch = '창원' THEN '창원'
        WHEN branch = '남부' AND category = 'AUTO' THEN '화성auto(남부)'
        WHEN branch = '중부' AND category = 'AUTO' THEN '화성auto(중부)'
        WHEN branch = '서부' THEN '인천(서부)'
        WHEN branch = '동부' THEN '남양주(동부)'
        WHEN branch = '제주' THEN '제주'
        WHEN branch = '부산' THEN '부산'
        ELSE branch || ' (기타)'
      END as 구분,
      SUM(amount) as 총매출액
    FROM (
      SELECT
        CASE
          WHEN ec.전체사업소 = '경남사업소' THEN '창원'
          WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
          WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
          WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
          WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
          WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
          WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
          WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
          WHEN ec.전체사업소 LIKE '%서울%' THEN '서울'
          ELSE REPLACE(REPLACE(ec.전체사업소, '사업소', ''), '지사', '')
        END as branch,
        CASE
          WHEN i.품목그룹1코드 = 'IL' THEN 'IL'
          WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
          ELSE '기타'
        END as category,
        CAST(REPLACE(s.합계, ',', '') AS NUMERIC) as amount
      FROM (
        SELECT * FROM sales
        UNION ALL
        SELECT * FROM east_division_sales
        UNION ALL
        SELECT * FROM west_division_sales
      ) s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      WHERE s.일자 BETWEEN '2026-02-26' AND '2026-02-28'
        AND e.사원_담당_명 != '김도량'
    ) t
    GROUP BY 구분
    ORDER BY 총매출액 DESC;
  `;

  console.log('Fetching sales report for 2026-02-26 ~ 2026-02-28...');
  try {
    const result = await executeSQL(query);
    console.log('\n=== Sales Report ===');
    console.table(result.rows);
    
    // Calculate total
    const total = result.rows.reduce((sum: number, row: any) => sum + (row.총매출액 || 0), 0);
    console.log(`\nTotal Sales: ${total.toLocaleString()}`);
  } catch (error) {
    console.error('Error fetching sales report:', error);
  }
}

main();
