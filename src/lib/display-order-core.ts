/** Pure sort helpers + JSON maps — safe to import from client components (no DB). */

/** Matches SQL COALESCE(..., 999999) fallback in consumers */
export const DISPLAY_ORDER_FALLBACK = 999999;

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
  return officeMap.get(officeName) ?? DISPLAY_ORDER_FALLBACK;
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
