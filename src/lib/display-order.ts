import { queryTable } from '@/egdesk-helpers';
import { DISPLAY_ORDER_FALLBACK } from './display-order-core';
import type { DisplayOrderScope } from './display-order-core';

export * from './display-order-core';

/**
 * 사업소 keys must match the label used in each UI (often 전체사업소-derived strings).
 * Unknown labels sort after configured rows, then ko locale.
 */
export async function loadOfficeOrderMap(): Promise<Map<string, number>> {
  const r = await queryTable('office_display_order', { limit: 100000 });
  const m = new Map<string, number>();
  for (const row of r?.rows || []) {
    const name = String(row?.사업소 ?? '').trim();
    if (!name) continue;
    m.set(name, Number(row?.노출순서 ?? DISPLAY_ORDER_FALLBACK));
  }
  return m;
}

export async function loadTeamOrderMap(scope: DisplayOrderScope): Promise<Map<string, number>> {
  const r = await queryTable('team_display_order', { limit: 100000 });
  const m = new Map<string, number>();
  for (const row of r?.rows || []) {
    if (String(row?.scope ?? '') !== scope) continue;
    const t = String(row?.팀 ?? '').trim();
    if (!t) continue;
    m.set(t, Number(row?.노출순서 ?? DISPLAY_ORDER_FALLBACK));
  }
  return m;
}

/** Keys: `${팀}\t${담당자}` */
export async function loadEmployeeOrderMap(scope: DisplayOrderScope): Promise<Map<string, number>> {
  const r = await queryTable('employee_display_order', { limit: 100000 });
  const m = new Map<string, number>();
  for (const row of r?.rows || []) {
    if (String(row?.scope ?? '') !== scope) continue;
    const team = String(row?.팀 ?? '').trim();
    const emp = String(row?.담당자 ?? '').trim();
    if (!team || !emp) continue;
    m.set(`${team}\t${emp}`, Number(row?.팀내_노출순서 ?? DISPLAY_ORDER_FALLBACK));
  }
  return m;
}

export async function loadAllDisplayOrderMaps(): Promise<{
  teamB2c: Map<string, number>;
  teamB2b: Map<string, number>;
  empB2c: Map<string, number>;
  empB2b: Map<string, number>;
}> {
  const [teamB2c, teamB2b, empB2c, empB2b] = await Promise.all([
    loadTeamOrderMap('b2c'),
    loadTeamOrderMap('b2b'),
    loadEmployeeOrderMap('b2c'),
    loadEmployeeOrderMap('b2b')
  ]);
  return { teamB2c, teamB2b, empB2c, empB2b };
}

/** Office + B2C/B2B team and employee maps — prefer this in API routes (single round-trip). */
export async function loadFullDisplayOrderContext(): Promise<{
  office: Map<string, number>;
  teamB2c: Map<string, number>;
  teamB2b: Map<string, number>;
  empB2c: Map<string, number>;
  empB2b: Map<string, number>;
}> {
  const [office, teamB2c, teamB2b, empB2c, empB2b] = await Promise.all([
    loadOfficeOrderMap(),
    loadTeamOrderMap('b2c'),
    loadTeamOrderMap('b2b'),
    loadEmployeeOrderMap('b2c'),
    loadEmployeeOrderMap('b2b')
  ]);
  return { office, teamB2c, teamB2b, empB2c, empB2b };
}
