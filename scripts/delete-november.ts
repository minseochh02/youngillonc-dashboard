/**
 * Delete all November 2025 sales data
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
  console.log('Deleting all November 2025 sales data...\n');

  const findQuery = `SELECT id FROM sales WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
  const findResult = await callEgdeskAPI('user_data_sql_query', { query: findQuery });
  const idsToDelete = findResult.rows.map((row: any) => row.id);

  console.log(`Found ${idsToDelete.length} November 2025 rows to delete`);

  if (idsToDelete.length > 0) {
    const deleteBatchSize = 1000;
    for (let i = 0; i < idsToDelete.length; i += deleteBatchSize) {
      const batchIds = idsToDelete.slice(i, i + deleteBatchSize);
      await callEgdeskAPI('user_data_delete_rows', {
        tableName: 'sales',
        ids: batchIds
      });
      console.log(`  Deleted batch ${Math.floor(i / deleteBatchSize) + 1}/${Math.ceil(idsToDelete.length / deleteBatchSize)}`);
    }
    console.log(`\n✓ Successfully deleted ${idsToDelete.length} November 2025 rows`);
  } else {
    console.log('No November 2025 rows found');
  }

  // Verify
  const verifyQuery = `SELECT COUNT(*) as count FROM sales WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
  const verifyResult = await callEgdeskAPI('user_data_sql_query', { query: verifyQuery });
  console.log(`\nVerification: ${verifyResult.rows[0].count} November 2025 rows remaining`);
}

main().catch(console.error);
