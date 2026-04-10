/**
 * INSERT-only seed: missing team/employee order rows get stable ko alphabetical defaults.
 * Does not update existing 노출순서 / 팀내_노출순서.
 * Run: npm run seed-display-order
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { insertRows, queryTable } from '../egdesk-helpers.ts';

function koSort(a: string, b: string) {
  return a.localeCompare(b, 'ko');
}

async function existingTeamKeys(scope: string): Promise<Set<string>> {
  const r = await queryTable('team_display_order', { limit: 100000 });
  const set = new Set<string>();
  for (const row of r?.rows || []) {
    if (String(row?.scope ?? '') === scope && row?.팀 != null) {
      set.add(String(row.팀).trim());
    }
  }
  return set;
}

async function maxTeamOrder(scope: string): Promise<number> {
  const r = await queryTable('team_display_order', { limit: 100000 });
  let m = 0;
  for (const row of r?.rows || []) {
    if (String(row?.scope ?? '') !== scope) continue;
    const n = Number(row?.노출순서 ?? 0);
    if (!Number.isNaN(n)) m = Math.max(m, n);
  }
  return m;
}

async function existingEmployeeKeys(scope: string): Promise<Set<string>> {
  const r = await queryTable('employee_display_order', { limit: 100000 });
  const set = new Set<string>();
  for (const row of r?.rows || []) {
    if (String(row?.scope ?? '') === scope && row?.팀 != null && row?.담당자 != null) {
      set.add(`${String(row.팀).trim()}\t${String(row.담당자).trim()}`);
    }
  }
  return set;
}

async function maxEmpOrderForTeam(scope: string, 팀: string): Promise<number> {
  const r = await queryTable('employee_display_order', { limit: 100000 });
  let m = 0;
  for (const row of r?.rows || []) {
    if (String(row?.scope ?? '') !== scope || String(row?.팀 ?? '').trim() !== 팀) continue;
    const n = Number(row?.팀내_노출순서 ?? 0);
    if (!Number.isNaN(n)) m = Math.max(m, n);
  }
  return m;
}

async function seedScope(scope: 'b2c' | 'b2b', teamCol: 'b2c_팀' | 'b2b팀') {
  const ec = await queryTable('employee_category', { limit: 100000 });
  const rows: Array<Record<string, unknown>> = ec?.rows || [];

  const teamSet = new Set<string>();
  const teamEmployees = new Map<string, Set<string>>();

  for (const row of rows) {
    const team = String(row[teamCol] ?? '').trim();
    const name = String(row['담당자'] ?? '').trim();
    if (!team || !name) continue;
    teamSet.add(team);
    if (!teamEmployees.has(team)) teamEmployees.set(team, new Set());
    teamEmployees.get(team)!.add(name);
  }

  const haveTeam = await existingTeamKeys(scope);
  const teamsToAdd = [...teamSet].filter((t) => !haveTeam.has(t)).sort(koSort);
  const startOrder = await maxTeamOrder(scope);

  const teamRows = teamsToAdd.map((팀, i) => ({
    scope,
    팀,
    노출순서: startOrder + i + 1
  }));

  if (teamRows.length > 0) {
    console.log(`[${scope}] inserting ${teamRows.length} new team_display_order rows`);
    await insertRows('team_display_order', teamRows);
  } else {
    console.log(`[${scope}] no new team_display_order rows`);
  }

  const haveEmp = await existingEmployeeKeys(scope);
  const empInserts: Array<{ scope: string; 팀: string; 담당자: string; 팀내_노출순서: number }> = [];

  const sortedTeams = [...teamEmployees.keys()].sort(koSort);
  for (const 팀 of sortedTeams) {
    const names = [...teamEmployees.get(팀)!].sort(koSort);
    const missing = names.filter((담당자) => !haveEmp.has(`${팀}\t${담당자}`));
    if (missing.length === 0) continue;
    let base = await maxEmpOrderForTeam(scope, 팀);
    missing.forEach((담당자, idx) => {
      empInserts.push({
        scope,
        팀,
        담당자,
        팀내_노출순서: base + idx + 1
      });
    });
  }

  if (empInserts.length > 0) {
    console.log(`[${scope}] inserting ${empInserts.length} new employee_display_order rows`);
    await insertRows('employee_display_order', empInserts);
  } else {
    console.log(`[${scope}] no new employee_display_order rows`);
  }
}

async function main() {
  await seedScope('b2c', 'b2c_팀');
  await seedScope('b2b', 'b2b팀');
  console.log('✅ seed-display-order done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
