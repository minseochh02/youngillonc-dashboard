/**
 * Test inserting a single row with a specific date to isolate the issue
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
  console.log('Testing single row insertion with specific date...\n');

  // Test inserting ONE row with 2025-11-30
  const testRow = {
    일자: '2025-11-30',
    거래처그룹1코드명: 'SINGLETEST',
    판매처명: 'Single Test Customer',
    품목그룹1코드: 'IL',
    공급가액: '99999',
  };

  console.log('Inserting single row:');
  console.log(JSON.stringify(testRow, null, 2));
  console.log('\nPayload being sent to API:');
  console.log(JSON.stringify({
    tableName: 'sales',
    rows: [testRow],
  }, null, 2));

  await callEgdeskAPI('user_data_insert_rows', {
    tableName: 'sales',
    rows: [testRow],
  });

  console.log('\nRow inserted. Checking what was stored...');

  const checkQuery = `SELECT 일자, 판매처명, 품목그룹1코드, 공급가액 FROM sales WHERE 판매처명 = 'Single Test Customer'`;
  const checkResult = await callEgdeskAPI('user_data_sql_query', { query: checkQuery });

  console.log('\nStored data:');
  console.log(JSON.stringify(checkResult.rows, null, 2));

  if (checkResult.rows.length > 0 && checkResult.rows[0].일자 !== '2025-11-30') {
    console.log(`\n⚠️  BUG CONFIRMED: Expected date '2025-11-30' but got '${checkResult.rows[0].일자}'`);
  } else if (checkResult.rows.length > 0) {
    console.log('\n✓ Date stored correctly!');
  }

  // Clean up
  console.log('\nCleaning up test data...');
  const deleteQuery = `SELECT id FROM sales WHERE 판매처명 = 'Single Test Customer'`;
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
