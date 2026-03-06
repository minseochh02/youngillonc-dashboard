import { executeSQL } from '../egdesk-helpers';

async function testFeb7Query() {
  console.log('Testing Feb 7, 2026 Changwon sales...\n');

  const sql = `
    SELECT
      CASE
        WHEN 거래처그룹1코드명 LIKE '%창원%' THEN '창원'
        WHEN 거래처그룹1코드명 LIKE '%화성%' THEN '화성'
        WHEN 거래처그룹1코드명 LIKE '%MB%' THEN 'MB'
        WHEN 거래처그룹1코드명 LIKE '%남부%' THEN '남부'
        WHEN 거래처그룹1코드명 LIKE '%중부%' THEN '중부'
        WHEN 거래처그룹1코드명 LIKE '%서부%' THEN '서부'
        WHEN 거래처그룹1코드명 LIKE '%동부%' THEN '동부'
        WHEN 거래처그룹1코드명 LIKE '%제주%' THEN '제주'
        WHEN 거래처그룹1코드명 LIKE '%부산%' THEN '부산'
        ELSE 거래처그룹1코드명
      END as 사업소,
      SUM(CAST(REPLACE(합_계, ',', '') AS NUMERIC)) as 총매출액
    FROM sales
    WHERE 일자 = '2026-02-07'
      AND 거래처그룹1코드명 LIKE '%창원%'
    GROUP BY CASE
        WHEN 거래처그룹1코드명 LIKE '%창원%' THEN '창원'
        WHEN 거래처그룹1코드명 LIKE '%화성%' THEN '화성'
        WHEN 거래처그룹1코드명 LIKE '%MB%' THEN 'MB'
        WHEN 거래처그룹1코드명 LIKE '%남부%' THEN '남부'
        WHEN 거래처그룹1코드명 LIKE '%중부%' THEN '중부'
        WHEN 거래처그룹1코드명 LIKE '%서부%' THEN '서부'
        WHEN 거래처그룹1코드명 LIKE '%동부%' THEN '동부'
        WHEN 거래처그룹1코드명 LIKE '%제주%' THEN '제주'
        WHEN 거래처그룹1코드명 LIKE '%부산%' THEN '부산'
        ELSE 거래처그룹1코드명
      END
  `;

  const result = await executeSQL(sql);
  console.log('Result:', JSON.stringify(result, null, 2));
}

testFeb7Query().catch(console.error);
