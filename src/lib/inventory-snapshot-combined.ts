/**
 * Combined 2025-12-31 ESZ018R snapshots: 영일 + 서부 + 동부.
 * Replaces legacy `inventory` and `esz018r_6` reads in dashboard SQL.
 */

export const SNAPSHOT_IMPORTED_AT = '2025-12-31';

export const TABLE_YOUNGIL_SNAPSHOT = 'youngil_inventory_20251231';
export const TABLE_WEST_SNAPSHOT = 'west_inventory_20251231';
export const TABLE_EAST_SNAPSHOT = 'east_inventory_20251231';

/** Per-table filter so future multi-date imports do not mix. */
const SNAP_WHERE = `DATE(imported_at) = DATE('${SNAPSHOT_IMPORTED_AT}')`;

/**
 * Parenthesized UNION of the three snapshot tables (same columns).
 * Alias in SQL is caller's responsibility, e.g. `FROM (${combined...}) inv`.
 */
export function combinedInventoryUnionSql(): string {
  return `
    SELECT 품목코드, 창고코드, 재고수량, 중량, 총중량, imported_at
    FROM ${TABLE_YOUNGIL_SNAPSHOT}
    WHERE ${SNAP_WHERE}
    UNION ALL
    SELECT 품목코드, 창고코드, 재고수량, 중량, 총중량, imported_at
    FROM ${TABLE_WEST_SNAPSHOT}
    WHERE ${SNAP_WHERE}
    UNION ALL
    SELECT 품목코드, 창고코드, 재고수량, 중량, 총중량, imported_at
    FROM ${TABLE_EAST_SNAPSHOT}
    WHERE ${SNAP_WHERE}
  `.trim();
}

/** Dedupe (품목코드, 창고코드) across snapshots — use if double-counting appears. */
export function combinedInventoryDedupedSql(): string {
  const u = combinedInventoryUnionSql();
  return `
    SELECT 품목코드, 창고코드,
      SUM(재고수량) AS 재고수량,
      MAX(중량) AS 중량,
      SUM(총중량) AS 총중량,
      MAX(imported_at) AS imported_at
    FROM (${u})
    GROUP BY 품목코드, 창고코드
  `.trim();
}

/** inv + items + warehouses — same join pattern as dashboard inventory routes. */
export function combinedInventorySnapshotJoinFromSql(): string {
  return `
FROM (${combinedInventoryUnionSql()}) inv
LEFT JOIN items p ON inv.품목코드 = p.품목코드
LEFT JOIN warehouses w ON inv.창고코드 = w.창고코드 OR CAST(inv.창고코드 AS TEXT) = CAST(w.창고코드 AS TEXT)
  `.trim();
}

/** Item display name expression (replaces inventory.품목명_규격_). */
export const snapshotItemNameExpr = `(TRIM(COALESCE(p.품목명, '')) || ' ' || TRIM(COALESCE(p.규격정보, '')))`;
