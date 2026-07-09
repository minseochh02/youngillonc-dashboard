/**
 * Restore category columns on sales_goals.
 *
 * From (client-simple):
 *   year, month, client_code, target_weight, target_amount
 *
 * To (client + product category):
 *   year, month, client_code, category_type, category, target_weight, target_amount
 *   unique: [year, month, client_code, category_type, category]
 *
 * Existing client-total goals are split by prior-year sales mix for the same
 * client/month (품목그룹1코드). Rows with no prior-year mix go to category '기타'.
 *
 * Run:
 *   npx tsx scripts/migrate-sales-goals-restore-category.ts
 *   npx tsx scripts/migrate-sales-goals-restore-category.ts --dry-run
 *   npx tsx scripts/migrate-sales-goals-restore-category.ts --force
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import {
  createTable,
  deleteTable,
  executeSQL,
  getTableSchema,
  insertRows,
  renameTable,
} from '../egdesk-helpers';
import {
  GOAL_CATEGORY_TYPE,
  sqlGoalCategoryCase,
} from '../src/lib/sales-goals-categories';
import {
  sqlAndEmployeeNotSpecialHandling,
  sqlAndSalesRemarkNotExact,
  sqlSalesResolvedClientKeyExpr,
} from '../src/lib/special-handling-employees';

const GOALS_TABLE = 'sales_goals';
const GOALS_DISPLAY = '판매 목표';
const SIMPLE_BACKUP = 'sales_goals_client_simple_backup';

const UNIQUE_KEY = ['year', 'month', 'client_code', 'category_type', 'category'] as const;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

type SchemaKind = 'client_simple' | 'client_with_category' | 'employee' | 'missing';

function asRows(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as any).rows)) {
    return (raw as any).rows;
  }
  return [];
}

async function tableExists(name: string): Promise<boolean> {
  try {
    await executeSQL(`SELECT 1 FROM ${name} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function detectSchema(tableName: string): Promise<SchemaKind> {
  if (!(await tableExists(tableName))) return 'missing';

  try {
    const schema = await getTableSchema(tableName);
    const columns: string[] =
      schema?.columns?.map((c: any) => c.name) ??
      schema?.schema?.map((c: any) => c.name) ??
      [];

    if (columns.includes('employee_name')) return 'employee';
    if (columns.includes('client_code')) {
      if (columns.includes('category_type') || columns.includes('category')) {
        return 'client_with_category';
      }
      return 'client_simple';
    }
  } catch {
    /* probe */
  }

  try {
    await executeSQL(`SELECT category_type FROM ${tableName} LIMIT 1`);
    return 'client_with_category';
  } catch {
    /* */
  }

  try {
    await executeSQL(`SELECT client_code FROM ${tableName} LIMIT 1`);
    return 'client_simple';
  } catch {
    return 'missing';
  }
}

async function createCategoryTable(): Promise<void> {
  await createTable(
    GOALS_DISPLAY,
    [
      { name: 'year', type: 'TEXT', notNull: true },
      { name: 'month', type: 'TEXT', notNull: true },
      { name: 'client_code', type: 'TEXT', notNull: true },
      { name: 'category_type', type: 'TEXT', notNull: true },
      { name: 'category', type: 'TEXT', notNull: true },
      { name: 'target_weight', type: 'REAL', defaultValue: 0 },
      { name: 'target_amount', type: 'REAL', defaultValue: 0 },
    ],
    {
      tableName: GOALS_TABLE,
      description: 'Client-level monthly sales targets by product category',
      uniqueKeyColumns: [...UNIQUE_KEY],
      duplicateAction: 'update',
    }
  );
}

async function fetchPriorYearMix(): Promise<Map<string, Array<{ category: string; weight: number }>>> {
  const clientKeyExpr = sqlSalesResolvedClientKeyExpr('s');
  const categoryCase = sqlGoalCategoryCase('i.품목그룹1코드');

  const parts: string[] = [
    `SELECT s.일자, s.거래처코드, s.실납업체, s.담당자코드, s.품목코드, s.중량, s.적요 FROM sales s`,
  ];
  for (const table of ['east_division_sales', 'west_division_sales']) {
    if (await tableExists(table)) {
      parts.push(
        `SELECT s.일자, s.거래처코드, s.실납업체, s.담당자코드, s.품목코드, s.중량, s.적요 FROM ${table} s`
      );
    }
  }
  const salesUnion = parts.join('\nUNION ALL\n');

  const res = await executeSQL(`
    SELECT
      CAST(CAST(substr(s.일자, 1, 4) AS INTEGER) + 1 AS TEXT) as goal_year,
      substr(s.일자, 6, 2) as month,
      ${clientKeyExpr} as client_code,
      ${categoryCase} as category,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (${salesUnion}) s
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    LEFT JOIN clients c ON ${clientKeyExpr} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    WHERE s.일자 IS NOT NULL
      AND ${clientKeyExpr} IS NOT NULL
      ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
    GROUP BY 1, 2, 3, 4
    HAVING SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) > 0
  `);

  const map = new Map<string, Array<{ category: string; weight: number }>>();
  for (const row of asRows(res)) {
    const key = `${row.goal_year}\t${String(row.month).padStart(2, '0')}\t${row.client_code}`;
    const list = map.get(key) || [];
    list.push({ category: String(row.category), weight: Number(row.weight) || 0 });
    map.set(key, list);
  }
  return map;
}

function splitGoal(
  year: string,
  month: string,
  clientCode: string,
  targetWeight: number,
  targetAmount: number,
  mixMap: Map<string, Array<{ category: string; weight: number }>>
): Array<Record<string, string | number>> {
  const monthPad = String(month).padStart(2, '0');
  const mix = mixMap.get(`${year}\t${monthPad}\t${clientCode}`) || [];
  const totalMix = mix.reduce((s, m) => s + m.weight, 0);

  if (totalMix <= 0 || mix.length === 0) {
    return [{
      year,
      month: monthPad,
      client_code: clientCode,
      category_type: GOAL_CATEGORY_TYPE,
      category: '기타',
      target_weight: targetWeight,
      target_amount: targetAmount,
    }];
  }

  const rows: Array<Record<string, string | number>> = [];
  let allocatedWeight = 0;
  let allocatedAmount = 0;

  mix.forEach((m, idx) => {
    const isLast = idx === mix.length - 1;
    const ratio = m.weight / totalMix;
    const w = isLast ? targetWeight - allocatedWeight : Math.round(targetWeight * ratio);
    const a = isLast ? targetAmount - allocatedAmount : Math.round(targetAmount * ratio);
    allocatedWeight += w;
    allocatedAmount += a;
    if (w === 0 && a === 0) return;
    rows.push({
      year,
      month: monthPad,
      client_code: clientCode,
      category_type: GOAL_CATEGORY_TYPE,
      category: m.category,
      target_weight: w,
      target_amount: a,
    });
  });

  return rows.length > 0
    ? rows
    : [{
        year,
        month: monthPad,
        client_code: clientCode,
        category_type: GOAL_CATEGORY_TYPE,
        category: '기타',
        target_weight: targetWeight,
        target_amount: targetAmount,
      }];
}

async function main(): Promise<void> {
  const kind = await detectSchema(GOALS_TABLE);
  console.log(`\n📋 sales_goals schema: ${kind}`);
  console.log(`   dry-run: ${DRY_RUN}, force: ${FORCE}\n`);

  if (kind === 'client_with_category' && !FORCE) {
    console.log('✅ Already has category columns. Nothing to do.');
    return;
  }

  if (kind === 'employee') {
    console.error('❌ Employee-level schema detected. Run migrate-sales-goals-to-client-level.ts first.');
    process.exit(1);
  }

  if (kind === 'missing') {
    if (DRY_RUN) {
      console.log('[dry-run] Would create empty category-aware sales_goals');
      return;
    }
    await createCategoryTable();
    console.log('✅ Created empty category-aware sales_goals');
    return;
  }

  // client_simple (or force re-run from current table)
  const existing = asRows(
    await executeSQL(`
      SELECT year, month, client_code, target_weight, target_amount
      FROM ${GOALS_TABLE}
      WHERE client_code IS NOT NULL AND TRIM(client_code) != ''
    `)
  );
  console.log(`   Existing goal rows: ${existing.length}`);

  console.log('   Loading prior-year category mix from sales...');
  const mixMap = await fetchPriorYearMix();
  console.log(`   Mix keys: ${mixMap.size}`);

  const outRows: Array<Record<string, string | number>> = [];
  for (const row of existing) {
    // If already category-shaped (force), keep as-is when category present
    if ((row as any).category) {
      outRows.push({
        year: String(row.year),
        month: String(row.month).padStart(2, '0'),
        client_code: String(row.client_code),
        category_type: String((row as any).category_type || GOAL_CATEGORY_TYPE),
        category: String((row as any).category),
        target_weight: Number(row.target_weight) || 0,
        target_amount: Number(row.target_amount) || 0,
      });
      continue;
    }
    outRows.push(
      ...splitGoal(
        String(row.year),
        String(row.month),
        String(row.client_code),
        Number(row.target_weight) || 0,
        Number(row.target_amount) || 0,
        mixMap
      )
    );
  }

  console.log(`   Output category rows: ${outRows.length}`);

  if (DRY_RUN) {
    console.log('[dry-run] Sample rows:');
    console.log(outRows.slice(0, 5));
    return;
  }

  if (await tableExists(SIMPLE_BACKUP)) {
    await deleteTable(SIMPLE_BACKUP);
  }
  await renameTable(GOALS_TABLE, SIMPLE_BACKUP, '판매 목표 (고객 합계 백업)');
  console.log(`   Backed up → ${SIMPLE_BACKUP}`);

  await createCategoryTable();

  const BATCH = 100;
  for (let i = 0; i < outRows.length; i += BATCH) {
    await insertRows(GOALS_TABLE, outRows.slice(i, i + BATCH));
    if ((i + BATCH) % 500 === 0 || i + BATCH >= outRows.length) {
      console.log(`   Inserted ${Math.min(i + BATCH, outRows.length)} / ${outRows.length}`);
    }
  }

  console.log(`✅ Migrated ${outRows.length} category-aware goal rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
