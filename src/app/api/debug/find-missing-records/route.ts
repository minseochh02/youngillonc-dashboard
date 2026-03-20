import { NextResponse } from 'next/server';
import { executeSQL } from '@/egdesk-helpers';
import * as XLSX from 'xlsx';
import path from 'path';

export async function GET() {
  try {
    // Read Excel files
    const migrationsPath = path.join(process.cwd(), 'migrations');
    const yeongilPath = path.join(migrationsPath, '2602 판매실적 영일.xlsx');
    const dongbuseobuPath = path.join(migrationsPath, '2602 판매실적 동부-서부.xlsx');

    const yeongilWorkbook = XLSX.readFile(yeongilPath);
    const yeongilSheet = yeongilWorkbook.Sheets[yeongilWorkbook.SheetNames[0]];
    const yeongilData = XLSX.utils.sheet_to_json(yeongilSheet);

    const dongbuseobuWorkbook = XLSX.readFile(dongbuseobuPath);
    const dongbuSheet = dongbuseobuWorkbook.Sheets['동부'];
    const seobuSheet = dongbuseobuWorkbook.Sheets['서부'];
    const dongbuData = XLSX.utils.sheet_to_json(dongbuSheet);
    const seobuData = XLSX.utils.sheet_to_json(seobuSheet);

    // Fetch all database records for Feb 2026
    const dbQuery = `
      SELECT
        '영일' as source,
        일자, 거래처코드, 품목코드, 중량, 합계, 수량
      FROM sales
      WHERE substr(일자, 1, 7) = '2026-02'
      UNION ALL
      SELECT
        '동부' as source,
        일자, 거래처코드, 품목코드, 중량, 합계, 수량
      FROM east_division_sales
      WHERE substr(일자, 1, 7) = '2026-02'
      UNION ALL
      SELECT
        '서부' as source,
        일자, 거래처코드, 품목코드, 중량, 합계, 수량
      FROM west_division_sales
      WHERE substr(일자, 1, 7) = '2026-02'
    `;

    const dbResult = await executeSQL(dbQuery);
    const dbRecords = dbResult?.rows || [];

    // Create a unique key for each record
    function createKey(record: any, source: string) {
      // Normalize date format
      let date = record['일자'] || record.일자;
      if (date) {
        date = date.toString().replace(/\//g, '-').substring(0, 10);
      }

      const clientCode = record['거래처코드'] || record.거래처코드;
      const itemCode = record['품목코드'] || record.품목코드;
      const weight = String(record['중량'] || record.중량 || '').replace(/,/g, '');
      const amount = String(record['합계'] || record['합 계'] || record.합계 || '').replace(/,/g, '');
      const quantity = String(record['수량'] || record.수량 || '').replace(/,/g, '');

      return `${source}|${date}|${clientCode}|${itemCode}|${weight}|${amount}|${quantity}`;
    }

    // Build Excel record map
    const excelMap = new Map();
    yeongilData.forEach((record: any) => {
      const key = createKey(record, '영일');
      excelMap.set(key, { source: '영일', record });
    });

    dongbuData.forEach((record: any) => {
      const key = createKey(record, '동부');
      excelMap.set(key, { source: '동부', record });
    });

    seobuData.forEach((record: any) => {
      const key = createKey(record, '서부');
      excelMap.set(key, { source: '서부', record });
    });

    // Build DB record map
    const dbMap = new Map();
    dbRecords.forEach((record: any) => {
      const key = createKey(record, record.source);
      dbMap.set(key, { source: record.source, record });
    });

    // Find records in Excel but not in DB
    const missingInDB: any[] = [];
    for (const [key, value] of excelMap) {
      if (!dbMap.has(key)) {
        missingInDB.push({ key, ...(value as any) });
      }
    }

    // Find records in DB but not in Excel
    const missingInExcel: any[] = [];
    for (const [key, value] of dbMap) {
      if (!excelMap.has(key)) {
        missingInExcel.push({ key, ...(value as any) });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        excel_total_records: excelMap.size,
        database_total_records: dbMap.size,
        missing_in_db: missingInDB.length,
        missing_in_excel: missingInExcel.length
      },
      missing_in_database: missingInDB.slice(0, 20).map(item => ({
        source: item.source,
        일자: item.record['일자'],
        거래처코드: item.record['거래처코드'],
        품목코드: item.record['품목코드'],
        중량: item.record['중량'],
        합계: item.record['합계'] || item.record['합 계']
      })),
      missing_in_excel: missingInExcel.slice(0, 20).map(item => ({
        source: item.source,
        일자: item.record.일자,
        거래처코드: item.record.거래처코드,
        품목코드: item.record.품목코드,
        중량: item.record.중량,
        합계: item.record.합계
      }))
    });
  } catch (error: any) {
    console.error('Find missing records error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
