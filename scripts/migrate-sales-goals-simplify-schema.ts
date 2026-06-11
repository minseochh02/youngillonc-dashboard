/**
 * Simplify sales_goals to one row per client per month (no category split).
 *
 * Target schema:
 *   year, month, client_code, target_weight, target_amount
 *   unique: [year, month, client_code]
 *
 * Handles:
 *   - employee-level (renames to sales_goals_employee_backup, creates new table)
 *   - client + category columns (aggregates into client-only rows, backs up first)
 *   - already simplified (no-op unless --force)
 *
 * Run:
 *   npx tsx scripts/migrate-sales-goals-simplify-schema.ts
 *   npx tsx scripts/migrate-sales-goals-simplify-schema.ts --dry-run
 *   npx tsx scripts/migrate-sales-goals-simplify-schema.ts --force
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

const GOALS_TABLE = 'sales_goals';
const GOALS_DISPLAY = '판매 목표';
const EMPLOYEE_BACKUP = 'sales_goals_employee_backup';
const CATEGORY_BACKUP = 'sales_goals_client_category_backup';

const UNIQUE_KEY = ['year', 'month', 'client_code'] as const;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

type SchemaKind = 'employee' | 'client_with_category' | 'client_simple' | 'missing';

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
    /* probe below */
  }

  try {
    await executeSQL(`SELECT employee_name FROM ${tableName} LIMIT 1`);
    return 'employee';
  } catch {
    /* */
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

async function createSimpleTable(): Promise<void> {
  await createTable(
    GOALS_DISPLAY,
    [
      { name: 'year', type: 'TEXT', notNull: true },
      { name: 'month', type: 'TEXT', notNull: true },
      { name: 'client_code', type: 'TEXT', notNull: true },
      { name: 'target_weight', type: 'REAL', defaultValue: 0 },
      { name: 'target_amount', type: 'REAL', defaultValue: 0 },
    ],
    {
      tableName: GOALS_TABLE,
      description: 'Client-level monthly sales targets (one goal per client per month)',
      uniqueKeyColumns: [...UNIQUE_KEY],
      duplicateAction: 'update',
    }
  );
}

async function aggregateClientRows(sourceTable: string): Promise<Array<Record<string, string | number>>> {
  const rows = asRows(
    await executeSQL(`
      SELECT
        year,
        month,
        client_code,
        SUM(COALESCE(target_weight, 0)) as target_weight,
        SUM(COALESCE(target_amount, 0)) as target_amount
      FROM ${sourceTable}
      WHERE client_code IS NOT NULL AND TRIM(client_code) != ''
      GROUP BY year, month, client_code
    `)
  );

  return rows.map((r: any) => ({
    year: String(r.year),
    month: String(r.month).padStart(2, '0'),
    client_code: String(r.client_code),
    target_weight: Number(r.target_weight) || 0,
    target_amount: Number(r.target_amount) || 0,
  }));
}

async function main(): Promise<void> {
  const kind = await detectSchema(GOALS_TABLE);
  console.log(`\n📋 sales_goals schema: ${kind}`);
  console.log(`   dry-run: ${DRY_RUN}, force: ${FORCE}\n`);

  if (kind === 'client_simple' && !FORCE) {
    console.log('✅ Already client-simple (year, month, client_code). Nothing to do.');
    return;
  }

  if (kind === 'employee') {
    console.log('⚠️  Employee-level table detected.');
    console.log('   Run migrate-sales-goals-to-client-level.ts first, or this script will rename and create empty simple table.');
    if (!(await tableExists(EMPLOYEE_BACKUP))) {
      if (!DRY_RUN) {
        await renameTable(GOALS_TABLE, EMPLOYEE_BACKUP, '판매 목표 (담당자 기준 백업)');
      }
      console.log(`   Backed up → ${EMPLOYEE_BACKUP}`);
    } else if (!DRY_RUN) {
      await deleteTable(GOALS_TABLE);
    }
    if (!DRY_RUN) await createSimpleTable();
    console.log('✅ Created empty client-simple sales_goals. Re-enter goals or restore manually.');
    return;
  }

  if (kind === 'client_with_category' || (kind === 'client_simple' && FORCE)) {
    const source = GOALS_TABLE;
    let aggregated = await aggregateClientRows(source);

    if (kind === 'client_with_category') {
      console.log(`   Aggregating ${aggregated.length} client-month rows from category-split data`);
    }

    if (DRY_RUN) {
      console.log(`[dry-run] Would create simple table with ${aggregated.length} rows`);
      return;
    }

    if (await tableExists(CATEGORY_BACKUP)) {
      await deleteTable(CATEGORY_BACKUP);
    }
    await renameTable(source, CATEGORY_BACKUP, '판매 목표 (카테고리 분할 백업)');
    console.log(`   Backed up → ${CATEGORY_BACKUP}`);

    await createSimpleTable();

    const BATCH = 100;
    for (let i = 0; i < aggregated.length; i += BATCH) {
      await insertRows(GOALS_TABLE, aggregated.slice(i, i + BATCH));
    }

    console.log(`✅ Migrated ${aggregated.length} rows to client-simple schema`);
    return;
  }

  if (kind === 'missing') {
    if (DRY_RUN) {
      console.log('[dry-run] Would create empty client-simple sales_goals');
      return;
    }
    await createSimpleTable();
    console.log('✅ Created empty client-simple sales_goals');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
