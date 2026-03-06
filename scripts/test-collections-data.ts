import { executeSQL } from '../egdesk-helpers';

async function testCollections() {
  console.log('Testing collections query...\n');

  // Test with yesterday (2026-03-05 assuming today is 2026-03-06)
  const yesterday = '2026-03-05';

  // First check if there's any data on that date
  const dateCheck = await executeSQL(
    `SELECT 전표번호, COUNT(*) as count FROM deposits WHERE 전표번호 = '${yesterday}' GROUP BY 전표번호`
  );
  console.log('Data for', yesterday, ':', dateCheck);

  // Check recent dates
  const recentDates = await executeSQL(
    "SELECT DISTINCT 전표번호 FROM deposits ORDER BY 전표번호 DESC LIMIT 10"
  );
  console.log('\nRecent dates in deposits:', recentDates);

  // Test the actual query with a date that has data
  if (recentDates.rows.length > 0) {
    const testDate = recentDates.rows[0].전표번호;
    console.log(`\nTesting with date: ${testDate}`);

    const result = await executeSQL(`
      SELECT
        부서명 as 사업소,
        거래처명,
        SUM(CAST(REPLACE(금액, ',', '') AS NUMERIC)) as 수금액
      FROM deposits
      WHERE 전표번호 = '${testDate}'
        AND 계정명 = '외상매출금'
      GROUP BY 부서명, 거래처명
      ORDER BY 수금액 DESC
      LIMIT 10
    `);

    console.log('Result:', result);
  }
}

testCollections().catch(console.error);
