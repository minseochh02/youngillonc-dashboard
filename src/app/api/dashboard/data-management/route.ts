import { NextResponse } from 'next/server';
import { executeSQL, insertRows, queryTable, deleteRows, updateRows } from '@/egdesk-helpers';
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
      result = await queryTable('employees', { limit: 10000 });
    } else if (tableName === 'employee_category') {
      const query = `
        SELECT
          ec.id,
          COALESCE(e.사원_담당_코드, ec.담당자) AS 사원코드,
          ec.담당자,
          ec.b2b팀,
          ec.b2b사업소,
          ec.b2b팀별담당,
          ec.b2c_팀,
          ec.b2c사업소,
          ec.전체사업소
        FROM employee_category ec
        LEFT JOIN employees e ON e.사원_담당_명 = ec.담당자
        ORDER BY ec.담당자 ASC
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
    } else if (tableName === 'employee_industries') {
      const query = `
        SELECT DISTINCT
          e.사원_담당_명 AS employee_name,
          ct.산업분류,
          ct.섹터분류
        FROM employees e
        INNER JOIN clients c ON e.사원_담당_코드 = c.담당자코드
        INNER JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
        WHERE ct.산업분류 IS NOT NULL AND ct.산업분류 != ''
        ORDER BY e.사원_담당_명, ct.산업분류
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
    const { tableName, rows, replaceAll } = body;

    if (!tableName || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: 'Table name and rows are required' }, { status: 400 });
    }

    if (rows.length === 0 && !(tableName === 'employee_category' && replaceAll === true)) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Get the list of columns for this table to filter out joined columns
    const tableDef = Object.values(TABLES).find(t => t.name === tableName);
    if (!tableDef) {
      return NextResponse.json({ success: false, error: 'Invalid table name' }, { status: 400 });
    }

    const tableColumns = new Set(tableDef.columns);

    // employee_category updates are keyed by 사원코드 on the UI,
    // but the actual table stores 담당자. Resolve codes to names here.
    let employeeCodeToName = new Map<string, string>();
    if (tableName === 'employee_category') {
      const employeeRows = await queryTable('employees', { limit: 10000 });
      for (const row of employeeRows?.rows || []) {
        const code = String(row?.사원_담당_코드 ?? '').trim();
        const name = String(row?.사원_담당_명 ?? '').trim();
        if (code && name) employeeCodeToName.set(code, name);
      }
    }
    
    // Some columns like 'id' or 'imported_at' might be handled by the DB
    // but we should keep columns that ARE in the table definition.
    // However, columns like '사업소' (aliased) or joined columns should be removed.
    const filteredRows = rows.map((row, index) => {
      const newRow: Record<string, any> = {};
      Object.keys(row).forEach(key => {
        // Special case for '사업소' which we aliased in GET but is '거래처그룹1명' in table
        let targetKey = key;
        if (tableName === 'clients' && key === '사업소') {
          targetKey = '거래처그룹1명';
        }

        if (tableName === 'employee_category' && key === '사원코드') {
          targetKey = '담당자';
        }

        if (tableColumns.has(targetKey)) {
          if (tableName === 'employee_category' && targetKey === '담당자' && key === '사원코드') {
            const code = String(row[key] ?? '').trim();
            const mappedName = employeeCodeToName.get(code);
            const existingName = String(row?.담당자 ?? '').trim();
            // Staged row 담당자 must win over code→name lookup, or edits never persist (GET joins 사원코드).
            newRow[targetKey] = existingName || mappedName || null;
          } else {
            newRow[targetKey] = row[key];
          }
        }
      });

      if (tableName === 'employee_category' && !String(newRow.담당자 ?? '').trim()) {
        const code = String(row?.사원코드 ?? '').trim();
        throw new Error(`employee_category row ${index + 1}: 담당자 매핑 실패 (사원코드: ${code || 'N/A'})`);
      }

      return newRow;
    });

    if (tableName === 'employee_category' && replaceAll === true) {
      // user_data_sql_query is SELECT-only; use delete_rows by id instead of raw DELETE.
      const existing = await queryTable('employee_category', { limit: 100000 });
      const ids = (existing?.rows || [])
        .map((r: Record<string, unknown>) => r.id)
        .filter((id): id is number | string => id != null && id !== '')
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
      const DELETE_CHUNK = 500;
      for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
        await deleteRows('employee_category', { ids: ids.slice(i, i + DELETE_CHUNK) });
      }
      const inserts = filteredRows.map(({ id: _id, ...rest }) => rest);
      if (inserts.length > 0) {
        await insertRows('employee_category', inserts);
      }
    } else if (tableName === 'employee_category') {
      for (const fr of filteredRows) {
        const rawId = fr.id;
        const idNum =
          rawId != null && rawId !== '' && Number.isFinite(Number(rawId)) ? Number(rawId) : NaN;
        if (Number.isFinite(idNum)) {
          const { id: _omitId, ...updates } = fr;
          await updateRows('employee_category', updates, { ids: [idNum] });
        } else {
          const { id: _omitId, ...insertPayload } = fr;
          await insertRows('employee_category', [insertPayload]);
        }
      }
    } else {
      await insertRows(tableName, filteredRows);
    }

    // Keep employees table in sync so employee_category's 사원코드
    // can be resolved by JOIN on subsequent reads.
    if (tableName === 'employee_category') {
      const employeeRowsToUpsert = rows
        .map((row) => {
          const code = String(row?.사원코드 ?? '').trim();
          const name = String(row?.담당자 ?? '').trim();
          if (!code || !name) return null;
          return {
            사원_담당_코드: code,
            사원_담당_명: name,
          };
        })
        .filter((row): row is { 사원_담당_코드: string; 사원_담당_명: string } => row !== null);

      if (employeeRowsToUpsert.length > 0) {
        await insertRows('employees', employeeRowsToUpsert);
      }
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (error: any) {
    console.error('Data Management POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { tableName, deletionFilter } = body;

    if (!tableName || !deletionFilter) {
      return NextResponse.json({ success: false, error: 'Table name and deletion filter are required' }, { status: 400 });
    }

    let normalizedDeletionFilter = deletionFilter;

    // Accept employee_category deletions by 사원코드 as well.
    if (
      tableName === 'employee_category' &&
      deletionFilter?.filters &&
      deletionFilter.filters.사원코드 !== undefined
    ) {
      const employeeRows = await queryTable('employees', { limit: 10000 });
      const codeToName = new Map<string, string>();
      for (const row of employeeRows?.rows || []) {
        const code = String(row?.사원_담당_코드 ?? '').trim();
        const name = String(row?.사원_담당_명 ?? '').trim();
        if (code && name) codeToName.set(code, name);
      }

      const code = String(deletionFilter.filters.사원코드 ?? '').trim();
      const mappedName = codeToName.get(code);
      if (!mappedName) {
        return NextResponse.json(
          { success: false, error: `Unknown 사원코드: ${code}` },
          { status: 400 }
        );
      }

      const { 사원코드, ...restFilters } = deletionFilter.filters;
      normalizedDeletionFilter = {
        ...deletionFilter,
        filters: {
          ...restFilters,
          담당자: mappedName,
        },
      };
    }

    // Delete rows matching the filter
    await deleteRows(tableName, normalizedDeletionFilter);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Data Management DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
