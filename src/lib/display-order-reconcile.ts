import { queryTable } from '@/egdesk-helpers';
import { normalizeBranchFromEmployeeCategory } from './display-order-core';

/** Same exclusions as `scripts/seed-office-display-order-from-employee-category.ts` */
const EXCLUDED_OFFICES = new Set(['동부&서부']);

export function splitOfficeValuesFromEmployeeCategory(value: unknown): string[] {
  if (value == null) return [];
  const text = String(value).trim();
  if (!text) return [];
  return text
    .split(/[\/,|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '-' && !EXCLUDED_OFFICES.has(part));
}

export type ChannelDisplayOrderReconcile = {
  teams: { missing: string[]; orphan: string[] };
  employees: { missing: Array<{ 팀: string; 담당자: string }>; orphan: Array<{ 팀: string; 담당자: string }> };
};

export type DisplayOrderReconcileReport = {
  generatedAt: string;
  offices: {
    canonFromEmployeeCategory: string[];
    keysInOfficeDisplayOrder: string[];
    missingInDisplayOrder: string[];
    orphanInDisplayOrder: string[];
  };
  b2c: ChannelDisplayOrderReconcile;
  b2b: ChannelDisplayOrderReconcile;
};

function koSort(a: string, b: string) {
  return a.localeCompare(b, 'ko');
}

function sortEmpPairs(pairs: Array<{ 팀: string; 담당자: string }>) {
  return [...pairs].sort((x, y) => koSort(x.팀, y.팀) || koSort(x.담당자, y.담당자));
}

function parseTeamTabEmp(k: string): { 팀: string; 담당자: string } {
  const i = k.indexOf('\t');
  if (i <= 0) return { 팀: k, 담당자: '' };
  return { 팀: k.slice(0, i), 담당자: k.slice(i + 1) };
}

function reconcileChannelInner(
  ecTeams: Set<string>,
  ecEmp: Set<string>,
  ordTeams: Set<string>,
  ordEmp: Set<string>
): ChannelDisplayOrderReconcile {
  const missingTeams = [...ecTeams].filter((t) => !ordTeams.has(t)).sort(koSort);
  const orphanTeams = [...ordTeams].filter((t) => !ecTeams.has(t)).sort(koSort);

  const missingEmp: Array<{ 팀: string; 담당자: string }> = [];
  const orphanEmp: Array<{ 팀: string; 담당자: string }> = [];
  for (const k of ecEmp) {
    if (!ordEmp.has(k)) {
      missingEmp.push(parseTeamTabEmp(k));
    }
  }
  for (const k of ordEmp) {
    if (!ecEmp.has(k)) {
      orphanEmp.push(parseTeamTabEmp(k));
    }
  }

  return {
    teams: { missing: missingTeams, orphan: orphanTeams },
    employees: { missing: sortEmpPairs(missingEmp), orphan: sortEmpPairs(orphanEmp) },
  };
}

/**
 * Compare `employee_category` to `office_display_order` and team/employee order tables.
 * - **missing**: exists in EC but no display-order row that resolves to the same normalized office / same 팀·담당자.
 * - **orphan**: row in display-order whose normalized key (offices) or 팀 (teams) no longer appears in EC.
 */
export async function buildDisplayOrderReconcileReport(): Promise<DisplayOrderReconcileReport> {
  const [ecRes, officeRes, teamOrdRes, empOrdRes] = await Promise.all([
    queryTable('employee_category', { limit: 100000 }),
    queryTable('office_display_order', { limit: 100000 }),
    queryTable('team_display_order', { limit: 100000 }),
    queryTable('employee_display_order', { limit: 100000 }),
  ]);

  const ecRows: Array<Record<string, unknown>> = ecRes?.rows || [];

  const ecCanon = new Set<string>();
  for (const row of ecRows) {
    for (const part of splitOfficeValuesFromEmployeeCategory(row['전체사업소'])) {
      const n = normalizeBranchFromEmployeeCategory(part);
      if (n) ecCanon.add(n);
    }
  }

  const orderOfficeKeys: string[] = [];
  for (const row of officeRes?.rows || []) {
    const k = String(row?.사업소 ?? '').trim();
    if (k) orderOfficeKeys.push(k);
  }
  const orderResolved = new Set(orderOfficeKeys.map((k) => normalizeBranchFromEmployeeCategory(k)));

  const canonSorted = [...ecCanon].sort(koSort);
  const keysSorted = [...new Set(orderOfficeKeys)].sort(koSort);
  const missingOffices = [...ecCanon].filter((c) => !orderResolved.has(c)).sort(koSort);
  const orphanOffices = orderOfficeKeys.filter((k) => !ecCanon.has(normalizeBranchFromEmployeeCategory(k)));
  const orphanOfficesUnique = [...new Set(orphanOffices)].sort(koSort);

  const teamByScope = (scope: string) => {
    const s = new Set<string>();
    for (const row of teamOrdRes?.rows || []) {
      if (String(row?.scope ?? '') !== scope) continue;
      const t = String(row?.팀 ?? '').trim();
      if (t) s.add(t);
    }
    return s;
  };

  const empByScope = (scope: string) => {
    const s = new Set<string>();
    for (const row of empOrdRes?.rows || []) {
      if (String(row?.scope ?? '') !== scope) continue;
      const 팀 = String(row?.팀 ?? '').trim();
      const 담당자 = String(row?.담당자 ?? '').trim();
      if (팀 && 담당자) s.add(`${팀}\t${담당자}`);
    }
    return s;
  };

  const ecB2cTeams = new Set<string>();
  const ecB2cEmp = new Set<string>();
  const ecB2bTeams = new Set<string>();
  const ecB2bEmp = new Set<string>();

  for (const row of ecRows) {
    const 담당자 = String(row['담당자'] ?? '').trim();
    const b2c = String(row['b2c_팀'] ?? '').trim();
    const b2b = String(row['b2b팀'] ?? '').trim();
    if (b2c) {
      ecB2cTeams.add(b2c);
      if (담당자) ecB2cEmp.add(`${b2c}\t${담당자}`);
    }
    if (b2b) {
      ecB2bTeams.add(b2b);
      if (담당자) ecB2bEmp.add(`${b2b}\t${담당자}`);
    }
  }

  const b2c = reconcileChannelInner(ecB2cTeams, ecB2cEmp, teamByScope('b2c'), empByScope('b2c'));
  const b2b = reconcileChannelInner(ecB2bTeams, ecB2bEmp, teamByScope('b2b'), empByScope('b2b'));

  return {
    generatedAt: new Date().toISOString(),
    offices: {
      canonFromEmployeeCategory: canonSorted,
      keysInOfficeDisplayOrder: keysSorted,
      missingInDisplayOrder: missingOffices,
      orphanInDisplayOrder: orphanOfficesUnique,
    },
    b2c,
    b2b,
  };
}
