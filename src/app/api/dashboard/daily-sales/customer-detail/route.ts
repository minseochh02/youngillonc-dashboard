import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Customer-wise Daily Sales & Collections
 * Specifically for the /dashboard/daily-sales page
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2025-11-01';
    const division = searchParams.get('division') || '창원';

    // Calculate the start of the month for the given date
    const startDate = `${date.substring(0, 7)}-01`;

    const getSalesBranchFilter = () => {
      if (division === '전체') return "1=1";
      if (division === '창원') return "(ec.전체사업소 = '경남사업소' OR w.창고명 = '창원' OR c.거래처명 = '테크젠 주식회사')";
      if (division === 'MB') return "ec.전체사업소 = '벤츠'";
      if (division === '화성') return "ec.전체사업소 LIKE '%화성%'";
      return `(ec.전체사업소 LIKE '%${division}%' OR w.창고명 LIKE '%${division}%')`;
    };

    const getDepBranchFilter = () => {
      if (division === '전체') return "1=1";
      if (division === 'MB') return "부서명 = 'MB'";
      return `부서명 LIKE '%${division}%'`;
    };

    // 0. Base subquery for sales with UNION across all division tables
    const baseSalesSubquery = `
      SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM sales
      UNION ALL
      SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM east_division_sales
      UNION ALL
      SELECT 일자, 거래처코드, 담당자코드, NULL as 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, 신규일, 적요, 적요2 FROM west_division_sales
      UNION ALL
      SELECT 일자, 거래처코드, NULL as 담당자코드, 담당자명, 품목코드, 단위, 규격명, 수량, 중량, 단가, 공급가액, 부가세, 합계, 출하창고코드, NULL as 신규일, NULL as 적요, NULL as 적요2 FROM south_division_sales
    `;

    const query = `
      SELECT
        cust.name as customer,
        COALESCE(ts_prev.amount, 0) - COALESCE(tc_prev.amount, 0) as prevBalance,
        COALESCE(ts.amount, 0) as salesAmount,
        COALESCE(tc.amount, 0) as collectionAmount,
        COALESCE(ms.amount, 0) as salesMTD,
        COALESCE(mc.amount, 0) as collectionMTD,
        (COALESCE(ts_prev.amount, 0) - COALESCE(tc_prev.amount, 0) + COALESCE(ts.amount, 0) - COALESCE(tc.amount, 0)) as currentBalance
      FROM (
        SELECT DISTINCT c.거래처명 as name, s.거래처코드
        FROM (${baseSalesSubquery}) s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        LEFT JOIN employees e ON (s.담당자코드 IS NOT NULL AND s.담당자코드 = e.사원_담당_코드) OR (s.담당자코드 IS NULL AND s.담당자명 = e.사원_담당_명)
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE ${getSalesBranchFilter()} AND s.일자 >= '${startDate}' AND s.일자 <= '${date}'
        UNION
        SELECT DISTINCT 거래처명 as name, 거래처코드
        FROM deposits
        WHERE ${getDepBranchFilter()} AND 전표번호 >= '${startDate}' AND 전표번호 <= '${date}'
      ) cust
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(CAST(REPLACE(금액, ',', '') AS NUMERIC)) as amount
        FROM deposits
        WHERE 전표번호 < '${date}'
          AND 계정명 = '외상매출금'
        GROUP BY 거래처코드
      ) tc_prev ON cust.거래처코드 = tc_prev.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery})
        WHERE 일자 < '${date}'
        GROUP BY 거래처코드
      ) ts_prev ON cust.거래처코드 = ts_prev.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery})
        WHERE 일자 = '${date}'
        GROUP BY 거래처코드
      ) ts ON cust.거래처코드 = ts.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(CAST(REPLACE(금액, ',', '') AS NUMERIC)) as amount
        FROM deposits
        WHERE 전표번호 = '${date}'
          AND 계정명 = '외상매출금'
        GROUP BY 거래처코드
      ) tc ON cust.거래처코드 = tc.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as amount
        FROM (${baseSalesSubquery})
        WHERE 일자 >= '${startDate}' AND 일자 <= '${date}'
        GROUP BY 거래처코드
      ) ms ON cust.거래처코드 = ms.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(CAST(REPLACE(금액, ',', '') AS NUMERIC)) as amount
        FROM deposits
        WHERE 전표번호 >= '${startDate}' AND 전표번호 <= '${date}'
          AND 계정명 = '외상매출금'
        GROUP BY 거래처코드
      ) mc ON cust.거래처코드 = mc.거래처코드
      WHERE ts.amount != 0 OR tc.amount != 0 OR ts_prev.amount != 0 OR tc_prev.amount != 0 OR ms.amount != 0 OR mc.amount != 0
      ORDER BY salesMTD DESC, salesAmount DESC
    `;

    // Calculate currentBalance using Sales - Deposits logic
    // currentBalance = (ts_prev.amount - tc_prev.amount) + ts.amount - tc.amount

    const result = await executeSQL(query);
    const data = result?.rows || [];

    return NextResponse.json({
      success: true,
      data,
      date,
      division
    });
  } catch (error: any) {
    console.error('Customer Detail API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch customer detail data'
    }, { status: 500 });
  }
}
