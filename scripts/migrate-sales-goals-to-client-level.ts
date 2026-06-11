/**
 * Migrate sales_goals from employee-level to client-level schema.
 *
 * Before: year, month, employee_name, category_type, category, industry, sector, targets
 * After:  year, month, client_code,   category_type, category, industry, sector, targets
 *
 * The old table is preserved as sales_goals_employee_backup (via rename).
 *
 * Run:
 *   npx tsx scripts/migrate-sales-goals-to-client-level.ts
 *   npx tsx scripts/migrate-sales-goals-to-client-level.ts --dry-run
 *   npx tsx scripts/migrate-sales-goals-to-client-level.ts --distribute
 *   npx tsx scripts/migrate-sales-goals-to-client-level.ts --force
 *
 * Flags:
 *   --dry-run     Print the migration plan without changing anything
 *   --distribute  After schema migration, split employee goals into client rows
 *                 using prior-year sales weights (same month/category slice).
 *                 Goals with no matching clients or sales are skipped with a warning.
 *   --force       Re-create client-level sales_goals even if already migrated
 *                 (does not delete the employee backup)
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
  sqlAndEmployeeNotSpecialHandling,
  sqlAndSalesRemarkNotExact,
  sqlSalesResolvedClientKeyExpr,
} from '../src/lib/special-handling-employees';

const BACKUP_TABLE = 'sales_goals_employee_backup';
const BACKUP_DISPLAY = '판매 목표 (담당자 기준 백업)';
const GOALS_TABLE = 'sales_goals';
const GOALS_DISPLAY = '판매 목표';

const UNIQUE_KEY = [
  'year',
  'month',
  'client_code',
  'category_type',
  'category',
  'industry',
  'sector',
] as const;

const DRY_RUN = process.argv.includes('--dry-run');
const DISTRIBUTE = process.argv.includes('--distribute');
const FORCE = process.argv.includes('--force');

type SchemaKind = 'employee' | 'client' | 'missing';

interface EmployeeGoalRow {
  year: string;
  month: string;
  employee_name: string;
  category_type: string;
  category: string;
  industry: string;
  sector: string;
  target_weight: number;
  target_amount: number;
}

interface ClientWeightRow {
  employee_name: string;
  month: string;
  category_type: string;
  category: string;
  industry: string;
  sector: string;
  client_code: string;
  weight: number;
}

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

    if (columns.includes('client_code')) return 'client';
    if (columns.includes('employee_name')) return 'employee';
  } catch {
    // fall through to probe queries
  }

  try {
    await executeSQL(`SELECT client_code FROM ${tableName} LIMIT 1`);
    return 'client';
  } catch {
    /* ignore */
  }

  try {
    await executeSQL(`SELECT employee_name FROM ${tableName} LIMIT 1`);
    return 'employee';
  } catch {
    return 'missing';
  }
}

async function countRows(tableName: string): Promise<number> {
  const res = await executeSQL(`SELECT COUNT(*) as count FROM ${tableName}`);
  return Number(asRows(res)[0]?.count ?? 0);
}

function categoryCaseSql(categoryType: string): { caseSql: string; having: string; extraJoins: string } {
  if (categoryType === 'tier') {
    return {
      caseSql: `
        CASE
          WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'STA' THEN 'Standard'
          WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'PRE' THEN 'Premium'
          WHEN i.품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') AND i.품목그룹3코드 = 'FLA' THEN 'Flagship'
          WHEN i.품목그룹1코드 NOT IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') THEN 'Alliance'
          ELSE 'Others'
        END`,
      having: "category IN ('Standard', 'Premium', 'Flagship', 'Alliance')",
      extraJoins: '',
    };
  }

  if (categoryType === 'division') {
    return {
      caseSql: `
        CASE
          WHEN i.품목그룹1코드 = 'IL' THEN 'IL'
          WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'AUTO'
          WHEN i.품목그룹1코드 = 'MB' THEN 'MB'
          WHEN i.품목그룹1코드 IN ('AVI', 'MAR') THEN 'AVI+MAR'
          ELSE '기타'
        END`,
      having: "category IN ('IL', 'AUTO', 'MB', 'AVI+MAR')",
      extraJoins: '',
    };
  }

  if (categoryType === 'business_type') {
    return {
      caseSql: `
        CASE
          WHEN ca.업종분류코드 IN ('28600', '28610', '28710') THEN 'Fleet'
          WHEN ca.업종분류코드 IS NOT NULL THEN 'LCC'
          ELSE NULL
        END`,
      having: "category IN ('Fleet', 'LCC')",
      extraJoins: 'LEFT JOIN company_type_auto ca ON c.업종분류코드 = ca.업종분류코드',
    };
  }

  if (categoryType === 'industry_sector') {
    return {
      caseSql: `COALESCE(ct.산업분류 || ' / ' || ct.섹터분류, '미분류')`,
      having: 'category IS NOT NULL',
      extraJoins: '',
    };
  }

  return {
    caseSql: `
      CASE
        WHEN i.제품군 = 'MOBIL 1' THEN 'MOBIL 1'
        WHEN i.제품군 = 'AIOP' THEN 'AIOP'
        WHEN i.제품군 = 'TP' THEN 'TP'
        WHEN i.제품군 = 'SPECIAL P' THEN 'SPECIAL P'
        WHEN i.품목그룹1코드 IN ('PVL', 'CVL') THEN 'CVL Products'
        ELSE 'Others'
      END`,
    having: "category IN ('MOBIL 1', 'AIOP', 'TP', 'SPECIAL P', 'CVL Products')",
    extraJoins: '',
  };
}

async function fetchPriorYearClientWeights(
  categoryType: string,
  refYear: string
): Promise<ClientWeightRow[]> {
  const clientKeyExpr = sqlSalesResolvedClientKeyExpr('s');
  const { caseSql, having, extraJoins } = categoryCaseSql(categoryType);

  const query = `
    SELECT
      e.사원_담당_명 as employee_name,
      substr(s.일자, 6, 2) as month,
      '${categoryType}' as category_type,
      ${caseSql} as category,
      COALESCE(ct.산업분류, '미분류') as industry,
      COALESCE(ct.섹터분류, '미분류') as sector,
      ${clientKeyExpr} as client_code,
      SUM(CAST(REPLACE(s.중량, ',', '') AS NUMERIC)) as weight
    FROM (
      SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 적요 FROM sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 적요 FROM east_division_sales
      UNION ALL
      SELECT id, 일자, 거래처코드, 실납업체, 담당자코드, 품목코드, 수량, 중량, 단가, 합계, 적요 FROM west_division_sales
    ) s
    LEFT JOIN clients c ON ${clientKeyExpr} = c.거래처코드
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    LEFT JOIN items i ON s.품목코드 = i.품목코드
    LEFT JOIN company_type ct ON c.업종분류코드 = ct.업종분류코드
    ${extraJoins}
    WHERE s.일자 LIKE '${refYear}-%'
      AND e.사원_담당_명 IS NOT NULL
      AND ${clientKeyExpr} IS NOT NULL
      ${sqlAndEmployeeNotSpecialHandling()}
      ${sqlAndSalesRemarkNotExact('s.적요')}
    GROUP BY employee_name, month, category, industry, sector, client_code
    HAVING ${having}
  `;

  return asRows(await executeSQL(query)).map((row: any) => ({
    employee_name: String(row.employee_name),
    month: String(row.month).padStart(2, '0'),
    category_type: categoryType,
    category: String(row.category),
    industry: String(row.industry || '미분류'),
    sector: String(row.sector || '미분류'),
    client_code: String(row.client_code),
    weight: Number(row.weight) || 0,
  }));
}

async function fetchEmployeeClients(): Promise<Map<string, string[]>> {
  const query = `
    SELECT
      e.사원_담당_명 as employee_name,
      c.거래처코드 as client_code
    FROM clients c
    LEFT JOIN employees e ON c.담당자코드 = e.사원_담당_코드
    WHERE e.사원_담당_명 IS NOT NULL
      AND c.거래처코드 IS NOT NULL
      ${sqlAndEmployeeNotSpecialHandling()}
  `;

  const map = new Map<string, string[]>();
  for (const row of asRows(await executeSQL(query))) {
    const employee = String(row.employee_name);
    const client = String(row.client_code);
    if (!map.has(employee)) map.set(employee, []);
    const list = map.get(employee)!;
    if (!list.includes(client)) list.push(client);
  }
  return map;
}

function sliceKey(parts: {
  employee_name: string;
  month: string;
  category_type: string;
  category: string;
  industry: string;
  sector: string;
}): string {
  return [
    parts.employee_name,
    parts.month,
    parts.category_type,
    parts.category,
    parts.industry,
    parts.sector,
  ].join('|');
}

async function distributeGoalsFromBackup(): Promise<void> {
  if (!(await tableExists(BACKUP_TABLE))) {
    console.log(`⚠️  No backup table (${BACKUP_TABLE}). Nothing to distribute.`);
    return;
  }

  const backupRows = asRows(
    await executeSQL(`
      SELECT year, month, employee_name, category_type, category, industry, sector,
             target_weight, target_amount
      FROM ${BACKUP_TABLE}
    `)
  ) as EmployeeGoalRow[];

  if (backupRows.length === 0) {
    console.log('ℹ️  Backup table is empty. Skipping distribution.');
    return;
  }

  const categoryTypes = [...new Set(backupRows.map((r) => r.category_type))];
  const weightIndex = new Map<string, ClientWeightRow[]>();

  for (const categoryType of categoryTypes) {
    const years = [
      ...new Set(
        backupRows
          .filter((r) => r.category_type === categoryType)
          .map((r) => (Number(r.year) - 1).toString())
      ),
    ];

    for (const refYear of years) {
      console.log(`   Loading prior-year weights: ${refYear}, category_type=${categoryType}`);
      const rows = await fetchPriorYearClientWeights(categoryType, refYear);
      for (const row of rows) {
        const key = sliceKey(row);
        if (!weightIndex.has(key)) weightIndex.set(key, []);
        weightIndex.get(key)!.push(row);
      }
    }
  }

  const employeeClients = await fetchEmployeeClients();
  const clientGoals: Array<Record<string, string | number>> = [];
  let distributed = 0;
  let skipped = 0;

  for (const goal of backupRows) {
    const month = String(goal.month).padStart(2, '0');
    const key = sliceKey({
      employee_name: goal.employee_name,
      month,
      category_type: goal.category_type,
      category: goal.category,
      industry: goal.industry || '미분류',
      sector: goal.sector || '미분류',
    });

    let clients = (weightIndex.get(key) || []).filter((r) => r.weight > 0);
    let mode: 'sales-weight' | 'equal-clients' = 'sales-weight';

    if (clients.length === 0) {
      const assigned = employeeClients.get(goal.employee_name) || [];
      if (assigned.length === 0) {
        console.warn(
          `   ⚠️  Skip goal (no clients): ${goal.employee_name} ${goal.year}-${month} ${goal.category_type}/${goal.category}`
        );
        skipped += 1;
        continue;
      }
      clients = assigned.map((client_code) => ({
        employee_name: goal.employee_name,
        month,
        category_type: goal.category_type,
        category: goal.category,
        industry: goal.industry || '미분류',
        sector: goal.sector || '미분류',
        client_code,
        weight: 1,
      }));
      mode = 'equal-clients';
    }

    const totalWeight = clients.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight <= 0) {
      skipped += 1;
      continue;
    }

    const targetWeight = Number(goal.target_weight) || 0;
    const targetAmount = Number(goal.target_amount) || 0;

    for (const client of clients) {
      const share = client.weight / totalWeight;
      const rowWeight = Math.round(targetWeight * share);
      const rowAmount = Math.round(targetAmount * share);
      if (rowWeight === 0 && rowAmount === 0) continue;

      clientGoals.push({
        year: goal.year,
        month,
        client_code: client.client_code,
        category_type: goal.category_type,
        category: goal.category,
        industry: goal.industry || '미분류',
        sector: goal.sector || '미분류',
        target_weight: rowWeight,
        target_amount: rowAmount,
      });
      distributed += 1;
    }

    if (mode === 'equal-clients') {
      console.log(
        `   ↳ equal split: ${goal.employee_name} ${goal.year}-${month} ${goal.category} → ${clients.length} clients`
      );
    }
  }

  console.log(`\n📦 Prepared ${clientGoals.length} client goal rows (${distributed} allocations, ${skipped} source goals skipped)`);

  if (DRY_RUN) {
    console.log('   [dry-run] Would insert client goals into sales_goals');
    return;
  }

  const BATCH = 100;
  for (let i = 0; i < clientGoals.length; i += BATCH) {
    await insertRows(GOALS_TABLE, clientGoals.slice(i, i + BATCH));
  }
  console.log(`✅ Inserted ${clientGoals.length} client-level goal rows`);
}

async function createClientLevelTable(): Promise<void> {
  await createTable(
    GOALS_DISPLAY,
    [
      { name: 'year', type: 'TEXT', notNull: true },
      { name: 'month', type: 'TEXT', notNull: true },
      { name: 'client_code', type: 'TEXT', notNull: true },
      { name: 'category_type', type: 'TEXT', notNull: true },
      { name: 'category', type: 'TEXT', notNull: true },
      { name: 'industry', type: 'TEXT', defaultValue: '미분류' },
      { name: 'sector', type: 'TEXT', defaultValue: '미분류' },
      { name: 'target_weight', type: 'REAL', defaultValue: 0 },
      { name: 'target_amount', type: 'REAL', defaultValue: 0 },
    ],
    {
      tableName: GOALS_TABLE,
      description: 'Client-level sales targets by month and product category slice',
      uniqueKeyColumns: [...UNIQUE_KEY],
      duplicateAction: 'update',
    }
  );
}

async function migrateSchema(): Promise<void> {
  const goalsSchema = await detectSchema(GOALS_TABLE);
  const backupExists = await tableExists(BACKUP_TABLE);

  console.log('\n📋 Migration plan');
  console.log(`   sales_goals schema: ${goalsSchema}`);
  console.log(`   backup exists: ${backupExists}`);
  console.log(`   distribute: ${DISTRIBUTE}`);
  console.log(`   force: ${FORCE}`);
  console.log(`   dry-run: ${DRY_RUN}\n`);

  if (goalsSchema === 'client' && !FORCE) {
    console.log('✅ sales_goals is already client-level. Use --force to recreate the empty table.');
    if (DISTRIBUTE) {
      const currentCount = await countRows(GOALS_TABLE);
      if (currentCount > 0) {
        console.log(`ℹ️  sales_goals already has ${currentCount} rows. Skipping --distribute.`);
        return;
      }
      console.log('📤 sales_goals is empty — running --distribute from backup...');
      await distributeGoalsFromBackup();
    }
    return;
  }

  if (goalsSchema === 'employee') {
    const rowCount = await countRows(GOALS_TABLE);
    console.log(`1. Backup ${GOALS_TABLE} (${rowCount} rows) → ${BACKUP_TABLE}`);

    if (!DRY_RUN) {
      if (backupExists) {
        console.log(`   Backup table already exists — dropping current ${GOALS_TABLE} before recreate`);
        await deleteTable(GOALS_TABLE);
      } else {
        await renameTable(GOALS_TABLE, BACKUP_TABLE, BACKUP_DISPLAY);
        console.log(`   Renamed to ${BACKUP_TABLE}`);
      }
    }
  } else if (goalsSchema === 'missing') {
    console.log(`1. ${GOALS_TABLE} does not exist — will create client-level table`);
    if (!backupExists) {
      console.log(`   ⚠️  No ${BACKUP_TABLE} found. --distribute will have nothing to import.`);
    }
  } else if (goalsSchema === 'client' && FORCE) {
    const rowCount = await countRows(GOALS_TABLE);
    console.log(`1. --force: drop and recreate ${GOALS_TABLE} (${rowCount} rows will be removed)`);
    if (!DRY_RUN) {
      await deleteTable(GOALS_TABLE);
    }
  }

  console.log('2. Create client-level sales_goals');
  console.log(`   Unique key: [${UNIQUE_KEY.join(', ')}]`);

  if (DRY_RUN) {
    console.log('\n[dry-run] Schema migration steps validated. Re-run without --dry-run to apply.');
    if (DISTRIBUTE) {
      await distributeGoalsFromBackup();
    }
    return;
  }

  await createClientLevelTable();
  console.log(`✅ Created ${GOALS_TABLE} with client_code column`);

  if (DISTRIBUTE) {
    console.log('\n3. Distribute employee goals to clients');
    await distributeGoalsFromBackup();
  } else {
    console.log('\n3. Skipped data distribution (pass --distribute to split backup goals by client)');
    if (backupExists || goalsSchema === 'employee') {
      console.log(`   Employee-level data preserved in ${BACKUP_TABLE}`);
    }
  }

  const finalCount = await countRows(GOALS_TABLE);
  console.log(`\n✨ Done. ${GOALS_TABLE} row count: ${finalCount}`);
  console.log('   Next: update application code to read/write client_code instead of employee_name.');
}

migrateSchema().catch((error) => {
  console.error('\n💥 Migration failed\n');
  console.error(error);
  process.exit(1);
});
