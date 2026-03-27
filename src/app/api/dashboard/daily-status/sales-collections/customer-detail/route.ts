import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

/**
 * API Endpoint to fetch Customer-wise Daily Sales & Collections
 * Specifically for the /dashboard/daily-status/sales page
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const division = searchParams.get('division') || '창원';
    const includeVat = searchParams.get('includeVat') === 'true';

    const divisor = includeVat ? '1.0' : '1.1';

    // Calculate the start of the month for the given date
    const startDate = `${date.substring(0, 7)}-01`;

    const getSalesBranchFilter = () => {
      if (division === '전체') return "1=1";
      if (division === '창원') return "(ec.전체사업소 = '경남사업소' OR w.창고명 = '창원' OR c.거래처명 = '테크젠 주식회사')";
      if (division === 'MB') return "ec.전체사업소 = '벤츠'";
      if (division === '화성') return "ec.전체사업소 LIKE '%화성%'";
      return `(ec.전체사업소 LIKE '%${division}%' OR w.창고명 LIKE '%${division}%')`;
    };

    const getDepBranchFilter = (alias: string = '', isLedger: boolean = false) => {
      const prefix = alias ? `${alias}.` : '';
      if (division === '전체') return "1=1";
      if (isLedger) {
        if (division === 'MB') return `(${prefix}거래처그룹1명 LIKE '%MB%' OR ${prefix}거래처그룹1명 LIKE '%벤츠%')`;
        return `${prefix}거래처그룹1명 LIKE '%${division}%'`;
      }
      if (division === 'MB') return `${prefix}부서명 = 'MB'`;
      return `${prefix}부서명 LIKE '%${division}%'`;
    };

    // 0. Base subquery to combine sales tables (excluding south division)
    const baseSalesSubquery = `
      (
        SELECT 일자, 거래처코드, 담당자코드, 합계, 출하창고코드 FROM sales
        UNION ALL
        SELECT 일자, 거래처코드, 담당자코드, 합계, 창고코드 as 출하창고코드 FROM east_division_sales
        UNION ALL
        SELECT 일자, 거래처코드, 담당자코드, 합계, 창고코드 as 출하창고코드 FROM west_division_sales
      )
    `;

    const query = `
      SELECT
        cust.name as customer,
        COALESCE(ts_prev.amount, 0) - COALESCE(tc_prev.amount, 0) as prevBalance,
        COALESCE(ts.amount, 0) / ${divisor} as salesAmount,
        COALESCE(tc.amount, 0) as collectionAmount,
        COALESCE(ms.amount, 0) / ${divisor} as salesMTD,
        COALESCE(mc.amount, 0) as collectionMTD,
        (COALESCE(ts_prev.amount, 0) - COALESCE(tc_prev.amount, 0) + COALESCE(ts.amount, 0) - COALESCE(tc.amount, 0)) as currentBalance
      FROM (
        SELECT DISTINCT c.거래처명 as name, s.거래처코드
        FROM ${baseSalesSubquery} s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN warehouses w ON s.출하창고코드 = w.창고코드
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        WHERE ${getSalesBranchFilter()} AND s.일자 >= '${startDate}' AND s.일자 <= '${date}'
        UNION
        SELECT DISTINCT c_dep.거래처명 as name, l.거래처코드
        FROM ledger l
        LEFT JOIN clients c_dep ON l.거래처코드 = c_dep.거래처코드
        WHERE l.계정코드 = '1089'
          AND l.대변금액 > 0
          AND ${getDepBranchFilter('c_dep', true)}
          AND l.일자 >= '${startDate}' AND l.일자 <= '${date}'
      ) cust
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(COALESCE(대변금액, 0)) as amount
        FROM ledger
        WHERE 일자 < '${date}'
          AND 계정코드 = '1089'
          AND 대변금액 > 0
          AND 적요 NOT LIKE '%할인%'
        GROUP BY 거래처코드
      ) tc_prev ON cust.거래처코드 = tc_prev.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as amount
        FROM ${baseSalesSubquery}
        WHERE 일자 < '${date}'
        GROUP BY 거래처코드
      ) ts_prev ON cust.거래처코드 = ts_prev.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as amount
        FROM ${baseSalesSubquery}
        WHERE 일자 = '${date}'
        GROUP BY 거래처코드
      ) ts ON cust.거래처코드 = ts.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(COALESCE(대변금액, 0)) as amount
        FROM ledger
        WHERE 일자 = '${date}'
          AND 계정코드 = '1089'
          AND 대변금액 > 0
          AND 적요 NOT LIKE '%할인%'
        GROUP BY 거래처코드
      ) tc ON cust.거래처코드 = tc.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(CAST(REPLACE(합계, ',', '') AS NUMERIC)) as amount
        FROM ${baseSalesSubquery}
        WHERE 일자 >= '${startDate}' AND 일자 <= '${date}'
        GROUP BY 거래처코드
      ) ms ON cust.거래처코드 = ms.거래처코드
      LEFT JOIN (
        SELECT
          거래처코드,
          SUM(COALESCE(대변금액, 0)) as amount
        FROM ledger
        WHERE 일자 >= '${startDate}' AND 일자 <= '${date}'
          AND 계정코드 = '1089'
          AND 대변금액 > 0
          AND 적요 NOT LIKE '%할인%'
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
