import { NextResponse } from 'next/server';
import { executeSQL, insertRows, queryTable } from '@/egdesk-helpers';
import { TABLES } from '../../../../../egdesk.config';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get('table');

    if (!tableName) {
      return NextResponse.json({ success: false, error: 'Table name is required' }, { status: 400 });
    }

    let result;
    if (tableName === 'employees') {
      const query = `
        SELECT e.사원_담당_코드, e.사원_담당_명, ec.b2b팀, ec.b2b사업소, ec.b2c_팀, ec.전체사업소
        FROM employees e
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        ORDER BY e.사원_담당_명 ASC
      `;
      result = await executeSQL(query);
    } else if (tableName === 'clients') {
      const query = `
        SELECT 
          c.거래처코드, c.거래처명, c.거래처그룹1명 as 사업소, 
          c.업종분류코드, ct.모빌분류, ct.산업분류, ct.영일분류,
          cta.오토_대분류, cta.모빌_대시보드채널,
          c.담당자코드, e.사원_담당_명 as 담당자명
        FROM clients c
        LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
        LEFT JOIN company_type_auto cta ON c.업종분류코드 = cta.업종분류코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        ORDER BY c.거래처명 ASC
      `;
      result = await executeSQL(query);
    } else {
      // Fetch data for other tables
      result = await queryTable(tableName, { limit: 10000 });
    }
    
    return NextResponse.json({
      success: true,
      data: result?.rows || []
    });
  } catch (error: any) {
    console.error('Data Management GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tableName, rows } = body;

    if (!tableName || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: 'Table name and rows are required' }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Get the list of columns for this table to filter out joined columns
    const tableDef = Object.values(TABLES).find(t => t.name === tableName);
    if (!tableDef) {
      return NextResponse.json({ success: false, error: 'Invalid table name' }, { status: 400 });
    }

    const tableColumns = new Set(tableDef.columns);
    
    // Some columns like 'id' or 'imported_at' might be handled by the DB
    // but we should keep columns that ARE in the table definition.
    // However, columns like '사업소' (aliased) or joined columns should be removed.
    const filteredRows = rows.map(row => {
      const newRow: Record<string, any> = {};
      Object.keys(row).forEach(key => {
        // Special case for '사업소' which we aliased in GET but is '거래처그룹1명' in table
        let targetKey = key;
        if (tableName === 'clients' && key === '사업소') {
          targetKey = '거래처그룹1명';
        }

        if (tableColumns.has(targetKey)) {
          newRow[targetKey] = row[key];
        }
      });
      return newRow;
    });

    // Insert rows into the table (insertRows handles upsert if unique keys are defined)
    await insertRows(tableName, filteredRows);
    
    return NextResponse.json({ success: true, count: rows.length });
  } catch (error: any) {
    console.error('Data Management POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
