/**
 * Migrate November 2025 ledger data from vpso3wu1if6yi7eo to main ledger table
 */

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

async function main() {
  const isExecute = process.argv.includes('--execute');

  console.log('Migrating November 2025 ledger data...\n');

  // First, check if ledger already has November 2025 data
  const checkQuery = `SELECT COUNT(*) as count FROM ledger WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
  const checkResult = await callEgdeskAPI('user_data_sql_query', { query: checkQuery });
  const existingCount = checkResult.rows[0].count;

  if (existingCount > 0) {
    console.log(`⚠️  Found ${existingCount} existing November 2025 rows in ledger.`);
    if (isExecute) {
      console.log('Deleting existing November 2025 rows first...\n');

      const deleteQuery = `SELECT id FROM ledger WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
      const deleteResult = await callEgdeskAPI('user_data_sql_query', { query: deleteQuery });
      const idsToDelete = deleteResult.rows.map((row: any) => row.id);

      if (idsToDelete.length > 0) {
        const deleteBatchSize = 1000;
        for (let i = 0; i < idsToDelete.length; i += deleteBatchSize) {
          const batchIds = idsToDelete.slice(i, i + deleteBatchSize);
          await callEgdeskAPI('user_data_delete_rows', {
            tableName: 'ledger',
            ids: batchIds
          });
          console.log(`  Deleted batch ${Math.floor(i / deleteBatchSize) + 1}/${Math.ceil(idsToDelete.length / deleteBatchSize)}`);
        }
        console.log(`✓ Deleted ${idsToDelete.length} old November rows\n`);
      }
    } else {
      console.log('(Would delete these in execute mode)\n');
    }
  } else {
    console.log('No existing November 2025 data found in ledger.\n');
  }

  // Get all November data from the source table (exclude opening balance rows)
  console.log('Reading November data from vpso3wu1if6yi7eo...');
  const sourceQuery = `
    SELECT * FROM vpso3wu1if6yi7eo
    WHERE 일자_no_ IS NOT NULL
    ORDER BY 일자_no_, 일자_no__번호
  `;
  const sourceResult = await callEgdeskAPI('user_data_sql_query', { query: sourceQuery });
  const sourceRows = sourceResult.rows;

  console.log(`Found ${sourceRows.length} rows to migrate.\n`);

  // Transform rows to match ledger schema
  const transformedRows = sourceRows.map((row: any) => {
    // Extract date and transaction number
    const dateStr = String(row.일자_no_ || '');
    const transactionNo = String(row.일자_no__번호 || '');

    return {
      일자: dateStr,
      일자_no: transactionNo,
      적요: String(row.적요 || ''),
      계정코드: '', // Not available in source
      계정명: '', // Not available in source
      거래처명: String(row.거래처명 || ''),
      거래처코드: '', // Not available in source
      부서명: String(row.거래처명 || ''), // Use 거래처명 as 부서명
      담당자코드: '', // Not available in source
      차변금액: String(row.차변금액 || ''),
      대변금액: String(row.대변금액 || ''),
      잔액: String(row.잔액 || ''),
      회사명: '(주)영일오엔씨',
      기간: '2025/11/01 ~ 2025/11/30',
      계정코드_메타: '',
      계정명_메타: ''
    };
  });

  // Insert in batches
  if (isExecute) {
    const batchSize = 100;
    for (let i = 0; i < transformedRows.length; i += batchSize) {
      const batch = transformedRows.slice(i, i + batchSize);
      console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedRows.length / batchSize)}...`);

      await callEgdeskAPI('user_data_insert_rows', {
        tableName: 'ledger',
        rows: batch,
      });
    }

    console.log('\n✓ Migration completed successfully!');

    // Verify the migration
    const verifyQuery = `SELECT COUNT(*) as count, MIN(일자) as min_date, MAX(일자) as max_date FROM ledger WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
    const verifyResult = await callEgdeskAPI('user_data_sql_query', { query: verifyQuery });
    console.log('\nVerification:');
    console.log(`  Total rows: ${verifyResult.rows[0].count}`);
    console.log(`  Date range: ${verifyResult.rows[0].min_date} to ${verifyResult.rows[0].max_date}`);
  } else {
    console.log('\n⚠️  Dry run mode. To actually migrate, run:');
    console.log('   npx tsx scripts/migrate-november-ledger.ts --execute');
    console.log('\nWould insert ${transformedRows.length} rows into ledger table.');
  }
}

// Only run if --execute flag is provided
if (process.argv.includes('--execute')) {
  main().catch(console.error);
} else {
  console.log('DRY RUN MODE - No changes will be made\n');
  main().catch(console.error);
}
