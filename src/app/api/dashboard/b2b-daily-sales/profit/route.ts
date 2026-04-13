import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';
import { sqlSalesAmountExprCoalesced } from '@/lib/vat-amount-sql';

/**
 * API Endpoint for B2B Daily Sales Profit Analysis
 * Joins sales, clients, and sales_profit for the selected date
 * Groups by branch and item to show profit analysis
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const includeVat = searchParams.get('includeVat') === 'true';
    const saleAmt = sqlSalesAmountExprCoalesced('s', includeVat);

    // Mapping logic for branches based on clients.거래처그룹1명
    const branchMapping = `
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
        ELSE COALESCE(NULLIF(c.거래처그룹1명, ''), '기타')
      END
    `;

    // Query explanation:
    // 1. Join sales and clients to get branch information for the selected date.
    //    Unions sales data from main, east, and west division tables for complete B2B coverage.
    // 2. Join with the latest cost data from sales_profit table on 품목코드.
    //    Using a subquery instead of WITH/CTE to satisfy the "Only SELECT queries allowed" restriction.
    // 3. Aggregate by branch and item to calculate total sales, costs, and profits.
    const query = `
      SELECT 
        ROW_NUMBER() OVER(ORDER BY ${branchMapping}, SUM(${saleAmt}) DESC) as id,
        ${branchMapping} as branch,
        s.품목코드,
        MAX(COALESCE(sp.품목명, i.품목명, '미지정')) as 품목명,
        SUM(CAST(REPLACE(COALESCE(s.수량, '0'), ',', '') AS NUMERIC)) as 판매수량,
        AVG(CAST(REPLACE(COALESCE(s.단가, '0'), ',', '') AS NUMERIC)) as 판매단가,
        SUM(${saleAmt}) as 판매금액,
        MAX(CAST(REPLACE(COALESCE(CAST(sp.원가단가 AS VARCHAR), '0'), ',', '') AS NUMERIC)) as 원가단가,
        SUM(CAST(REPLACE(COALESCE(s.수량, '0'), ',', '') AS NUMERIC) * CAST(REPLACE(COALESCE(CAST(sp.원가단가 AS VARCHAR), '0'), ',', '') AS NUMERIC)) as 원가금액,
        SUM(${saleAmt} - (CAST(REPLACE(COALESCE(s.수량, '0'), ',', '') AS NUMERIC) * CAST(REPLACE(COALESCE(CAST(sp.원가단가 AS VARCHAR), '0'), ',', '') AS NUMERIC))) as 이익금액,
        CASE 
          WHEN SUM(CAST(REPLACE(COALESCE(s.수량, '0'), ',', '') AS NUMERIC)) > 0 
          THEN SUM(${saleAmt} - (CAST(REPLACE(COALESCE(s.수량, '0'), ',', '') AS NUMERIC) * CAST(REPLACE(COALESCE(CAST(sp.원가단가 AS VARCHAR), '0'), ',', '') AS NUMERIC))) / SUM(CAST(REPLACE(COALESCE(s.수량, '0'), ',', '') AS NUMERIC))
          ELSE 0 
        END as 이익단가,
        CASE 
          WHEN SUM(${saleAmt}) > 0 
          THEN SUM(${saleAmt} - (CAST(REPLACE(COALESCE(s.수량, '0'), ',', '') AS NUMERIC) * CAST(REPLACE(COALESCE(CAST(sp.원가단가 AS VARCHAR), '0'), ',', '') AS NUMERIC))) / SUM(${saleAmt})
          ELSE 0 
        END as 이익율
      FROM (
        SELECT 일자, 거래처코드, 담당자코드, 품목코드, 수량, 단가, 합계, 공급가액 FROM sales
        UNION ALL
        SELECT 일자, 거래처코드, 담당자코드, 품목코드, 수량, 단가, 합계, 공급가액 FROM east_division_sales
        UNION ALL
        SELECT 일자, 거래처코드, 담당자코드, 품목코드, 수량, 단가, 합계, 공급가액 FROM west_division_sales
      ) s
      LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
      LEFT JOIN (
        SELECT 품목코드, 품목명, 원가단가, 판매단가, 이익율
        FROM (
          SELECT 품목코드, 품목명, 원가단가, 판매단가, 이익율,
                 ROW_NUMBER() OVER(PARTITION BY 품목코드 ORDER BY id DESC) as rn
          FROM sales_profit
        ) t
        WHERE rn = 1
      ) sp ON s.품목코드 = sp.품목코드
      WHERE s.일자 = '${date}'
        AND ec.b2c_팀 = 'B2B'
        AND COALESCE(e.사원_담당_명, '') != '김도량'
      GROUP BY branch, s.품목코드
      ORDER BY branch, 판매금액 DESC
    `;

    const result = await executeSQL(query);
    const data = result?.rows || [];

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('Sales Profit API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
