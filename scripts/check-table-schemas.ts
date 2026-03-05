/**
 * Compare schemas of November ledger table and main ledger table
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
  console.log('Comparing table schemas...\n');

  // Get all columns from November table
  const novQuery = `SELECT * FROM vpso3wu1if6yi7eo WHERE 일자_no_ IS NOT NULL LIMIT 1`;
  const novResult = await callEgdeskAPI('user_data_sql_query', { query: novQuery });

  console.log('November table columns:');
  if (novResult.rows.length > 0) {
    Object.keys(novResult.rows[0]).forEach(col => console.log(`  - ${col}`));
  }

  // Get all columns from main ledger
  const ledgerQuery = `SELECT * FROM ledger LIMIT 1`;
  const ledgerResult = await callEgdeskAPI('user_data_sql_query', { query: ledgerQuery });

  console.log('\nMain ledger table columns:');
  if (ledgerResult.rows.length > 0) {
    Object.keys(ledgerResult.rows[0]).forEach(col => console.log(`  - ${col}`));
  }

  // Show sample from November table
  console.log('\nSample November row (with data):');
  console.log(JSON.stringify(novResult.rows[0], null, 2));

  // Show sample from main ledger
  console.log('\nSample main ledger row:');
  console.log(JSON.stringify(ledgerResult.rows[0], null, 2));
}

main().catch(console.error);
