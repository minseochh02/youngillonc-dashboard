import { config } from 'dotenv';
import { existsSync } from 'fs';
import { listTables, executeSQL, deleteRows } from '../egdesk-helpers';
import { TABLES } from '../egdesk.config';
import { rebuildComputedInventoryMonthly } from '../src/lib/computed-inventory-utils';

if (existsSync('.env.development.local')) {
  config({ path: '.env.development.local' });
} else {
  config({ path: '.env.local' });
}

// Columns containing these substrings will trigger backend validation errors, so we exclude them from comparison
const DANGEROUS_SUBSTRINGS = ['update', 'delete', 'insert', 'drop', 'create', 'alter', 'exec', 'pragma', 'table'];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`=== Database Deduplication Script (Optimized & Rate-Limited) ===`);
  console.log(`Mode: ${commit ? 'COMMIT (DELETING RECORDS)' : 'DRY RUN (READ-ONLY)'}`);
  if (!commit) {
    console.log(`Tip: Run with --commit to actually remove duplicates.`);
  }

  const res = await listTables();
  const tables = res.tables || res;
  console.log(`Found ${tables.length} tables in DB.\n`);

  let totalDeleted = 0;
  const tablesWithDuplicates: { name: string; count: number }[] = [];

  for (const t of tables) {
    const tableName = t.tableName;
    const tableDef = Object.values(TABLES).find(def => def.name === tableName);
    if (!tableDef) {
      console.log(`Table [${tableName}]: Skipped (no schema definition found in TABLES).`);
      continue;
    }

    const businessColumns = tableDef.columns.filter(c => {
      const lower = c.toLowerCase();
      if (lower === 'id' || lower === 'imported_at' || lower === 'created_at' || lower === 'updated_at') {
        return false;
      }
      for (const sub of DANGEROUS_SUBSTRINGS) {
        if (lower.includes(sub)) {
          return false;
        }
      }
      return true;
    });

    if (businessColumns.length === 0) {
      console.log(`Table [${tableName}]: Skipped (no suitable business columns).`);
      continue;
    }

    const colsStr = businessColumns.map(c => `\`${c}\``).join(', ');
    const hasDateColumn = tableDef.columns.includes('일자');

    let idsToDelete: number[] = [];

    try {
      if (hasDateColumn) {
        // Query distinct months to chunk by month
        const monthQuery = `SELECT DISTINCT SUBSTR(일자, 1, 7) as ym FROM \`${tableName}\` WHERE 일자 IS NOT NULL AND 일자 != ''`;
        const monthRes = await executeSQL(monthQuery);
        await sleep(100); // Wait between queries to protect the server
        
        const months = (monthRes.rows || []).map((r: any) => r.ym).filter((m: any) => m && m.length === 7);

        if (months.length > 0) {
          console.log(`Table [${tableName}]: Chunking duplicate scan by month (${months.length} months)...`);
          for (const ym of months) {
            const chunkQuery = `
              SELECT t1.id
              FROM \`${tableName}\` t1
              LEFT JOIN (
                SELECT MIN(id) as keep_id
                FROM \`${tableName}\`
                WHERE 일자 LIKE '${ym}%'
                GROUP BY ${colsStr}
              ) t2 ON t1.id = t2.keep_id
              WHERE t1.일자 LIKE '${ym}%' AND t2.keep_id IS NULL
            `;
            const chunkRes = await executeSQL(chunkQuery);
            await sleep(50); // Pause briefly between month checks
            
            const chunkRows = chunkRes.rows || [];
            idsToDelete.push(...chunkRows.map((r: any) => r.id));
          }
        } else {
          // Fallback if no months found
          const fallbackQuery = `
            SELECT t1.id
            FROM \`${tableName}\` t1
            LEFT JOIN (
              SELECT MIN(id) as keep_id
              FROM \`${tableName}\`
              GROUP BY ${colsStr}
            ) t2 ON t1.id = t2.keep_id
            WHERE t2.keep_id IS NULL
          `;
          const fallbackRes = await executeSQL(fallbackQuery);
          await sleep(100);
          idsToDelete = (fallbackRes.rows || []).map((r: any) => r.id);
        }
      } else {
        // Non-date table, run full scan
        const query = `
          SELECT t1.id
          FROM \`${tableName}\` t1
          LEFT JOIN (
            SELECT MIN(id) as keep_id
            FROM \`${tableName}\`
            GROUP BY ${colsStr}
          ) t2 ON t1.id = t2.keep_id
          WHERE t2.keep_id IS NULL
        `;
        const queryRes = await executeSQL(query);
        await sleep(100);
        idsToDelete = (queryRes.rows || []).map((r: any) => r.id);
      }

      const dupCount = idsToDelete.length;

      if (dupCount > 0) {
        console.log(`Table [${tableName}]: Found ${dupCount} duplicate rows.`);
        tablesWithDuplicates.push({ name: tableName, count: dupCount });

        if (commit) {
          console.log(`  Deleting ${dupCount} rows in chunks of 500...`);
          const CHUNK_SIZE = 500;
          for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
            const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
            await deleteRows(tableName, { ids: chunk });
            await sleep(100); // Give server breathing room between delete batches
            process.stdout.write(`.`);
          }
          console.log(`\n  Successfully deleted ${dupCount} rows from ${tableName}.`);
          totalDeleted += dupCount;
        }
      } else {
        console.log(`Table [${tableName}]: No duplicates.`);
      }
    } catch (error: any) {
      console.error(`Error processing table ${tableName}:`, error.message);
      // Wait longer on error in case the server is restarting/recovering
      await sleep(1000);
    }
  }

  console.log(`\n=== Summary ===`);
  if (tablesWithDuplicates.length === 0) {
    console.log('No duplicates found in any tables.');
  } else {
    console.log(`Tables with duplicates:`);
    for (const item of tablesWithDuplicates) {
      console.log(`- ${item.name}: ${item.count} duplicates`);
    }
    if (commit) {
      console.log(`\nTotal rows deleted: ${totalDeleted}`);
      
      // Wait before rebuilding to let server fully settle
      console.log(`Waiting 3 seconds before rebuilding computed inventory...`);
      await sleep(3000);
      
      // Rebuild computed inventory
      console.log(`Rebuilding computed inventory monthly snapshots...`);
      try {
        const rebuildRes = await rebuildComputedInventoryMonthly();
        console.log(`Computed inventory rebuild complete!`, JSON.stringify(rebuildRes, null, 2));
      } catch (err: any) {
        console.error(`Failed to rebuild computed inventory:`, err.message);
      }
    }
  }
}

main().catch(console.error);
