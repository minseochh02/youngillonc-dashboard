#!/usr/bin/env tsx
/**
 * Restore data from backup file with boolean conversion fix
 */

import { config } from 'dotenv';
import { insertRows } from '../egdesk-helpers';
import * as fs from 'fs/promises';

config({ path: '.env.local' });

async function main() {
  const backupFile = process.argv[2];

  if (!backupFile) {
    console.error('❌ Usage: npx tsx scripts/restore-from-backup.ts <backup-file>');
    console.error('   Example: npx tsx scripts/restore-from-backup.ts extraction-backup-2024-03-12-to-2024-03-18.json');
    process.exit(1);
  }

  console.log(`📂 Loading backup from ${backupFile}...`);

  const backupData = JSON.parse(await fs.readFile(backupFile, 'utf-8'));

  console.log(`   Found ${backupData.totalActivities} activities`);
  console.log(`   Found ${backupData.totalStandups} standups`);
  console.log();

  // Fix boolean conversion for activities
  const fixedActivities = backupData.activities.map((a: any) => ({
    ...a,
    requires_followup: a.requires_followup ? 1 : 0,
    is_blocker: a.is_blocker ? 1 : 0
  }));

  console.log('💾 Inserting activities into database...\n');

  // Insert in batches of 20
  for (let i = 0; i < fixedActivities.length; i += 20) {
    const batch = fixedActivities.slice(i, i + 20);
    console.log(`   Batch ${Math.floor(i/20) + 1}: Inserting ${batch.length} activities...`);

    try {
      const result = await insertRows('employee_activity_log', batch);

      if (result.inserted > 0) {
        console.log(`   ✅ Inserted: ${result.inserted}`);
      }
      if (result.skipped > 0) {
        console.log(`   ⏭️  Skipped: ${result.skipped}`);
      }
      if (result.duplicates > 0) {
        console.log(`   🔄 Duplicates: ${result.duplicates}`);
      }
      if (result.errors && result.errors.length > 0) {
        console.log(`   ❌ Errors: ${result.errors.length}`);
        result.errors.slice(0, 3).forEach((err: string) => console.log(`      - ${err}`));
      }
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
    }
  }

  console.log('\n✅ Restoration complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
