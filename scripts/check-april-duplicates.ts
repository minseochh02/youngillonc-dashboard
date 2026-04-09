/**
 * Check for duplicate data for April 1st across all tables
 * Run: npx tsx scripts/check-april-duplicates.ts
 */

import { config } from 'dotenv';
import { executeSQL } from '../egdesk-helpers';
import { TABLES } from '../egdesk.config';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function checkAprilDuplicates() {
  console.log('\n🔍 Checking for duplicate data on April 1st (2025)...\n');

  try {
    const tables = Object.values(TABLES);
    console.log(`📊 Checking ${tables.length} tables\n`);

    for (const table of tables) {
      const tableName = table.name;

      try {
        // Get columns from config
        const columns = table.columns;

        // Look for date columns
        const dateColumns = columns.filter((colName: string) => {
          const name = colName.toLowerCase();
          return name.includes('date') ||
                 name.includes('day') ||
                 name.includes('일자') ||
                 name === 'created_at' ||
                 name === 'updated_at';
        });

        if (dateColumns.length === 0) {
          continue; // Skip tables without date columns
        }

        console.log(`\n📋 Checking table: ${tableName}`);
        console.log(`   Date columns: ${dateColumns.join(', ')}`);

        // Check for April 1st data in each date column
        for (const colName of dateColumns) {

          // Query for April 1st data (2025-04-01 or similar formats)
          const queries = [
            `SELECT COUNT(*) as total FROM ${tableName} WHERE ${colName} LIKE '%2025-04-01%'`,
            `SELECT COUNT(*) as total FROM ${tableName} WHERE ${colName} LIKE '%04/01/2025%'`,
            `SELECT COUNT(*) as total FROM ${tableName} WHERE ${colName} LIKE '%2025/04/01%'`,
          ];

          let totalCount = 0;
          for (const query of queries) {
            try {
              const result = await executeSQL(query);
              const count = Array.isArray(result) ? result[0]?.total : result?.rows?.[0]?.total;
              totalCount += count || 0;
            } catch (err) {
              // Ignore query errors
            }
          }

          if (totalCount > 0) {
            console.log(`   ✓ Found ${totalCount} rows with ${colName} = April 1st`);

            // Check for duplicates based on all columns except id and date
            const groupByColumns = columns.filter((c: string) =>
              c !== 'id' &&
              c !== 'created_at' &&
              c !== 'updated_at' &&
              c !== 'imported_at' &&
              c !== colName
            );

            if (groupByColumns.length > 0) {
              const duplicateQuery = `
                SELECT ${groupByColumns.join(', ')}, COUNT(*) as count
                FROM ${tableName}
                WHERE ${colName} LIKE '%2025-04-01%'
                   OR ${colName} LIKE '%04/01/2025%'
                   OR ${colName} LIKE '%2025/04/01%'
                GROUP BY ${groupByColumns.join(', ')}
                HAVING COUNT(*) > 1
              `;

              try {
                const duplicates = await executeSQL(duplicateQuery);
                const dupRows = Array.isArray(duplicates) ? duplicates : duplicates?.rows || [];

                if (dupRows.length > 0) {
                  console.log(`   ⚠️  DUPLICATES FOUND: ${dupRows.length} duplicate groups`);
                  dupRows.forEach((dup: any, idx: number) => {
                    console.log(`      ${idx + 1}. Count: ${dup.count}, Data:`, dup);
                  });
                } else {
                  console.log(`   ✅ No duplicates found`);
                }
              } catch (err) {
                console.log(`   ⚠️  Could not check for duplicates: ${err}`);
              }
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Error checking table ${tableName}:`, error);
      }
    }

    console.log('\n✨ Done checking for duplicates!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkAprilDuplicates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to check duplicates\n');
    console.error(error);
    process.exit(1);
  });
