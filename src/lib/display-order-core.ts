/** Pure sort helpers + JSON maps — safe to import from client components (no DB). */

/** Matches SQL COALESCE(..., 999999) fallback in consumers */
export const DISPLAY_ORDER_FALLBACK = 999999;

/**
 * Mirrors `BRANCH_FROM_EMPLOYEE_CATEGORY_SQL` in closing-meeting (and related APIs).
 * `office_display_order.사업소` is often raw 전체사업소 (e.g. 경남사업소) while UI/API use short labels (창원).
 */
export function normalizeBranchFromEmployeeCategory(전체사업소: string | null | undefined): string {
  const raw = String(전체사업소 ?? '').trim();
  if (!raw) return '';
  if (raw === '벤츠') return 'MB';
  if (raw === '경남사업소') return '창원';
  if (raw.includes('화성')) return '화성';
  if (raw.includes('남부')) return '남부';
  if (raw.includes('중부')) return '중부';
  if (raw.includes('서부')) return '서부';
  if (raw.includes('동부')) return '동부';
  if (raw.includes('제주')) return '제주';
  if (raw.includes('부산')) return '부산';
  if (raw.includes('본부')) return '본부';
  return raw.replace(/사업소/g, '').replace(/지사/g, '');
}

export type DisplayOrderScope = 'b2c' | 'b2b';

export function mapToRecord(m: Map<string, number>): Record<string, number> {
  const o: Record<string, number> = {};
  m.forEach((v, k) => {
    o[k] = v;
  });
  return o;
}

export function recordToMap(rec: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(rec));
}

export function officeSortKey(officeName: string, officeMap: Map<string, number>): number {
  const normalized = normalizeBranchFromEmployeeCategory(officeName);
  return (
    officeMap.get(officeName) ??
    (normalized ? officeMap.get(normalized) : undefined) ??
    DISPLAY_ORDER_FALLBACK
  );
}

export function compareOffices(a: string, b: string, officeMap: Map<string, number>): number {
  const ka = officeSortKey(a, officeMap);
  const kb = officeSortKey(b, officeMap);
  if (ka !== kb) return ka - kb;
  return a.localeCompare(b, 'ko');
}

/** Prefer B2C order when present, else B2B (mixed dashboards). */
export function teamSortKey(teamName: string, teamB2c: Map<string, number>, teamB2b: Map<string, number>): number {
  return teamB2c.get(teamName) ?? teamB2b.get(teamName) ?? DISPLAY_ORDER_FALLBACK;
}

export function employeeSortKey(
  teamName: string,
  employeeName: string,
  empB2c: Map<string, number>,
  empB2b: Map<string, number>
): number {
  const k = `${teamName}\t${employeeName}`;
  return empB2c.get(k) ?? empB2b.get(k) ?? DISPLAY_ORDER_FALLBACK;
}

export function compareTeams(
  a: string,
  b: string,
  teamB2c: Map<string, number>,
  teamB2b: Map<string, number>
): number {
  const ka = teamSortKey(a, teamB2c, teamB2b);
  const kb = teamSortKey(b, teamB2c, teamB2b);
  if (ka !== kb) return ka - kb;
  return a.localeCompare(b, 'ko');
}

export function compareEmployees(
  teamName: string,
  empA: string,
  empB: string,
  empB2c: Map<string, number>,
  empB2b: Map<string, number>
): number {
  const ka = employeeSortKey(teamName, empA, empB2c, empB2b);
  const kb = employeeSortKey(teamName, empB, empB2c, empB2b);
  if (ka !== kb) return ka - kb;
  return empA.localeCompare(empB, 'ko');
}
