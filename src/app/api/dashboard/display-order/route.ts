import { NextResponse } from 'next/server';
import { deleteRows, executeSQL, insertRows } from '@/egdesk-helpers';

export type DisplayOrderScope = 'b2c' | 'b2b';

function assertScope(raw: string | null): DisplayOrderScope | null {
  if (raw === 'b2c' || raw === 'b2b') return raw;
  return null;
}

/**
 * GET: merged roster from employee_category + order tables (for admin + clients).
 * POST: replaceTeams | replaceTeamEmployees (delete scope/team slice then insert).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = assertScope(searchParams.get('scope'));
    if (!scope) {
      return NextResponse.json({ success: false, error: 'scope must be b2c or b2b' }, { status: 400 });
    }

    const teamCol = scope === 'b2c' ? 'b2c_팀' : 'b2b팀';

    const teamsQuery = `
      SELECT ec.${teamCol} AS 팀,
        MIN(COALESCE(t.노출순서, 999999)) AS 노출순서
      FROM employee_category ec
      LEFT JOIN team_display_order t ON t.scope = '${scope}' AND t.팀 = ec.${teamCol}
      WHERE ec.${teamCol} IS NOT NULL AND TRIM(ec.${teamCol}) != ''
      GROUP BY ec.${teamCol}
      ORDER BY 노출순서 ASC, 팀 ASC
    `;

    const employeesQuery = `
      SELECT
        ec.${teamCol} AS 팀,
        ec.담당자 AS 담당자,
        COALESCE(e.팀내_노출순서, 999999) AS 팀내_노출순서
      FROM employee_category ec
      LEFT JOIN employee_display_order e
        ON e.scope = '${scope}'
        AND e.팀 = ec.${teamCol}
        AND e.담당자 = ec.담당자
      WHERE ec.${teamCol} IS NOT NULL AND TRIM(ec.${teamCol}) != ''
      ORDER BY 팀 ASC, 팀내_노출순서 ASC, 담당자 ASC
    `;

    const [teamsRes, empRes] = await Promise.all([executeSQL(teamsQuery), executeSQL(employeesQuery)]);

    const teams = (teamsRes?.rows || []).map((r: Record<string, unknown>) => ({
      팀: String(r.팀 ?? ''),
      노출순서: Number(r.노출순서 ?? 999999)
    }));

    const employeesByTeam: Record<string, Array<{ 담당자: string; 팀내_노출순서: number }>> = {};
    for (const row of empRes?.rows || []) {
      const r = row as Record<string, unknown>;
      const 팀 = String(r.팀 ?? '');
      const 담당자 = String(r.담당자 ?? '');
      if (!팀 || !담당자) continue;
      if (!employeesByTeam[팀]) employeesByTeam[팀] = [];
      employeesByTeam[팀].push({
        담당자,
        팀내_노출순서: Number(r.팀내_노출순서 ?? 999999)
      });
    }

    return NextResponse.json({
      success: true,
      scope,
      teams,
      employeesByTeam
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('display-order GET:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action as string;
    const scope = assertScope(body?.scope ?? null);

    if (!scope) {
      return NextResponse.json({ success: false, error: 'scope must be b2c or b2b' }, { status: 400 });
    }

    if (action === 'replaceTeams') {
      const rows = body?.rows as Array<{ 팀: string; 노출순서: number }>;
      if (!Array.isArray(rows)) {
        return NextResponse.json({ success: false, error: 'rows array required' }, { status: 400 });
      }
      await deleteRows('team_display_order', { filters: { scope } });
      const toInsert = rows.map((r, idx) => ({
        scope,
        팀: String(r.팀 ?? '').trim(),
        노출순서: Number(r.노출순서 ?? idx + 1)
      })).filter((r) => r.팀.length > 0);
      if (toInsert.length > 0) {
        await insertRows('team_display_order', toInsert);
      }
      return NextResponse.json({ success: true, count: toInsert.length });
    }

    if (action === 'replaceTeamEmployees') {
      const 팀 = String(body?.팀 ?? '').trim();
      const rows = body?.rows as Array<{ 담당자: string; 팀내_노출순서: number }>;
      if (!팀) {
        return NextResponse.json({ success: false, error: '팀 required' }, { status: 400 });
      }
      if (!Array.isArray(rows)) {
        return NextResponse.json({ success: false, error: 'rows array required' }, { status: 400 });
      }
      await deleteRows('employee_display_order', { filters: { scope, 팀 } });
      const toInsert = rows
        .map((r, idx) => ({
          scope,
          팀,
          담당자: String(r.담당자 ?? '').trim(),
          팀내_노출순서: Number(r.팀내_노출순서 ?? idx + 1)
        }))
        .filter((r) => r.담당자.length > 0);
      if (toInsert.length > 0) {
        await insertRows('employee_display_order', toInsert);
      }
      return NextResponse.json({ success: true, count: toInsert.length });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('display-order POST:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
