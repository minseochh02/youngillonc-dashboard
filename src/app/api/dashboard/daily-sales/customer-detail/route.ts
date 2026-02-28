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

    const getSalesBranchFilter = () => {
      if (division === '전체') return "(거래처그룹1코드명 LIKE '%사업소%' OR 거래처그룹1코드명 LIKE '%지사%')";
      if (division === '창원') return "(창고명 = '창원' OR 판매처명 = '테크젠 주식회사')";
      if (division === 'MB') return "거래처그룹1코드명 = 'MB'";
      return `(거래처그룹1코드명 LIKE '%${division}%' OR 창고명 LIKE '%${division}%')`;
    };

    const getDepBranchFilter = () => {
      if (division === '전체') return "(부서명 LIKE '%사업소%' OR 부서명 LIKE '%지사%')";
      if (division === 'MB') return "부서명 = 'MB'";
      return `부서명 LIKE '%${division}%'`;
    };

    const query = `
      SELECT 
        c.name as customer,
        COALESCE(pb.balance, 0) as prevBalance,
        COALESCE(ts.amount, 0) as salesAmount,
        COALESCE(tc.amount, 0) as collectionAmount,
        (COALESCE(pb.balance, 0) + COALESCE(ts.amount, 0) - COALESCE(tc.amount, 0)) as currentBalance
      FROM (
        SELECT DISTINCT 판매처명 as name, 거래처코드
        FROM sales
        WHERE ${getSalesBranchFilter()} AND 일자 <= '${date}'
        UNION
        SELECT DISTINCT 거래처명 as name, 거래처코드
        FROM deposits
        WHERE ${getDepBranchFilter()} AND 전표번호 <= '${date}'
      ) c
      LEFT JOIN (
        SELECT 
          거래처코드,
          SUM(CAST(REPLACE(차변금액, ',', '') AS NUMERIC)) - SUM(CAST(REPLACE(대변금액, ',', '') AS NUMERIC)) as balance
        FROM ledger
        WHERE 일자_no_ < '${date.replace(/-/g, '/')}'
        GROUP BY 거래처코드
      ) pb ON c.거래처코드 = pb.거래처코드
      LEFT JOIN (
        SELECT 
          거래처코드,
          SUM(CAST(REPLACE(합_계, ',', '') AS NUMERIC)) as amount
        FROM sales
        WHERE 일자 = '${date}'
        GROUP BY 거래처코드
      ) ts ON c.거래처코드 = ts.거래처코드
      LEFT JOIN (
        SELECT 
          거래처코드,
          SUM(CAST(REPLACE(금액, ',', '') AS NUMERIC)) as amount
        FROM deposits
        WHERE 전표번호 = '${date}'
        GROUP BY 거래처코드
      ) tc ON c.거래처코드 = tc.거래처코드
      WHERE ts.amount != 0 OR tc.amount != 0 OR pb.balance != 0
      ORDER BY salesAmount DESC, collectionAmount DESC
    `;

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
