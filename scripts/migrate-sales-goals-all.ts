/**
 * One-shot sales_goals migration: employee → client+category → client-simple.
 *
 * Requires .env.local with EGDesk API settings AND project context:
 *   NEXT_PUBLIC_EGDESK_API_URL=http://localhost:8080
 *   NEXT_PUBLIC_EGDESK_API_KEY=...
 *   NEXT_PUBLIC_EGDESK_PROJECT_ID=<your egdesk project uuid>
 *   NEXT_PUBLIC_EGDESK_ENV=development
 *
 * Without PROJECT_ID, migrations hit the wrong (empty) DB while the app uses the project DB.
 *
 * Run:
 *   npm run migrate-sales-goals-all
 *   npm run migrate-sales-goals-all -- --dry-run
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

config({ path: resolve(process.cwd(), '.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');
const projectId = process.env.NEXT_PUBLIC_EGDESK_PROJECT_ID;
const egdeskEnv = process.env.NEXT_PUBLIC_EGDESK_ENV;

function runStep(label: string, script: string, extraArgs: string[] = []): void {
  console.log(`\n▶ ${label}`);
  const args = ['tsx', script, ...extraArgs];
  if (DRY_RUN) args.push('--dry-run');

  const result = spawnSync('npx', args, {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? 'unknown'})`);
  }
}

async function main(): Promise<void> {
  console.log('📋 sales_goals full migration');
  console.log(`   PROJECT_ID: ${projectId || '(not set — likely wrong DB!)'}`);
  console.log(`   ENV: ${egdeskEnv || '(not set)'}`);
  console.log(`   dry-run: ${DRY_RUN}`);

  if (!projectId) {
    console.error(`
❌ NEXT_PUBLIC_EGDESK_PROJECT_ID is missing from .env.local

The app (via EGDesk Scratch) uses your project database, but migrations without
PROJECT_ID write to a different default database. That causes:
  "no such column: sg.client_code"

Fix: add to .env.local (find the UUID in EGDesk logs: "egdeskId: ..."):
  NEXT_PUBLIC_EGDESK_PROJECT_ID=<your-project-uuid>
  NEXT_PUBLIC_EGDESK_ENV=development
`);
    process.exit(1);
  }

  runStep(
    'Step 1: employee → client (with --distribute)',
    'scripts/migrate-sales-goals-to-client-level.ts',
    ['--distribute']
  );

  runStep(
    'Step 2: client+category → client-simple',
    'scripts/migrate-sales-goals-simplify-schema.ts'
  );

  console.log('\n✨ Done. Restart the dev server and reload goal-setting.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
