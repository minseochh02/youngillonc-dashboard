/**
 * Parse November ledger Excel using island detection approach
 * Mimics the EGDesk excel-parser island detection logic
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import { EGDESK_CONFIG } from '../egdesk.config';

const xlsxPath = path.join(__dirname, '..', 'VPSO3WU1If6Yi7eO.xlsx');

interface IslandMetadata {
  회사명: string;
  기간: string;
  계정코드: string;
  계정명: string;
}

interface LedgerRow {
  일자: string;
  일자_no: string;
  적요: string;
  계정코드: string;
  계정명: string;
  거래처명: string;
  거래처코드: string;
  부서명: string;
  담당자코드: string;
  차변금액: string;
  대변금액: string;
  잔액: string;
  회사명: string;
  기간: string;
  계정코드_메타: string;
  계정명_메타: string;
}

// Parse island metadata from title like:
// "회사명 : (주)영일오엔씨 / 2025/11/01  ~ 2025/11/30  / 계정별원장 / 1089(외상매출금)"
function parseIslandMetadata(titleStr: string): IslandMetadata | null {
  const parts = titleStr.split('/').map(p => p.trim());

  const metadata: IslandMetadata = {
    회사명: '',
    기간: '',
    계정코드: '',
    계정명: ''
  };

  // Extract company name
  const companyMatch = titleStr.match(/회사명\s*:\s*([^/]+)/);
  if (companyMatch) {
    metadata.회사명 = companyMatch[1].trim();
  }

  // Extract date range (e.g., "2025/11/01  ~ 2025/11/30")
  const dateRangeMatch = titleStr.match(/(\d{4}\/\d{2}\/\d{2})\s*~\s*(\d{4}\/\d{2}\/\d{2})/);
  if (dateRangeMatch) {
    metadata.기간 = `${dateRangeMatch[1]} ~ ${dateRangeMatch[2]}`;
  }

  // Extract account code and name (e.g., "1089(외상매출금)")
  const accountMatch = titleStr.match(/(\d{4})\(([^)]+)\)/);
  if (accountMatch) {
    metadata.계정코드 = accountMatch[1];
    metadata.계정명 = accountMatch[2];
  }

  return metadata.계정코드 ? metadata : null;
}

// Parse date-no format like "2025/11/05 -11" into date and transaction number
function parseDateNo(dateNoStr: string): { date: string; no: string } | null {
  const str = String(dateNoStr || '').trim();
  const match = str.match(/(\d{4})\/(\d{2})\/(\d{2})\s*(-?\d+)/);
  if (!match) return null;

  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    no: match[4].trim()
  };
}

// Check if a row is a summary/noise row that should be skipped
function shouldSkipRow(row: any[]): boolean {
  const firstCell = String(row[0] || '').trim();

  // Skip opening balance rows
  if (firstCell === '' && String(row[1] || '').includes('이월잔액')) {
    return true;
  }

  // Skip summary rows
  if (firstCell.includes('합계') || firstCell.includes('총합계')) {
    return true;
  }

  // Skip timestamp rows (e.g., "2026/03/05  오후 9:20:08")
  if (firstCell.match(/\d{4}\/\d{2}\/\d{2}\s+(오전|오후)/)) {
    return true;
  }

  // Skip empty rows
  if (row.every((cell: any) => cell === '' || cell === null)) {
    return true;
  }

  return false;
}

function parseExcelToLedger(xlsxPath: string): LedgerRow[] {
  console.log(`Reading Excel file: ${xlsxPath}\n`);

  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
  console.log(`Total rows in sheet: ${rawData.length}`);

  const allRows: LedgerRow[] = [];
  let islandCount = 0;

  // Detect islands
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const firstCell = String(row[0] || '');

    // Check if this is an island title row
    if (firstCell.includes('회사명') && firstCell.includes('계정별원장')) {
      islandCount++;
      const metadata = parseIslandMetadata(firstCell);

      if (!metadata) {
        console.log(`⚠️  Row ${i}: Could not parse metadata from "${firstCell}"`);
        continue;
      }

      console.log(`\n📊 Island ${islandCount}: ${metadata.계정코드}(${metadata.계정명})`);

      // Next row should be header
      const headerRow = rawData[i + 1];
      if (!headerRow || !String(headerRow[0]).includes('일자')) {
        console.log(`  ⚠️  No header row found`);
        continue;
      }

      // Collect data rows starting from i+2
      let dataRowCount = 0;
      for (let j = i + 2; j < rawData.length; j++) {
        const dataRow = rawData[j];

        // Stop at next island
        if (String(dataRow[0] || '').includes('회사명')) {
          break;
        }

        // Skip noise rows
        if (shouldSkipRow(dataRow)) {
          continue;
        }

        // Parse date-no
        const dateNo = parseDateNo(dataRow[0]);
        if (!dateNo) {
          continue; // Skip rows without valid date
        }

        // Extract branch from 적요 (e.g., "창원-우리", "서울-기업" → "창원", "서울")
        const 적요 = String(dataRow[1] || '');
        let 부서명 = String(dataRow[2] || ''); // Default to 거래처명

        // Try to extract branch from 적요 patterns like "창원-우리", "화성-기업", etc.
        const branchMatch = 적요.match(/^(창원|화성|서울|남부|중부|서부|동부|제주|부산|MB)-/);
        if (branchMatch) {
          부서명 = branchMatch[1];
        }

        // Build ledger row
        const ledgerRow: LedgerRow = {
          일자: dateNo.date,
          일자_no: dateNo.no,
          적요: 적요,
          계정코드: metadata.계정코드,
          계정명: metadata.계정명,
          거래처명: String(dataRow[2] || ''),
          거래처코드: '',
          부서명: 부서명,
          담당자코드: '',
          차변금액: String(dataRow[3] || ''),
          대변금액: String(dataRow[4] || ''),
          잔액: String(dataRow[5] || ''),
          회사명: metadata.회사명,
          기간: metadata.기간,
          계정코드_메타: metadata.계정코드,
          계정명_메타: metadata.계정명
        };

        allRows.push(ledgerRow);
        dataRowCount++;
      }

      console.log(`  ✓ Parsed ${dataRowCount} data rows`);
    }
  }

  console.log(`\n✅ Total islands detected: ${islandCount}`);
  console.log(`✅ Total ledger rows parsed: ${allRows.length}`);

  return allRows;
}

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

async function insertToLedger(rows: LedgerRow[]) {
  const proceed = process.argv.includes('--execute');

  if (!proceed) {
    console.log('\n⚠️  Dry run mode. Sample of first 3 rows:');
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    console.log('\n⚠️  To actually insert to database, run:');
    console.log('   npx tsx scripts/parse-ledger-islands.ts --execute');
    return;
  }

  console.log('\n🚀 Inserting rows to ledger table...');

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)}...`);

    await callEgdeskAPI('user_data_insert_rows', {
      tableName: 'ledger',
      rows: batch,
    });
  }

  console.log('\n✓ Migration completed successfully!');

  // Verify
  const verifyQuery = `SELECT COUNT(*) as count, MIN(일자) as min_date, MAX(일자) as max_date FROM ledger WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'`;
  const verifyResult = await callEgdeskAPI('user_data_sql_query', { query: verifyQuery });
  console.log('\nVerification:');
  console.log(`  Total rows: ${verifyResult.rows[0].count}`);
  console.log(`  Date range: ${verifyResult.rows[0].min_date} to ${verifyResult.rows[0].max_date}`);

  // Check specific accounts
  const accountsQuery = `
    SELECT 계정명, COUNT(*) as count
    FROM ledger
    WHERE 일자 >= '2025-11-01' AND 일자 <= '2025-11-30'
    GROUP BY 계정명
    ORDER BY count DESC
    LIMIT 10
  `;
  const accountsResult = await callEgdeskAPI('user_data_sql_query', { query: accountsQuery });
  console.log('\nTop 10 accounts by row count:');
  accountsResult.rows.forEach((row: any) => {
    console.log(`  ${row.계정명}: ${row.count} rows`);
  });
}

async function main() {
  const rows = parseExcelToLedger(xlsxPath);
  await insertToLedger(rows);
}

main().catch(console.error);
