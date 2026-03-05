/**
 * Test inserting 2026 dates to confirm they work correctly
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
  console.log('Testing 2026 dates...\n');

  const testRow = {
    일자: '2026-03-15',
    거래처그룹1코드명: 'TEST2026',
    판매처명: 'Test March 2026',
    품목그룹1코드: 'IL',
    공급가액: '54321',
  };

  console.log('Inserting: 2026-03-15');

  await callEgdeskAPI('user_data_insert_rows', {
    tableName: 'sales',
    rows: [testRow],
  });

  const checkQuery = `SELECT 일자, 판매처명 FROM sales WHERE 판매처명 = 'Test March 2026'`;
  const checkResult = await callEgdeskAPI('user_data_sql_query', { query: checkQuery });

  if (checkResult.rows.length > 0) {
    const storedDate = checkResult.rows[0].일자;
    console.log(`Sent: 2026-03-15, Got: ${storedDate}`);
    if (storedDate === '2026-03-15') {
      console.log('✓ 2026 dates work correctly!');
    } else {
      console.log('✗ 2026 dates also affected!');
    }
  }

  // Clean up
  const deleteQuery = `SELECT id FROM sales WHERE 판매처명 = 'Test March 2026'`;
  const deleteResult = await callEgdeskAPI('user_data_sql_query', { query: deleteQuery });
  const idsToDelete = deleteResult.rows.map((row: any) => row.id);

  if (idsToDelete.length > 0) {
    await callEgdeskAPI('user_data_delete_rows', {
      tableName: 'sales',
      ids: idsToDelete,
    });
    console.log(`Deleted ${idsToDelete.length} test rows`);
  }
}

main().catch(console.error);
