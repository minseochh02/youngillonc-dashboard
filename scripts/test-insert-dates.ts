/**
 * Test inserting rows with different dates to verify API behavior
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
  console.log('Testing date insertion...\n');

  // Create test rows with different dates
  const testRows = [
    {
      일자: '2025-12-01',
      거래처그룹1코드명: 'TEST',
      판매처명: 'Test Customer 1',
      품목그룹1코드: 'IL',
      공급가액: '1000',
    },
    {
      일자: '2025-12-02',
      거래처그룹1코드명: 'TEST',
      판매처명: 'Test Customer 2',
      품목그룹1코드: 'IL',
      공급가액: '2000',
    },
    {
      일자: '2025-12-03',
      거래처그룹1코드명: 'TEST',
      판매처명: 'Test Customer 3',
      품목그룹1코드: 'IL',
      공급가액: '3000',
    },
  ];

  console.log('Inserting test rows:');
  console.log(JSON.stringify(testRows, null, 2));

  await callEgdeskAPI('user_data_insert_rows', {
    tableName: 'sales',
    rows: testRows,
  });

  console.log('\nRows inserted. Checking what was stored...');

  const checkQuery = `SELECT 일자, 판매처명, 품목그룹1코드, 공급가액 FROM sales WHERE 판매처명 LIKE 'Test Customer%' ORDER BY 일자`;
  const checkResult = await callEgdeskAPI('user_data_sql_query', { query: checkQuery });

  console.log('\nStored data:');
  console.log(JSON.stringify(checkResult.rows, null, 2));

  // Clean up
  console.log('\nCleaning up test data...');
  const deleteQuery = `SELECT id FROM sales WHERE 판매처명 LIKE 'Test Customer%'`;
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
