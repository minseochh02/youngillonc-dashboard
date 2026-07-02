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
