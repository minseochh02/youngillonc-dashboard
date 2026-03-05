/**
 * Test inserting 2025 dates (non-November) to see if it's specific to Nov 2025
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

async function testDate(dateStr: string, customerName: string) {
  console.log(`\n--- Testing ${dateStr} ---`);

  const testRow = {
    일자: dateStr,
    거래처그룹1코드명: 'TEST2025',
    판매처명: customerName,
    품목그룹1코드: 'IL',
    공급가액: '12345',
  };

  console.log(`Inserting: ${dateStr}`);

  await callEgdeskAPI('user_data_insert_rows', {
    tableName: 'sales',
    rows: [testRow],
  });

  const checkQuery = `SELECT 일자, 판매처명 FROM sales WHERE 판매처명 = '${customerName}'`;
  const checkResult = await callEgdeskAPI('user_data_sql_query', { query: checkQuery });

  if (checkResult.rows.length > 0) {
    const storedDate = checkResult.rows[0].일자;
    if (storedDate === dateStr) {
      console.log(`✓ SUCCESS: ${dateStr} stored correctly`);
    } else {
      console.log(`✗ FAIL: Expected ${dateStr}, got ${storedDate}`);
    }
  }
}

async function main() {
  console.log('Testing various 2025 dates...');

  // Test different months in 2025
  await testDate('2025-10-15', 'Test Oct 2025');
  await testDate('2025-11-15', 'Test Nov 2025');
  await testDate('2025-12-15', 'Test Dec 2025');

  // Clean up
  console.log('\n--- Cleanup ---');
  const deleteQuery = `SELECT id FROM sales WHERE 거래처그룹1코드명 = 'TEST2025'`;
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
