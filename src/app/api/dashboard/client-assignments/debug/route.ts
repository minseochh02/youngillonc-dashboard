import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';

export async function GET() {
  try {
    // Check sample clients with their 담당자코드
    const clientSample = await executeSQL(`
      SELECT
        거래처코드,
        거래처명,
        담당자코드
      FROM clients
      LIMIT 10
    `);

    // Check sample employees
    const employeeSample = await executeSQL(`
      SELECT
        사원_담당_코드,
        사원_담당_명
      FROM employees
      LIMIT 10
    `);

    // Check how many clients have 담당자코드
    const clientStats = await executeSQL(`
      SELECT
        COUNT(*) as total,
        COUNT(담당자코드) as with_code,
        COUNT(CASE WHEN 담당자코드 IS NOT NULL AND 담당자코드 != '' THEN 1 END) as with_non_empty_code
      FROM clients
    `);

    // Try the actual JOIN to see what matches
    const joinTest = await executeSQL(`
      SELECT
        c.거래처코드,
        c.거래처명,
        c.담당자코드,
        e.사원_담당_코드,
        e.사원_담당_명
      FROM clients c
      LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
      WHERE e.사원_담당_명 IS NOT NULL
      LIMIT 10
    `);

    return NextResponse.json({
      success: true,
      debug: {
        clientSample,
        employeeSample,
        clientStats,
        joinTest,
        joinTestCount: joinTest.length
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
