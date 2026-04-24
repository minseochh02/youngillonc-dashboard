/**
 * Rebuild month-end computed inventory by category.
 *
 * 기준:
 * - 기준 스냅샷: 2025-12-31 (youngil/west/east_inventory_20251231 합산)
 * - 월말 재고(카테고리별):
 *   - snapshot 이후 월: snapshot + 누적(매입 - 매출)
 *   - snapshot 이전 월: snapshot - 역누적(매입 - 매출)
 *
 * Run:
 *   npx tsx scripts/rebuild-computed-inventory-monthly.ts
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

import {
  createTable,
  deleteRows,
  executeSQL,
  insertRows,
  queryTable,
} from '../egdesk-helpers';
import {
  SNAPSHOT_IMPORTED_AT,
  combinedInventoryUnionSql,
} from '../src/lib/inventory-snapshot-combined';
import { sqlPurchaseExcludedClientPredicate } from '../src/lib/special-handling-employees';

const TABLE_NAME = 'computed_inventory_monthly';
const DISPLAY_NAME = 'computed 재고(월말)';
const SNAPSHOT_MONTH = SNAPSHOT_IMPORTED_AT.slice(0, 7); // 2025-12
const CATEGORIES = ['MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL', '기타'] as const;

type Category = (typeof CATEGORIES)[number];

function categoryExpr(alias: string): string {
  return `
    CASE
      WHEN ${alias}.품목그룹1코드 = 'MB' THEN 'MB'
      WHEN ${alias}.품목그룹1코드 = 'AVI' THEN 'AVI'
      WHEN ${alias}.품목그룹1코드 = 'MAR' THEN 'MAR'
      WHEN ${alias}.품목그룹1코드 = 'PVL' THEN 'PVL'
      WHEN ${alias}.품목그룹1코드 = 'CVL' THEN 'CVL'
      WHEN ${alias}.품목그룹1코드 = 'IL' THEN 'IL'
      ELSE '기타'
    END
  `;
}

function monthEndDate(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ensureCategory(v: string): Category {
  if ((CATEGORIES as readonly string[]).includes(v)) return v as Category;
  return '기타';
}

async function ensureTable(): Promise<void> {
  try {
    await executeSQL(`SELECT 1 FROM ${TABLE_NAME} LIMIT 1`);
    return;
  } catch {
    // create
  }

  await createTable(
    DISPLAY_NAME,
    [
      { name: 'month', type: 'TEXT', notNull: true },
      { name: 'month_end_date', type: 'DATE', notNull: true },
      { name: 'category', type: 'TEXT', notNull: true },
      { name: 'purchase_weight', type: 'REAL', notNull: true },
      { name: 'sales_weight', type: 'REAL', notNull: true },
      { name: 'net_weight', type: 'REAL', notNull: true },
      { name: 'inventory_weight', type: 'REAL', notNull: true },
      { name: 'snapshot_month', type: 'TEXT', notNull: true },
      { name: 'snapshot_date', type: 'DATE', notNull: true },
      { name: 'computed_at', type: 'DATE' },
    ],
    {
      tableName: TABLE_NAME,
      description: '카테고리별 월말 계산재고 (스냅샷 기반)',
      uniqueKeyColumns: ['month', 'category'],
      duplicateAction: 'update',
    }
  );
}

async function clearTable(): Promise<void> {
  const pageSize = 500;
  let offset = 0;
  while (true) {
    const res = await queryTable(TABLE_NAME, {
      limit: pageSize,
      offset,
      orderBy: 'id',
      orderDirection: 'ASC',
    });
    const rows = res?.rows || [];
    if (rows.length === 0) break;
    const ids = rows.map((r: any) => Number(r.id)).filter((id: number) => Number.isFinite(id));
    if (ids.length > 0) {
      await deleteRows(TABLE_NAME, { ids });
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
}

async function main() {
  await ensureTable();
  await clearTable();

  const snapshotSql = `
    SELECT
      ${categoryExpr('i')} as category,
      SUM(CAST(COALESCE(inv.총중량, 0) AS NUMERIC)) as snapshot_weight
    FROM (${combinedInventoryUnionSql()}) inv
    LEFT JOIN items i ON inv.품목코드 = i.품목코드
    GROUP BY 1
  `;
  const snapshotRes = await executeSQL(snapshotSql);
  const snapshotMap = new Map<Category, number>();
  for (const c of CATEGORIES) snapshotMap.set(c, 0);
  (snapshotRes?.rows || []).forEach((r: any) => {
    snapshotMap.set(ensureCategory(String(r.category)), Number(r.snapshot_weight) || 0);
  });

  const purchaseMonthlySql = `
    SELECT
      substr(p.일자, 1, 7) as month,
      ${categoryExpr('p')} as category,
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as purchase_weight
    FROM (
      SELECT p.일자, i.품목그룹1코드, p.중량
      FROM purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      WHERE ${sqlPurchaseExcludedClientPredicate('p.거래처코드')}
    ) p
    WHERE p.일자 IS NOT NULL AND p.일자 != '' AND LENGTH(p.일자) >= 7
    GROUP BY 1, 2
  `;
  const salesMonthlySql = `
    SELECT
      substr(s.일자, 1, 7) as month,
      ${categoryExpr('s')} as category,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
    FROM (
      SELECT s.일자, i.품목그룹1코드, s.중량
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      UNION ALL
      SELECT s.일자, i.품목그룹1코드, s.중량
      FROM east_division_sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      UNION ALL
      SELECT s.일자, i.품목그룹1코드, s.중량
      FROM west_division_sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
    ) s
    WHERE s.일자 IS NOT NULL AND s.일자 != '' AND LENGTH(s.일자) >= 7
    GROUP BY 1, 2
  `;

  const [purRes, salesRes] = await Promise.all([executeSQL(purchaseMonthlySql), executeSQL(salesMonthlySql)]);

  const monthSet = new Set<string>([SNAPSHOT_MONTH]);
  const purchaseByMonthCat = new Map<string, number>();
  const salesByMonthCat = new Map<string, number>();
  const netByMonthCat = new Map<string, number>();
  const key = (m: string, c: Category) => `${m}\t${c}`;

  for (const row of purRes?.rows || []) {
    const m = String(row.month);
    const c = ensureCategory(String(row.category));
    const w = Number(row.purchase_weight) || 0;
    monthSet.add(m);
    purchaseByMonthCat.set(key(m, c), w);
  }
  for (const row of salesRes?.rows || []) {
    const m = String(row.month);
    const c = ensureCategory(String(row.category));
    const w = Number(row.sales_weight) || 0;
    monthSet.add(m);
    salesByMonthCat.set(key(m, c), w);
  }

  const months = Array.from(monthSet).sort();
  const snapshotIdx = months.indexOf(SNAPSHOT_MONTH);
  if (snapshotIdx < 0) {
    throw new Error(`Snapshot month ${SNAPSHOT_MONTH} missing from month list`);
  }

  for (const m of months) {
    for (const c of CATEGORIES) {
      const pur = purchaseByMonthCat.get(key(m, c)) || 0;
      const sales = salesByMonthCat.get(key(m, c)) || 0;
      netByMonthCat.set(key(m, c), pur - sales);
    }
  }

  const rowsToInsert: Array<Record<string, any>> = [];
  const now = new Date().toISOString().slice(0, 10);

  for (const c of CATEGORIES) {
    const prefix: number[] = [];
    let running = 0;
    for (const m of months) {
      running += netByMonthCat.get(key(m, c)) || 0;
      prefix.push(running);
    }

    const snapshot = snapshotMap.get(c) || 0;
    const pSnap = prefix[snapshotIdx] || 0;

    months.forEach((m, i) => {
      const pur = purchaseByMonthCat.get(key(m, c)) || 0;
      const sales = salesByMonthCat.get(key(m, c)) || 0;
      const net = netByMonthCat.get(key(m, c)) || 0;
      const inv = snapshot + ((prefix[i] || 0) - pSnap);

      rowsToInsert.push({
        month: m,
        month_end_date: monthEndDate(m),
        category: c,
        purchase_weight: pur,
        sales_weight: sales,
        net_weight: net,
        inventory_weight: inv,
        snapshot_month: SNAPSHOT_MONTH,
        snapshot_date: SNAPSHOT_IMPORTED_AT,
        computed_at: now,
      });
    });
  }

  const batchSize = 300;
  for (let i = 0; i < rowsToInsert.length; i += batchSize) {
    await insertRows(TABLE_NAME, rowsToInsert.slice(i, i + batchSize));
  }

  console.log(
    JSON.stringify(
      {
        table: TABLE_NAME,
        rowsInserted: rowsToInsert.length,
        months: months.length,
        categories: CATEGORIES.length,
        snapshotMonth: SNAPSHOT_MONTH,
        snapshotDate: SNAPSHOT_IMPORTED_AT,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
