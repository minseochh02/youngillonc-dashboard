import { executeSQL } from './egdesk-helpers';

/** Row shape returned by ledger SELECT queries in this script */
type LedgerSqlRow = {
  id: number;
  일자: string;
  적요: string;
  계정코드: string;
  차변금액: number | string | null;
  대변금액: number | string | null;
};

async function main() {
  try {
    console.log('--- Analyzing Invalid Rows in Ledger ---');

    // 1. Metadata rows (Headers, Footers, etc.)
    const metadataQuery = `
      SELECT id, 일자, 적요, 계정코드, 차변금액, 대변금액 FROM ledger 
      WHERE (일자 LIKE '%회사명%' OR 일자 LIKE '%~%' OR 일자 LIKE '%/%/%')
      AND 일자 NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    `;
    const metadataRows = (await executeSQL(metadataQuery)) as {
      rows: LedgerSqlRow[];
    };

    // Separate metadata from wrong format
    const headers = metadataRows.rows.filter(
      (r) =>
        r.일자.includes('회사명') || r.일자.includes('~') || r.일자.length > 10
    );
    const wrongFormat = metadataRows.rows.filter((r) =>
      r.일자.match(/^\d{4}\/\d{2}\/\d{2}$/)
    );
    const timestamps = metadataRows.rows.filter((r) =>
      r.일자.match(/\d{4}\/\d{2}\/\d{2}\s+/)
    );

    console.log(`\n1. Header/Metadata Rows Found: ${headers.length}`);
    console.log('Examples:', JSON.stringify(headers.slice(0, 3), null, 2));

    console.log(`\n2. Wrong Date Format (YYYY/MM/DD) Rows Found: ${wrongFormat.length}`);
    console.log('Examples:', JSON.stringify(wrongFormat.slice(0, 3), null, 2));

    console.log(`\n3. Timestamps in Date Column Rows Found: ${timestamps.length}`);
    console.log('Examples:', JSON.stringify(timestamps.slice(0, 3), null, 2));

    // 2. Null or Empty dates
    const nullDateQuery = `
      SELECT id, 일자, 적요, 계정코드, 차변금액, 대변금액 FROM ledger 
      WHERE 일자 IS NULL OR 일자 = ''
    `;
    const nullDateRows = (await executeSQL(nullDateQuery)) as {
      rows: LedgerSqlRow[];
    };
    console.log(`\n4. Null or Empty Date Rows Found: ${nullDateRows.rows.length}`);
    console.log('Examples (often "이월잔액"):', JSON.stringify(nullDateRows.rows.slice(0, 5), null, 2));

    // Total invalid
    const totalInvalid = headers.length + wrongFormat.length + timestamps.length + nullDateRows.rows.length;
    console.log(`\nTotal potentially invalid/wrong format rows: ${totalInvalid}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
