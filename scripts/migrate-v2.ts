/**
 * Complete Migration Runner using egdesk-helpers
 * ONLY uses structured API tools (createTable, insertRows, updateRows, deleteRows).
 * This script "translates" raw SQL into structured API calls.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createTable, insertRows, updateRows, deleteTable, executeSQL, listTables } from '../egdesk-helpers';

/**
 * Basic SQL parser for CREATE TABLE.
 */
function parseCreateTable(sql: string) {
  const match = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*)\)/i);
  if (!match) return null;

  const tableName = match[1];
  const columnsRaw = match[2];
  const schema: any[] = [];

  const lines = columnsRaw.split(',').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('--') && !l.startsWith('CONSTRAINT') && !l.startsWith('PRIMARY KEY') && !l.startsWith('UNIQUE'));

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    const name = parts[0].replace(/"/g, '');
    const typeRaw = parts[1].toUpperCase();

    let type: 'TEXT' | 'INTEGER' | 'REAL' | 'DATE' = 'TEXT';
    if (typeRaw.includes('INT') || typeRaw.includes('SERIAL')) type = 'INTEGER';
    else if (typeRaw.includes('DECIMAL') || typeRaw.includes('REAL') || typeRaw.includes('FLOAT')) type = 'REAL';
    else if (typeRaw.includes('DATE') || typeRaw.includes('TIMESTAMP')) type = 'DATE';

    schema.push({
      name,
      type,
      notNull: line.toUpperCase().includes('NOT NULL'),
      defaultValue: line.toUpperCase().includes('DEFAULT') ? 'auto' : undefined
    });
  }

  return { tableName, schema };
}

/**
 * Basic SQL parser for DROP TABLE.
 */
function parseDropTable(sql: string) {
  const match = sql.match(/DROP TABLE (?:IF EXISTS )?(\w+)/i);
  if (!match) return null;
  return match[1];
}

/**
 * Specialized seeder for employee_master using kakaotalk_egdesk_pm data.
 */
async function seedEmployeeMaster() {
  console.log(`🌱 Seeding employee_master from kakaotalk_egdesk_pm...`);
  try {
    // 1. Fetch unique users from KakaoTalk
    const query = `
      SELECT DISTINCT user_name 
      FROM kakaotalk_egdesk_pm 
      WHERE user_name IS NOT NULL 
        AND user_name != '' 
        AND user_name != '🌈'
    `;
    const result = await executeSQL(query);
    
    if (result && result.rows && result.rows.length > 0) {
      const rows = result.rows.map((r: any) => ({
        employee_name: r.user_name,
        employee_name_variants: [r.user_name],
        employment_status: 'active'
      }));

      // 2. Insert into employee_master (structured)
      await insertRows('employee_master', rows);
      console.log(`   ✅ Success: Inserted ${rows.length} employees`);
    } else {
      console.log(`   ⚠️ No users found to seed.`);
    }
  } catch (error) {
    console.error(`   ❌ Seeding failed: ${error}`);
  }
}

async function runMigration(migrationFile: string) {
  console.log(`🚀 Starting Structured Migration: ${migrationFile}`);

  if (migrationFile.includes('002_seed')) {
    await seedEmployeeMaster();
    return;
  }

  const migrationPath = join(process.cwd(), 'migrations', migrationFile);
  let sqlContent: string;

  try {
    sqlContent = readFileSync(migrationPath, 'utf-8');
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }

  const cleanSql = sqlContent.replace(/\/\*[\s\S]*?\*\//g, '');
  const statements = cleanSql.split(';').map(s => s.trim()).filter(s => s.length > 0);

  for (const statement of statements) {
    const cleanStmt = statement.replace(/--.*$/gm, '').trim();
    const type = cleanStmt.split(/\s+/)[0].toUpperCase();

    if (type === 'CREATE' && cleanStmt.split(/\s+/)[1]?.toUpperCase() === 'TABLE') {
      const parsed = parseCreateTable(cleanStmt);
      if (parsed) {
        console.log(`🔨 Creating table: ${parsed.tableName}...`);
        try {
          await createTable(parsed.tableName, parsed.schema, { tableName: parsed.tableName });
          console.log(`   ✅ Success`);
        } catch (error) {
          console.error(`   ❌ Failed: ${error}`);
        }
      }
    } else if (type === 'DROP' && cleanStmt.split(/\s+/)[1]?.toUpperCase() === 'TABLE') {
      const tableName = parseDropTable(cleanStmt);
      if (tableName) {
        console.log(`🗑️  Dropping table: ${tableName}...`);
        try {
          await deleteTable(tableName);
          console.log(`   ✅ Success`);
        } catch (error) {
          console.error(`   ❌ Failed: ${error}`);
        }
      }
    } else {
      console.log(`⚠️  Skipping ${type} statement (API only supports structured Table/Row operations)`);
    }
  }

  console.log(`\n🎉 Migration finished!`);
}

// CLI Entry Point
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.log('\nUsage: npx tsx scripts/migrate-v2.ts <migration-file>\n');
  process.exit(1);
}

runMigration(migrationFile).catch(console.error);
