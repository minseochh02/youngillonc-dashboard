/**
 * Query kakaotalk_egdesk_pm table to understand the data structure
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
  console.log('Querying kakaotalk_egdesk_pm table...\n');

  // Get sample messages
  const sampleQuery = `SELECT * FROM kakaotalk_egdesk_pm ORDER BY chat_date DESC LIMIT 20`;
  const sampleResult = await callEgdeskAPI('user_data_sql_query', { query: sampleQuery });
  console.log('Sample messages:');
  console.log(JSON.stringify(sampleResult.rows, null, 2));

  // Get unique users
  const usersQuery = `SELECT DISTINCT user_name FROM kakaotalk_egdesk_pm ORDER BY user_name`;
  const usersResult = await callEgdeskAPI('user_data_sql_query', { query: usersQuery });
  console.log('\n\nUnique users:');
  console.log(JSON.stringify(usersResult.rows, null, 2));

  // Get date range
  const rangeQuery = `SELECT MIN(chat_date) as earliest, MAX(chat_date) as latest, COUNT(*) as total FROM kakaotalk_egdesk_pm`;
  const rangeResult = await callEgdeskAPI('user_data_sql_query', { query: rangeQuery });
  console.log('\n\nDate range and total:');
  console.log(JSON.stringify(rangeResult.rows, null, 2));
}

main().catch(console.error);
