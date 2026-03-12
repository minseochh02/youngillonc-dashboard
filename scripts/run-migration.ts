/**
 * Run database migration via EGDesk API
 * Usage: npx tsx scripts/run-migration.ts <migration-file>
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { EGDESK_CONFIG } from '../egdesk.config';

async function callEgdeskAPI(tool: string, args: any) {
  const apiUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EGDESK_API_URL) ||
    EGDESK_CONFIG.apiUrl;
  const apiKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EGDESK_API_KEY) ||
    EGDESK_CONFIG.apiKey;

  const response = await fetch(`${apiUrl}/user-data/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      tool,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Tool call failed');
  }

  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

async function runMigration(migrationFile: string) {
  console.log(`Running migration: ${migrationFile}\n`);

  const migrationPath = join(process.cwd(), 'migrations', migrationFile);
  let sqlContent: string;

  try {
    sqlContent = readFileSync(migrationPath, 'utf-8');
  } catch (error) {
    console.error(`Error reading migration file: ${error}`);
    process.exit(1);
  }

  // Split SQL into individual statements (simple split on semicolon)
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`Executing statement ${i + 1}/${statements.length}...`);

    // Show first 100 chars of statement
    const preview = statement.substring(0, 100).replace(/\n/g, ' ');
    console.log(`  ${preview}${statement.length > 100 ? '...' : ''}`);

    try {
      await callEgdeskAPI('user_data_sql_query', { query: statement });
      console.log(`  ✓ Success\n`);
    } catch (error) {
      console.error(`  ✗ Error: ${error}\n`);
      console.error('Failed statement:');
      console.error(statement);
      console.error('\nMigration failed. Please fix the error and try again.');
      process.exit(1);
    }
  }

  console.log('Migration completed successfully!');
}

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npx tsx scripts/run-migration.ts <migration-file>');
  console.error('Example: npx tsx scripts/run-migration.ts 001_create_employee_activity_tables.sql');
  process.exit(1);
}

runMigration(migrationFile).catch(console.error);
