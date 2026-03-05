/**
 * Check all unique dates in the sales table
 */

const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '0cecafab-88a8-450f-ba9f-60715187faad',
};

async function callEgdeskAPI(tool: string, args: any) {
  const apiUrl = EGDESK_CONFIG.apiUrl;
  const apiKey = EGDESK_CONFIG.apiKey;

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
  console.log('Checking all unique dates in sales table...\n');

  // Get all unique dates with counts
  const dateQuery = `SELECT 일자, COUNT(*) as count FROM sales GROUP BY 일자 ORDER BY 일자`;
  const dateResult = await callEgdeskAPI('user_data_sql_query', { query: dateQuery });

  console.log(`Found ${dateResult.rows.length} unique dates:`);
  console.log(JSON.stringify(dateResult.rows, null, 2));
}

main().catch(console.error);
