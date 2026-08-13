import {
  executeSQL,
  insertRows,
  queryTable,
  deleteRows,
  createTable,
} from '@/egdesk-helpers';
import {
  SNAPSHOT_IMPORTED_AT,
  combinedInventoryUnionSql,
} from '@/lib/inventory-snapshot-combined';
import {
  sqlMeetingPurchaseIncludedClientPredicate,
  sqlAndEmployeeNotSpecialHandling,
  sqlAndSalesRemarkNotExact,
} from '@/lib/special-handling-employees';

const TABLE_NAME = 'computed_inventory_monthly';
const DISPLAY_NAME = 'computed 재고(월말)';
const SNAPSHOT_MONTH = SNAPSHOT_IMPORTED_AT.slice(0, 7); // 2025-12
export const CATEGORIES = ['MB', 'AVI', 'MAR', 'PVL', 'CVL', 'IL', '기타'] as const;

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

/** qty × spec (L stripped) — same as daily inventory sheet */
function weightFromQtyAndSpec(qtyCol: string, specCol: string): string {
  return `CAST(REPLACE(${qtyCol}, ',', '') AS NUMERIC) * CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${specCol}, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC)`;
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
      { name: 'internal_use_weight', type: 'REAL', notNull: true, defaultValue: 0 },
      { name: 'disposed_weight', type: 'REAL', notNull: true, defaultValue: 0 },
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

function getPriorMonth(monthStr: string): string {
  let [y, m] = monthStr.split('-').map(Number);
  m--;
  if (m === 0) {
    m = 12;
    y--;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function getMonthsRange(start: string, end: string): string[] {
  const list: string[] = [];
  let [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (sy < ey || (sy === ey && sm <= em)) {
    list.push(`${sy}-${String(sm).padStart(2, '0')}`);
    sm++;
    if (sm > 12) {
      sm = 1;
      sy++;
    }
  }
  return list;
}

async function deleteComputedInventoryFrom(fromMonth: string): Promise<void> {
  const query = `SELECT id FROM ${TABLE_NAME} WHERE month >= '${fromMonth}'`;
  const res = await executeSQL(query);
  const rows = res?.rows || [];
  const ids = rows.map((r: any) => Number(r.id)).filter((id: number) => Number.isFinite(id));
  
  const batchSize = 300;
  for (let i = 0; i < ids.length; i += batchSize) {
    await deleteRows(TABLE_NAME, { ids: ids.slice(i, i + batchSize) });
  }
}

/**
 * Rebuilds the computed_inventory_monthly table.
 * This is optimized to support incremental rebuild from a given month.
 */
export async function rebuildComputedInventoryMonthly(fromMonth?: string) {
  await ensureTable();

  const isValidMonth = typeof fromMonth === 'string' && /^\d{4}-\d{2}$/.test(fromMonth);
  const isPartialRebuild = isValidMonth && fromMonth! > SNAPSHOT_MONTH;

  if (isPartialRebuild) {
    // -------------------------------------------------------------
    // PARTIAL REBUILD LOGIC (Incremental)
    // -------------------------------------------------------------
    const startMonth = fromMonth!;
    const priorMonth = getPriorMonth(startMonth);
    const priorRes = await executeSQL(`
      SELECT category, inventory_weight
      FROM ${TABLE_NAME}
      WHERE month = '${priorMonth}'
    `);
    const priorRows = priorRes?.rows || [];

    if (priorRows.length === CATEGORIES.length) {
      const startingInventory = new Map<Category, number>();
      for (const c of CATEGORIES) startingInventory.set(c, 0);
      priorRows.forEach((r: any) => {
        startingInventory.set(ensureCategory(String(r.category)), Number(r.inventory_weight) || 0);
      });

      await deleteComputedInventoryFrom(startMonth);

      const dateFilterClause = `AND p.일자 >= '${startMonth}-01'`;
      const purchaseMonthlySql = `
        SELECT
          substr(p.일자, 1, 7) as month,
          ${categoryExpr('p')} as category,
          SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as purchase_weight
        FROM (
          SELECT p.일자, i.품목그룹1코드, p.중량, p.거래처코드
          FROM purchases p
          LEFT JOIN items i ON p.품목코드 = i.품목코드
          WHERE ${sqlMeetingPurchaseIncludedClientPredicate('p.거래처코드')}
        ) p
        WHERE p.일자 IS NOT NULL AND p.일자 != '' AND LENGTH(p.일자) >= 7
          ${dateFilterClause}
        GROUP BY 1, 2
      `;

      const salesDateFilterClause = `AND s.일자 >= '${startMonth}-01'`;
      const salesMonthlySql = `
        SELECT
          substr(s.일자, 1, 7) as month,
          ${categoryExpr('s')} as category,
          SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as sales_weight
        FROM (
          SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, i.품목그룹1코드
          FROM sales s
          LEFT JOIN items i ON s.품목코드 = i.품목코드
          UNION ALL
          SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, i.품목그룹1코드
          FROM east_division_sales s
          LEFT JOIN items i ON s.품목코드 = i.품목코드
          UNION ALL
          SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, i.품목그룹1코드
          FROM west_division_sales s
          LEFT JOIN items i ON s.품목코드 = i.품목코드
        ) s
        LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
        LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
        WHERE s.일자 IS NOT NULL AND s.일자 != '' AND LENGTH(s.일자) >= 7
          ${sqlAndEmployeeNotSpecialHandling()}
          ${sqlAndSalesRemarkNotExact('s.적요')}
          ${salesDateFilterClause}
        GROUP BY 1, 2
      `;

      const internalUseDateFilterClause = `AND u.month_date >= '${startMonth}-01'`;
      const internalUseMonthlySql = `
        SELECT
          substr(u.month_date, 1, 7) as month,
          ${categoryExpr('u')} as category,
          SUM(u.weight) as internal_use_weight
        FROM (
          SELECT u.일자 as month_date, i.품목그룹1코드, CAST(REPLACE(u.중량, ',', '') AS NUMERIC) as weight
          FROM internal_uses u
          LEFT JOIN items i ON u.품목코드 = i.품목코드
          UNION ALL
          SELECT u.월_일 as month_date, i.품목그룹1코드, ${weightFromQtyAndSpec('u.수량', 'i.규격정보')} as weight
          FROM east_internal_uses u
          LEFT JOIN items i ON u.품목코드 = i.품목코드
          UNION ALL
          SELECT u.월_일 as month_date, i.품목그룹1코드, ${weightFromQtyAndSpec('u.수량', 'i.규격정보')} as weight
          FROM west_internal_uses u
          LEFT JOIN items i ON u.품목코드 = i.품목코드
        ) u
        WHERE u.month_date IS NOT NULL AND u.month_date != '' AND LENGTH(u.month_date) >= 7
          ${internalUseDateFilterClause}
        GROUP BY 1, 2
      `;

      const disposedDateFilterClause = `AND d.month_date >= '${startMonth}-01'`;
      const disposedMonthlySql = `
        SELECT
          substr(d.month_date, 1, 7) as month,
          ${categoryExpr('d')} as category,
          SUM(d.weight) as disposed_weight
        FROM (
          SELECT d.일자 as month_date, i.품목그룹1코드, ${weightFromQtyAndSpec('d.수량', 'i.규격정보')} as weight
          FROM disposed_inventory d
          LEFT JOIN items i ON d.품목코드 = i.품목코드
          UNION ALL
          SELECT d.일자 as month_date, i.품목그룹1코드, CAST(REPLACE(d.중량, ',', '') AS NUMERIC) as weight
          FROM east_disposed_inventory d
          LEFT JOIN items i ON d.품목코드 = i.품목코드
        ) d
        WHERE d.month_date IS NOT NULL AND d.month_date != '' AND LENGTH(d.month_date) >= 7
          ${disposedDateFilterClause}
        GROUP BY 1, 2
      `;

      const [purRes, salesRes, internalRes, disposedRes] = await Promise.all([
        executeSQL(purchaseMonthlySql),
        executeSQL(salesMonthlySql),
        executeSQL(internalUseMonthlySql),
        executeSQL(disposedMonthlySql),
      ]);

      const purchaseByMonthCat = new Map<string, number>();
      const salesByMonthCat = new Map<string, number>();
      const internalUseByMonthCat = new Map<string, number>();
      const disposedByMonthCat = new Map<string, number>();
      const key = (m: string, c: Category) => `${m}\t${c}`;

      for (const row of purRes?.rows || []) {
        const m = String(row.month);
        const c = ensureCategory(String(row.category));
        purchaseByMonthCat.set(key(m, c), Number(row.purchase_weight) || 0);
      }
      for (const row of salesRes?.rows || []) {
        const m = String(row.month);
        const c = ensureCategory(String(row.category));
        salesByMonthCat.set(key(m, c), Number(row.sales_weight) || 0);
      }
      for (const row of internalRes?.rows || []) {
        const m = String(row.month);
        const c = ensureCategory(String(row.category));
        internalUseByMonthCat.set(key(m, c), Number(row.internal_use_weight) || 0);
      }
      for (const row of disposedRes?.rows || []) {
        const m = String(row.month);
        const c = ensureCategory(String(row.category));
        disposedByMonthCat.set(key(m, c), Number(row.disposed_weight) || 0);
      }

      let maxMonth = startMonth;
      const checkMax = (rows: any[]) => {
        rows.forEach((r) => {
          if (r.month && String(r.month) > maxMonth) {
            maxMonth = String(r.month);
          }
        });
      };
      checkMax(purRes?.rows || []);
      checkMax(salesRes?.rows || []);
      checkMax(internalRes?.rows || []);
      checkMax(disposedRes?.rows || []);

      const months = getMonthsRange(startMonth, maxMonth);

      const currentInventory = new Map<Category, number>(startingInventory);
      const rowsToInsert: Array<Record<string, any>> = [];
      const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

      months.forEach((m) => {
        for (const c of CATEGORIES) {
          const pur = purchaseByMonthCat.get(key(m, c)) || 0;
          const sales = salesByMonthCat.get(key(m, c)) || 0;
          const internalUse = internalUseByMonthCat.get(key(m, c)) || 0;
          const disposed = disposedByMonthCat.get(key(m, c)) || 0;
          const net = pur - sales - internalUse - disposed;

          const prevInv = currentInventory.get(c) || 0;
          const inv = prevInv + net;
          currentInventory.set(c, inv);

          rowsToInsert.push({
            month: m,
            month_end_date: monthEndDate(m),
            category: c,
            purchase_weight: pur,
            sales_weight: sales,
            internal_use_weight: internalUse,
            disposed_weight: disposed,
            net_weight: net,
            inventory_weight: inv,
            snapshot_month: SNAPSHOT_MONTH,
            snapshot_date: SNAPSHOT_IMPORTED_AT,
            computed_at: now,
          });
        }
      });

      const batchSize = 300;
      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        await insertRows(TABLE_NAME, rowsToInsert.slice(i, i + batchSize));
      }

      return {
        table: TABLE_NAME,
        rowsInserted: rowsToInsert.length,
        months: months.length,
        categories: CATEGORIES.length,
        snapshotMonth: SNAPSHOT_MONTH,
        snapshotDate: SNAPSHOT_IMPORTED_AT,
        isIncremental: true,
      };
    } else {
      console.warn(`[computed-inventory-utils] Prior month ${priorMonth} data incomplete or missing. Falling back to full rebuild.`);
    }
  }

  // -------------------------------------------------------------
  // FULL REBUILD LOGIC (Original backwards/forwards computation)
  // -------------------------------------------------------------
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
      SELECT p.일자, i.품목그룹1코드, p.중량, p.거래처코드
      FROM purchases p
      LEFT JOIN items i ON p.품목코드 = i.품목코드
      WHERE ${sqlMeetingPurchaseIncludedClientPredicate('p.거래처코드')}
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
      SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, i.품목그룹1코드
      FROM sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      UNION ALL
      SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, i.품목그룹1코드
      FROM east_division_sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
      UNION ALL
      SELECT s.일자, s.품목코드, s.중량, s.적요, s.거래처코드, i.품목그룹1코드
      FROM west_division_sales s
      LEFT JOIN items i ON s.품목코드 = i.품목코드
    ) s
    LEFT JOIN clients c ON s.거래처코드 = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    WHERE s.일자 IS NOT NULL AND s.일자 != '' AND LENGTH(s.일자) >= 7
      ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
    GROUP BY 1, 2
  `;

  const internalUseMonthlySql = `
    SELECT
      substr(u.month_date, 1, 7) as month,
      ${categoryExpr('u')} as category,
      SUM(u.weight) as internal_use_weight
    FROM (
      SELECT u.일자 as month_date, i.품목그룹1코드, CAST(REPLACE(u.중량, ',', '') AS NUMERIC) as weight
      FROM internal_uses u
      LEFT JOIN items i ON u.품목코드 = i.품목코드
      UNION ALL
      SELECT u.월_일 as month_date, i.품목그룹1코드, ${weightFromQtyAndSpec('u.수량', 'i.규격정보')} as weight
      FROM east_internal_uses u
      LEFT JOIN items i ON u.품목코드 = i.품목코드
      UNION ALL
      SELECT u.월_일 as month_date, i.품목그룹1코드, ${weightFromQtyAndSpec('u.수량', 'i.규격정보')} as weight
      FROM west_internal_uses u
      LEFT JOIN items i ON u.품목코드 = i.품목코드
    ) u
    WHERE u.month_date IS NOT NULL AND u.month_date != '' AND LENGTH(u.month_date) >= 7
    GROUP BY 1, 2
  `;

  const disposedMonthlySql = `
    SELECT
      substr(d.month_date, 1, 7) as month,
      ${categoryExpr('d')} as category,
      SUM(d.weight) as disposed_weight
    FROM (
      SELECT d.일자 as month_date, i.품목그룹1코드, ${weightFromQtyAndSpec('d.수량', 'i.규격정보')} as weight
      FROM disposed_inventory d
      LEFT JOIN items i ON d.품목코드 = i.품목코드
      UNION ALL
      SELECT d.일자 as month_date, i.품목그룹1코드, CAST(REPLACE(d.중량, ',', '') AS NUMERIC) as weight
      FROM east_disposed_inventory d
      LEFT JOIN items i ON d.품목코드 = i.품목코드
    ) d
    WHERE d.month_date IS NOT NULL AND d.month_date != '' AND LENGTH(d.month_date) >= 7
    GROUP BY 1, 2
  `;

  const [purRes, salesRes, internalRes, disposedRes] = await Promise.all([
    executeSQL(purchaseMonthlySql),
    executeSQL(salesMonthlySql),
    executeSQL(internalUseMonthlySql),
    executeSQL(disposedMonthlySql),
  ]);

  const monthSet = new Set<string>([SNAPSHOT_MONTH]);
  const purchaseByMonthCat = new Map<string, number>();
  const salesByMonthCat = new Map<string, number>();
  const internalUseByMonthCat = new Map<string, number>();
  const disposedByMonthCat = new Map<string, number>();
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
  for (const row of internalRes?.rows || []) {
    const m = String(row.month);
    const c = ensureCategory(String(row.category));
    const w = Number(row.internal_use_weight) || 0;
    monthSet.add(m);
    internalUseByMonthCat.set(key(m, c), w);
  }
  for (const row of disposedRes?.rows || []) {
    const m = String(row.month);
    const c = ensureCategory(String(row.category));
    const w = Number(row.disposed_weight) || 0;
    monthSet.add(m);
    disposedByMonthCat.set(key(m, c), w);
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
      const internalUse = internalUseByMonthCat.get(key(m, c)) || 0;
      const disposed = disposedByMonthCat.get(key(m, c)) || 0;
      netByMonthCat.set(key(m, c), pur - sales - internalUse - disposed);
    }
  }

  const rowsToInsert: Array<Record<string, any>> = [];
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
      const internalUse = internalUseByMonthCat.get(key(m, c)) || 0;
      const disposed = disposedByMonthCat.get(key(m, c)) || 0;
      const net = netByMonthCat.get(key(m, c)) || 0;
      const inv = snapshot + ((prefix[i] || 0) - pSnap);

      rowsToInsert.push({
        month: m,
        month_end_date: monthEndDate(m),
        category: c,
        purchase_weight: pur,
        sales_weight: sales,
        internal_use_weight: internalUse,
        disposed_weight: disposed,
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

  return {
    table: TABLE_NAME,
    rowsInserted: rowsToInsert.length,
    months: months.length,
    categories: CATEGORIES.length,
    snapshotMonth: SNAPSHOT_MONTH,
    snapshotDate: SNAPSHOT_IMPORTED_AT,
    isIncremental: false,
  };
}

const DAILY_TABLE_NAME = 'computed_inventory_daily';
const DAILY_DISPLAY_NAME = '일별 계산재고 (Daily Rollup)';

export async function ensureDailyTable(): Promise<void> {
  try {
    await executeSQL(`SELECT 1 FROM ${DAILY_TABLE_NAME} LIMIT 1`);
    return;
  } catch {
    // create
  }

  await createTable(
    DAILY_DISPLAY_NAME,
    [
      { name: 'date', type: 'TEXT', notNull: true },
      { name: 'branch_source', type: 'TEXT', notNull: true },
      { name: 'warehouse_code', type: 'TEXT', notNull: true },
      { name: 'category', type: 'TEXT', notNull: true },
      { name: 'tier', type: 'TEXT', notNull: true },
      { name: 'beginning', type: 'REAL', notNull: true },
      { name: 'beginning_weight', type: 'REAL', notNull: true },
      { name: 'purchase', type: 'REAL', notNull: true },
      { name: 'purchase_weight', type: 'REAL', notNull: true },
      { name: 'transfer_in', type: 'REAL', notNull: true },
      { name: 'transfer_in_weight', type: 'REAL', notNull: true },
      { name: 'sales', type: 'REAL', notNull: true },
      { name: 'sales_weight', type: 'REAL', notNull: true },
      { name: 'transfer_out', type: 'REAL', notNull: true },
      { name: 'transfer_out_weight', type: 'REAL', notNull: true },
      { name: 'internal_use', type: 'REAL', notNull: true },
      { name: 'internal_use_weight', type: 'REAL', notNull: true },
      { name: 'disposed', type: 'REAL', notNull: true },
      { name: 'disposed_weight', type: 'REAL', notNull: true },
      { name: 'adjustment', type: 'REAL', notNull: true },
      { name: 'adjustment_weight', type: 'REAL', notNull: true },
      { name: 'ending', type: 'REAL', notNull: true },
      { name: 'ending_weight', type: 'REAL', notNull: true },
      { name: 'computed_at', type: 'TEXT' },
    ],
    {
      tableName: DAILY_TABLE_NAME,
      description: '일별 계산재고 rollup (스냅샷/트랜잭션 기반)',
      uniqueKeyColumns: ['date', 'branch_source', 'warehouse_code', 'category', 'tier'],
      duplicateAction: 'update',
    }
  );
}

function getDailyRange(start: string, end: string): string[] {
  const list: string[] = [];
  let [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  
  let curr = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  
  while (curr <= last) {
    const yyyy = curr.getUTCFullYear();
    const mm = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(curr.getUTCDate()).padStart(2, '0');
    list.push(`${yyyy}-${mm}-${dd}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return list;
}

export async function rebuildComputedInventoryDaily(fromDate?: string) {
  await ensureDailyTable();

  const start = Date.now();
  const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  
  // Calculate default yesterday as end date for rebuild
  const yesterdayObj = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().slice(0, 10);

  const startBuildDate = fromDate || '2026-01-01';
  const isIncremental = startBuildDate > '2026-01-01';

  console.log(`Starting rebuild-computed-inventory-daily from ${startBuildDate} to ${yesterdayStr}...`);

  const dates = getDailyRange(startBuildDate, yesterdayStr);

  // Clear existing daily rows for rebuild range
  for (const date of dates) {
    await deleteRows(DAILY_TABLE_NAME, { filters: { date } });
  }

  const vehicleExclusionList = "'10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '32', '33', '34', '36', '37', '38', '40', '41', '42', '45', '52', '56', '57', '58', '59'";

  const categoryCase = (colPrefix: string) => `
    CASE
      WHEN ${colPrefix}.품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
      WHEN ${colPrefix}.품목그룹1코드 = 'IL' THEN 'IL'
      WHEN ${colPrefix}.품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
      ELSE 'Others'
    END
  `;

  const tierCase = (colPrefix: string) => `
    CASE
      WHEN ${colPrefix}.품목그룹1코드 IN ('MB', 'AVI') THEN 'All'
      WHEN ${colPrefix}.품목그룹3코드 = 'FLA' THEN 'Flagship'
      ELSE 'Others'
    END
  `;

  const fullWidthSlash = String.fromCharCode(0xff0f);

  const weightCalc = (qtyCol: string, specCol: string) => `
    CAST(REPLACE(${qtyCol}, ',', '') AS NUMERIC) * (
      CASE 
        WHEN ${specCol} LIKE '%/%' OR ${specCol} LIKE '%${fullWidthSlash}%' THEN
          CAST(REPLACE(REPLACE(REPLACE(REPLACE(SUBSTR(${specCol}, 1, INSTR(REPLACE(${specCol}, '${fullWidthSlash}', '/'), '/') - 1), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
          CAST(REPLACE(REPLACE(REPLACE(REPLACE(SUBSTR(${specCol}, INSTR(REPLACE(${specCol}, '${fullWidthSlash}', '/'), '/') + 1), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC)
        ELSE
          CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${specCol}, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC)
      END
    ) *
    CASE 
      WHEN ${specCol} LIKE '%G%' AND ${specCol} NOT LIKE '%KG%' AND ${specCol} NOT LIKE '%GL%' THEN 0.001
      WHEN ${specCol} LIKE '%ML%' THEN 0.001
      ELSE 1.0
    END
  `;

  const hqWhFilter = (column: string) => `
    (CAST(${column} AS TEXT) IN ('02', '2', '03', '3', '05', '5', '06', '6', '09', '9', '42', '50', '51', '54', 'P1', 'P2', 'P3', 'P4'))
  `;

  const excludeVehiclesFilter = (column: string) => `
    (CAST(${column} AS TEXT) NOT IN (${vehicleExclusionList}))
  `;
  const excludeVehiclesJoinFilter = (whAlias: string) => `
    (${whAlias}.창고코드 IS NULL OR CAST(${whAlias}.창고코드 AS TEXT) NOT IN (${vehicleExclusionList}))
  `;

  const colIpgo = String.fromCharCode(0xc785, 0xace0, 0xcc3d, 0xace0, 0xba85); // 입고창고명
  const colChulgo = String.fromCharCode(0xcd9c, 0xace0, 0xcc3d, 0xace0, 0xba85); // 출고창고명

  // Determine starting stock
  const allCombos = new Set<string>();
  const runningStock = new Map<string, { qty: number; weight: number }>();

  if (isIncremental) {
    // Look up prior day ending inventory
    const priorDayObj = new Date(new Date(startBuildDate).getTime() - 24 * 60 * 60 * 1000);
    const priorDayStr = priorDayObj.toISOString().slice(0, 10);
    console.log(`Incremental load: fetching ending stock for prior date ${priorDayStr}...`);
    
    const priorRes = await executeSQL(`
      SELECT branch_source, warehouse_code, category, tier, ending, ending_weight
      FROM ${DAILY_TABLE_NAME}
      WHERE date = '${priorDayStr}'
    `);
    
    for (const r of priorRes?.rows || []) {
      const combo = `${r.branch_source}|${r.warehouse_code}|${r.category}|${r.tier}`;
      allCombos.add(combo);
      runningStock.set(combo, { qty: Number(r.ending) || 0, weight: Number(r.ending_weight) || 0 });
    }
  } else {
    // Load baseline snapshot from 2025-12-31
    console.log('Full rebuild: loading 2025-12-31 starting snapshot...');
    const snapSql = `
      SELECT 
        branch_source, warehouse_code, category, tier, 
        SUM(qty) as qty, 
        SUM(weight) as weight
      FROM (
        -- HQ Snapshot
        SELECT 
          'HQ' as branch_source,
          CAST(inv.창고코드 AS TEXT) as warehouse_code,
          ${categoryCase('i')} as category, 
          ${tierCase('i')} as tier,
          CASE WHEN inv.품목코드 = '4454042-R' AND inv.창고코드 IN ('P2', '05') THEN 0 ELSE CAST(REPLACE(inv.재고수량, ',', '') AS NUMERIC) END as qty, 
          ${weightCalc(
            `CASE WHEN inv.품목코드 = '4454042-R' AND inv.창고코드 IN ('P2', '05') THEN '0' ELSE inv.재고수량 END`,
            'i.규격정보'
          )} as weight
        FROM youngil_inventory_20251231 inv
        LEFT JOIN items i ON inv.품목코드 = i.품목코드
        WHERE (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${hqWhFilter('inv.창고코드')}

        UNION ALL

        -- East Snapshot
        SELECT 
          'East' as branch_source,
          CAST(inv.창고코드 AS TEXT) as warehouse_code,
          ${categoryCase('i')} as category, 
          ${tierCase('i')} as tier,
          CAST(REPLACE(inv.재고수량, ',', '') AS NUMERIC) as qty, 
          ${weightCalc('inv.재고수량', 'i.규격정보')} as weight
        FROM east_inventory_20251231 inv
        LEFT JOIN items i ON inv.품목코드 = i.품목코드
        WHERE (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${excludeVehiclesFilter('inv.창고코드')}

        UNION ALL

        -- West Snapshot
        SELECT 
          'West' as branch_source,
          CAST(inv.창고코드 AS TEXT) as warehouse_code,
          ${categoryCase('i')} as category, 
          ${tierCase('i')} as tier,
          CAST(REPLACE(inv.재고수량, ',', '') AS NUMERIC) as qty, 
          ${weightCalc('inv.재고수량', 'i.규격정보')} as weight
        FROM west_inventory_20251231 inv
        LEFT JOIN items i ON inv.품목코드 = i.품목코드
        WHERE (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외')
          AND ${excludeVehiclesFilter('inv.창고코드')}
      )
      GROUP BY branch_source, warehouse_code, category, tier
    `;
    const snapRes = await executeSQL(snapSql);
    for (const r of snapRes.rows) {
      const combo = `${r.branch_source}|${r.warehouse_code}|${r.category}|${r.tier}`;
      allCombos.add(combo);
      runningStock.set(combo, { qty: Number(r.qty) || 0, weight: Number(r.weight) || 0 });
    }
  }

  // Load transactions for the target range
  console.log(`Loading transaction logs from ${startBuildDate} to ${yesterdayStr}...`);
  const txSql = `
    SELECT 
      일자, branch_source, warehouse_code, category, tier,
      SUM(purchase_qty) as purchase_qty, SUM(purchase_w) as purchase_w,
      SUM(transfer_in_qty) as transfer_in_qty, SUM(transfer_in_w) as transfer_in_w,
      SUM(sales_qty) as sales_qty, SUM(sales_w) as sales_w,
      SUM(transfer_out_qty) as transfer_out_qty, SUM(transfer_out_w) as transfer_out_w,
      SUM(internal_use_qty) as internal_use_qty, SUM(internal_use_w) as internal_use_w,
      SUM(disposed_qty) as disposed_qty, SUM(disposed_w) as disposed_w,
      SUM(adjustment_qty) as adjustment_qty, SUM(adjustment_w) as adjustment_w
    FROM (
      -- 1. HQ Sales
      SELECT 
        s.일자, 'HQ' as branch_source, CAST(s.출하창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as sales_qty, ${weightCalc('s.수량', 'i.규격정보')} as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM sales s LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE s.일자 >= '${startBuildDate}' AND s.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('s.출하창고코드')}

      UNION ALL

      -- 2. East Sales
      SELECT 
        s.일자, 'East' as branch_source, CAST(s.출하창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as sales_qty, ${weightCalc('s.수량', 'i.규격정보')} as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM east_division_sales s LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE s.일자 >= '${startBuildDate}' AND s.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('s.출하창고코드')}

      UNION ALL

      -- 3. West Sales
      SELECT 
        s.일자, 'West' as branch_source, CAST(s.출하창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        CAST(REPLACE(s.수량, ',', '') AS NUMERIC) as sales_qty, ${weightCalc('s.수량', 'i.규격정보')} as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM west_division_sales s LEFT JOIN items i ON s.품목코드 = i.품목코드
      WHERE s.일자 >= '${startBuildDate}' AND s.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('s.출하창고코드')}

      UNION ALL

      -- 4. HQ Purchases
      SELECT 
        p.일자, 'HQ' as branch_source, CAST(p.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        CAST(REPLACE(p.수량, ',', '') AS NUMERIC) as purchase_qty, ${weightCalc('p.수량', 'i.규격정보')} as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM purchases p LEFT JOIN items i ON p.품목코드 = i.품목코드
      WHERE p.일자 >= '${startBuildDate}' AND p.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('p.창고코드')}

      UNION ALL

      -- 5. East Purchases
      SELECT 
        p.일자, 'East' as branch_source, CAST(p.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        CAST(REPLACE(p.수량, ',', '') AS NUMERIC) as purchase_qty, ${weightCalc('p.수량', 'i.규격정보')} as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM east_division_purchases p LEFT JOIN items i ON p.품목코드 = i.품목코드
      WHERE p.일자 >= '${startBuildDate}' AND p.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('p.창고코드')}

      UNION ALL

      -- 6. West Purchases
      SELECT 
        p.일자, 'West' as branch_source, CAST(p.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        CAST(REPLACE(p.수량, ',', '') AS NUMERIC) as purchase_qty, ${weightCalc('p.수량', 'i.규격정보')} as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM west_division_purchases p LEFT JOIN items i ON p.품목코드 = i.품목코드
      WHERE p.일자 >= '${startBuildDate}' AND p.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('p.창고코드')}

      UNION ALL

      -- 7. HQ Internal Uses
      SELECT 
        u.일자, 'HQ' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        CAST(REPLACE(u.수량, ',', '') AS NUMERIC) as internal_use_qty, ${weightCalc('u.수량', 'i.규격정보')} as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM internal_uses u 
      LEFT JOIN items i ON u.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON u.창고명 = w.창고명
      WHERE u.일자 >= '${startBuildDate}' AND u.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('w.창고코드')}

      UNION ALL

      -- 8. East Internal Uses
      SELECT 
        u.월_일, 'East' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        CAST(REPLACE(u.수량, ',', '') AS NUMERIC) as internal_use_qty, ${weightCalc('u.수량', 'i.규격정보')} as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM east_internal_uses u 
      LEFT JOIN items i ON u.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON u.창고명 = w.창고명
      WHERE u.월_일 >= '${startBuildDate}' AND u.월_일 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesJoinFilter('w')}

      UNION ALL

      -- 9. West Internal Uses
      SELECT 
        u.월_일, 'West' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        CAST(REPLACE(u.수량, ',', '') AS NUMERIC) as internal_use_qty, ${weightCalc('u.수량', 'i.규격정보')} as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM west_internal_uses u 
      LEFT JOIN items i ON u.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON u.창고명 = w.창고명
      WHERE u.월_일 >= '${startBuildDate}' AND u.월_일 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesJoinFilter('w')}

      UNION ALL

      -- 10. HQ Transfers In
      SELECT 
        t.일자, 'HQ' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_in_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM inventory_transfer t 
      LEFT JOIN items i ON t.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON t.[${colIpgo}] = w.창고명
      WHERE t.일자 >= '${startBuildDate}' AND t.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('w.창고코드')}

      UNION ALL

      -- 11. HQ Transfers Out
      SELECT 
        t.일자, 'HQ' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_out_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM inventory_transfer t 
      LEFT JOIN items i ON t.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON t.[${colChulgo}] = w.창고명
      WHERE t.일자 >= '${startBuildDate}' AND t.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('w.창고코드')}

      UNION ALL

      -- 12. East Transfers In
      SELECT 
        t.일자, 'East' as branch_source, '02' as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_in_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM east_inventory_transfers t
      LEFT JOIN items i ON t.품목명_규격 = i.품목명 || ' [' || i.규격정보 || ']'
        OR (t.품목명_규격 = 'MOBIL 1 SYNTHETIC LV ATF HP CTN 6X1L [1/6]' AND i.품목코드 = '140618')
        OR (t.품목명_규격 = 'M SUP TP SMART PLUS PRO 0W20 CTN1LX12:KR [1/12]' AND i.품목코드 = '143207')
      LEFT JOIN warehouses w ON t.입고창고명 = w.창고명
      WHERE t.일자 >= '${startBuildDate}' AND t.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND w.창고코드 = '02'

      UNION ALL

      -- 13. East Transfers Out
      SELECT 
        t.일자, 'East' as branch_source, '02' as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_out_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM east_inventory_transfers t
      LEFT JOIN items i ON t.품목명_규격 = i.품목명 || ' [' || i.규격정보 || ']'
        OR (t.품목명_규격 = 'MOBIL 1 SYNTHETIC LV ATF HP CTN 6X1L [1/6]' AND i.품목코드 = '140618')
        OR (t.품목명_규격 = 'M SUP TP SMART PLUS PRO 0W20 CTN1LX12:KR [1/12]' AND i.품목코드 = '143207')
      LEFT JOIN warehouses w ON t.출고창고명 = w.창고명
      WHERE t.일자 >= '${startBuildDate}' AND t.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND w.창고코드 = '02'

      UNION ALL

      -- 14. West Transfers In
      SELECT 
        t.일자, 'West' as branch_source, '03' as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_in_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM west_internal_transfers t
      LEFT JOIN items i ON t."품목명_규격_" = i.품목명 || ' [' || i.규격정보 || ']'
        OR (t."품목명_규격_" = 'MOBIL 1 SYNTHETIC LV ATF HP CTN 6X1L [1/6]' AND i.품목코드 = '140618')
        OR (t."품목명_규격_" = 'M SUP TP SMART PLUS PRO 0W20 CTN1LX12:KR [1/12]' AND i.품목코드 = '143207')
      LEFT JOIN warehouses w ON t.입고창고명 = w.창고명
      WHERE t.일자 >= '${startBuildDate}' AND t.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND w.창고코드 = '03'

      UNION ALL

      -- 15. West Transfers Out
      SELECT 
        t.일자, 'West' as branch_source, '03' as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        CAST(REPLACE(t.수량, ',', '') AS NUMERIC) as transfer_out_qty, ${weightCalc('t.수량', 'i.규격정보')} as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM west_internal_transfers t
      LEFT JOIN items i ON t."품목명_규격_" = i.품목명 || ' [' || i.규격정보 || ']'
        OR (t."품목명_규격_" = 'MOBIL 1 SYNTHETIC LV ATF HP CTN 6X1L [1/6]' AND i.품목코드 = '140618')
        OR (t."품목명_규격_" = 'M SUP TP SMART PLUS PRO 0W20 CTN1LX12:KR [1/12]' AND i.품목코드 = '143207')
      LEFT JOIN warehouses w ON t.출고창고명 = w.창고명
      WHERE t.일자 >= '${startBuildDate}' AND t.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND w.창고코드 = '03'

      -- 16. HQ Production Inbound
      UNION ALL
      SELECT 
        pm.일자, 'HQ' as branch_source, CAST(pm.format_wh AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        CAST(REPLACE(pm.생산수량, ',', '') AS NUMERIC) as purchase_qty, 
        CAST(REPLACE(pm.생산수량, ',', '') AS NUMERIC) * 
        CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(i.규격정보, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
        CASE 
          WHEN i.규격정보 LIKE '%G%' AND i.규격정보 NOT LIKE '%KG%' AND i.규격정보 NOT LIKE '%GL%' THEN 0.001
          WHEN i.규격정보 LIKE '%ML%' THEN 0.001
          ELSE 1.0
        END as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM (
        SELECT 일자, 생산품목코드, 생산수량,
          CASE WHEN 입고창고코드 GLOB '*[0-9]*' AND length(입고창고코드) = 1 THEN '0' || 입고창고코드 ELSE 입고창고코드 END as format_wh
        FROM production_material_consumption
      ) pm LEFT JOIN items i ON pm.생산품목코드 = i.품목코드
      WHERE pm.일자 >= '${startBuildDate}' AND pm.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('pm.format_wh')}

      -- 17. HQ Production Outbound
      UNION ALL
      SELECT 
        pm.일자, 'HQ' as branch_source, CAST(pm.format_wh AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        CAST(REPLACE(pm.실제소모수량, ',', '') AS NUMERIC) as internal_use_qty, 
        CAST(REPLACE(pm.실제소모수량, ',', '') AS NUMERIC) * 
        CAST(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(i.규격정보, '0'), 'L', ''), 'KL', ''), 'kg', ''), ',', '') AS NUMERIC) *
        CASE 
          WHEN i.규격정보 LIKE '%G%' AND i.규격정보 NOT LIKE '%KG%' AND i.규격정보 NOT LIKE '%GL%' THEN 0.001
          WHEN i.규격정보 LIKE '%ML%' THEN 0.001
          ELSE 1.0
        END as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM (
        SELECT 일자, 소모품목코드, 실제소모수량,
          CASE 
            WHEN 출고창고코드 = 'P2' THEN '05'
            WHEN 출고창고코드 = 'P3' THEN '06'
            WHEN 출고창고코드 = 'P4' THEN '05'
            WHEN 출고창고코드 GLOB '*[0-9]*' AND length(출고창고코드) = 1 THEN '0' || 출고창고코드
            ELSE  출고창고코드 
          END as format_wh
        FROM production_material_consumption
      ) pm LEFT JOIN items i ON pm.소모품목코드 = i.품목코드
      WHERE pm.일자 >= '${startBuildDate}' AND pm.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('pm.format_wh')}

      -- 18. HQ Disposed
      UNION ALL
      SELECT 
        d.일자, 'HQ' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        CAST(REPLACE(d.수량, ',', '') AS NUMERIC) as disposed_qty, ${weightCalc('d.수량', 'i.규격정보')} as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM disposed_inventory d 
      LEFT JOIN items i ON d.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON d.창고명 = w.창고명
      WHERE d.일자 >= '${startBuildDate}' AND d.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('w.창고코드')}

      -- 19. East Disposed
      UNION ALL
      SELECT 
        d.일자, 'East' as branch_source, CAST(COALESCE(w.창고코드, d.창고코드) AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        CAST(REPLACE(d.수량, ',', '') AS NUMERIC) as disposed_qty, ${weightCalc('d.수량', 'i.규격정보')} as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM east_disposed_inventory d 
      LEFT JOIN items i ON d.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON d.창고코드 = w.창고코드 OR CAST(d.창고코드 AS TEXT) = CAST(w.창고코드 AS TEXT)
      WHERE d.일자 >= '${startBuildDate}' AND d.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesJoinFilter('w')}

      -- 20. West Disposed
      UNION ALL
      SELECT 
        d.일자, 'West' as branch_source, CAST(w.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        CAST(REPLACE(d.수량, ',', '') AS NUMERIC) as disposed_qty, ${weightCalc('d.수량', 'i.규격정보')} as disposed_w,
        0 as adjustment_qty, 0 as adjustment_w
      FROM west_disposed_inventory d 
      LEFT JOIN items i ON d.품목코드 = i.품목코드
      LEFT JOIN warehouses w ON d.창고명 = w.창고명
      WHERE d.일자 >= '${startBuildDate}' AND d.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesJoinFilter('w')}

      -- 21. East Adjustments
      UNION ALL
      SELECT 
        adj.일자, 'East' as branch_source, CAST(adj.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        CAST(REPLACE(adj.조정수량, ',', '') AS NUMERIC) as adjustment_qty, ${weightCalc('adj.조정수량', 'i.규격정보')} as adjustment_w
      FROM east_inventory_adjustments adj LEFT JOIN items i ON adj.품목코드 = i.품목코드
      WHERE adj.일자 >= '${startBuildDate}' AND adj.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('adj.창고코드')}

      -- 22. West Adjustments
      UNION ALL
      SELECT 
        adj.일자, 'West' as branch_source, CAST(adj.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        CAST(REPLACE(adj.조정수량, ',', '') AS NUMERIC) as adjustment_qty, ${weightCalc('adj.조정수량', 'i.규격정보')} as adjustment_w
      FROM west_inventory_adjustments adj LEFT JOIN items i ON adj.품목코드 = i.품목코드
      WHERE adj.일자 >= '${startBuildDate}' AND adj.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${excludeVehiclesFilter('adj.창고코드')}

      UNION ALL

      -- 23. HQ Adjustments
      SELECT 
        adj.일자, 'HQ' as branch_source, CAST(adj.창고코드 AS TEXT) as warehouse_code, ${categoryCase('i')} as category, ${tierCase('i')} as tier,
        0 as purchase_qty, 0 as purchase_w,
        0 as transfer_in_qty, 0 as transfer_in_w,
        0 as sales_qty, 0 as sales_w,
        0 as transfer_out_qty, 0 as transfer_out_w,
        0 as internal_use_qty, 0 as internal_use_w,
        0 as disposed_qty, 0 as disposed_w,
        CAST(REPLACE(adj.조정수량, ',', '') AS NUMERIC) as adjustment_qty, ${weightCalc('adj.조정수량', 'i.규격정보')} as adjustment_w
      FROM inventory_adjustments adj LEFT JOIN items i ON adj.품목코드 = i.품목코드
      WHERE adj.일자 >= '${startBuildDate}' AND adj.일자 <= '${yesterdayStr}' AND (i.재고수량관리 IS NULL OR i.재고수량관리 != '수량관리제외') AND ${hqWhFilter('adj.창고코드')}
    )
    GROUP BY 일자, branch_source, warehouse_code, category, tier
  `;
  const txRes = await executeSQL(txSql);

  const dailyTxMap = new Map<string, any>();
  for (const r of txRes.rows) {
    const k = `${r.일자}|${r.branch_source}|${r.warehouse_code}|${r.category}|${r.tier}`;
    dailyTxMap.set(k, r);
  }

  for (const r of txRes.rows) {
    allCombos.add(`${r.branch_source}|${r.warehouse_code}|${r.category}|${r.tier}`);
  }

  const rowsToInsert: any[] = [];

  for (const date of dates) {
    for (const combo of allCombos) {
      const [branch_source, warehouse_code, category, tier] = combo.split('|');
      const startStock = runningStock.get(combo) || { qty: 0, weight: 0 };

      const tx = dailyTxMap.get(`${date}|${branch_source}|${warehouse_code}|${category}|${tier}`) || {
        purchase_qty: 0, purchase_w: 0,
        transfer_in_qty: 0, transfer_in_w: 0,
        sales_qty: 0, sales_w: 0,
        transfer_out_qty: 0, transfer_out_w: 0,
        internal_use_qty: 0, internal_use_w: 0,
        disposed_qty: 0, disposed_w: 0,
        adjustment_qty: 0, adjustment_w: 0
      };

      const beginning = startStock.qty;
      const beginning_weight = startStock.weight;

      const purchase = Number(tx.purchase_qty) || 0;
      const purchase_weight = Number(tx.purchase_w) || 0;
      const transfer_in = Number(tx.transfer_in_qty) || 0;
      const transfer_in_weight = Number(tx.transfer_in_w) || 0;
      const sales = Number(tx.sales_qty) || 0;
      const sales_weight = Number(tx.sales_w) || 0;
      const transfer_out = Number(tx.transfer_out_qty) || 0;
      const transfer_out_weight = Number(tx.transfer_out_w) || 0;
      const internal_use = Number(tx.internal_use_qty) || 0;
      const internal_use_weight = Number(tx.internal_use_w) || 0;
      const disposed = Number(tx.disposed_qty) || 0;
      const disposed_weight = Number(tx.disposed_w) || 0;
      const adjustment = Number(tx.adjustment_qty) || 0;
      const adjustment_weight = Number(tx.adjustment_w) || 0;

      const ending = beginning + purchase + transfer_in - sales - transfer_out - internal_use - disposed + adjustment;
      const ending_weight = beginning_weight + purchase_weight + transfer_in_weight - sales_weight - transfer_out_weight - internal_use_weight - disposed_weight + adjustment_weight;

      // Rounding
      const round3 = (n: number) => Math.round(n * 1000) / 1000;

      rowsToInsert.push({
        date, branch_source, warehouse_code, category, tier,
        beginning: round3(beginning), beginning_weight: round3(beginning_weight),
        purchase: round3(purchase), purchase_weight: round3(purchase_weight),
        transfer_in: round3(transfer_in), transfer_in_weight: round3(transfer_in_weight),
        sales: round3(sales), sales_weight: round3(sales_weight),
        transfer_out: round3(transfer_out), transfer_out_weight: round3(transfer_out_weight),
        internal_use: round3(internal_use), internal_use_weight: round3(internal_use_weight),
        disposed: round3(disposed), disposed_weight: round3(disposed_weight),
        adjustment: round3(adjustment), adjustment_weight: round3(adjustment_weight),
        ending: round3(ending), ending_weight: round3(ending_weight),
        computed_at: todayStr
      });

      runningStock.set(combo, { qty: ending, weight: ending_weight });
    }
  }

  // Insert in batches
  const batchSize = 300;
  for (let i = 0; i < rowsToInsert.length; i += batchSize) {
    await insertRows(DAILY_TABLE_NAME, rowsToInsert.slice(i, i + batchSize));
  }

  console.log(`Successfully completed daily rollup from ${startBuildDate} to ${yesterdayStr}. Computed ${rowsToInsert.length} rows in ${Date.now() - start}ms.`);

  return {
    table: DAILY_TABLE_NAME,
    rowsInserted: rowsToInsert.length,
    isIncremental,
  };
}
