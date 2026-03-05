/**
 * Script to rebuild the ledger database from CSV file
 * Parses the account ledger CSV and inserts data with properly formatted dates
 */

import * as fs from 'fs';
import * as path from 'path';

// Import EGDesk config
const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: 'cd6187cf-b6f5-4e09-ba6e-36c0bd0c30fe',
};

// API call to EGDesk
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

interface LedgerRow {
  일자: string;           // Date in YYYY-MM-DD format
  일자_no: string;        // Transaction number (e.g., "-29")
  적요: string;           // Description
  계정코드: string;       // Account code extracted from header
  계정명: string;         // Account name extracted from header
  거래처명: string;       // Transaction party name
  거래처코드: string;     // Transaction party code (empty for now)
  부서명: string;         // Department name (extracted from 거래처명)
  담당자코드: string;     // Manager code (empty for now)
  차변금액: string;       // Debit amount
  대변금액: string;       // Credit amount
  잔액: string;           // Balance
  회사명: string;         // Company name
  기간: string;           // Period
  계정코드_메타: string;  // Account code metadata
  계정명_메타: string;    // Account name metadata
}

function parseHeader(headerLine: string): { accountCode: string; accountName: string; company: string; period: string } | null {
  // Pattern: "회사명 : (주)영일오엔씨 / 2026/01/01  ~ 2026/02/28  / 계정별원장 / 1023(현금 시재금-창원)"
  const match = headerLine.match(/회사명\s*:\s*(.+?)\s*\/\s*(.+?)\s*~\s*(.+?)\s*\/\s*계정별원장\s*\/\s*(\d+)\((.+?)\)/);

  if (!match) {
    return null;
  }

  return {
    company: match[1].trim(),
    period: `${match[2].trim()} ~ ${match[3].trim()}`,
    accountCode: match[4].trim(),
    accountName: match[5].trim(),
  };
}

function parseDateNo(dateNoStr: string): { date: string; no: string } | null {
  if (!dateNoStr || dateNoStr.trim() === '') {
    return null;
  }

  // Pattern: "2026/01/05 -29"
  const match = dateNoStr.match(/(\d{4})\/(\d{2})\/(\d{2})\s*(-\d+)/);

  if (!match) {
    return null;
  }

  return {
    date: `${match[1]}-${match[2]}-${match[3]}`, // Convert to YYYY-MM-DD
    no: match[4].trim(),
  };
}

function isOpeningBalanceRow(columns: string[]): boolean {
  // Check if 적요 (column 1) contains "이월잔액"
  return columns[1]?.includes('이월잔액');
}

function isSummaryRow(columns: string[]): boolean {
  // Check if last column contains "합계"
  return columns[6]?.includes('합계');
}

function isTimestampRow(line: string): boolean {
  // Pattern: "2026/03/05  오전 9:45:19" or similar
  return /\d{4}\/\d{2}\/\d{2}\s+(오전|오후)\s+\d{1,2}:\d{2}:\d{2}/.test(line);
}

function isEmptyRow(columns: string[]): boolean {
  return columns.every(col => !col || col.trim() === '');
}

function cleanAmount(amount: string): string {
  // Remove commas and whitespace
  return amount.replace(/,/g, '').trim();
}

async function parseLedgerCSV(csvPath: string): Promise<LedgerRow[]> {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  const rows: LedgerRow[] = [];
  let currentAccount: { accountCode: string; accountName: string; company: string; period: string } | null = null;
  let skipNextColumnHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      continue;
    }

    // Skip timestamp rows
    if (isTimestampRow(line)) {
      continue;
    }

    // Check for header row (account section start)
    const headerInfo = parseHeader(line);
    if (headerInfo) {
      currentAccount = headerInfo;
      skipNextColumnHeader = true;
      continue;
    }

    // Skip column header row
    if (skipNextColumnHeader && line.includes('일자-No.')) {
      skipNextColumnHeader = false;
      continue;
    }

    // Parse CSV columns (comma-delimited with quoted fields containing tabs)
    // Remove outer quotes and split by ","
    const columns = line.split('","').map(col =>
      col.replace(/^"|"$/g, '').replace(/\t/g, '').trim()
    );

    // Skip if not enough columns
    if (columns.length < 6) {
      continue;
    }

    // Skip empty rows
    if (isEmptyRow(columns)) {
      continue;
    }

    // Skip opening balance rows
    if (isOpeningBalanceRow(columns)) {
      continue;
    }

    // Skip summary rows
    if (isSummaryRow(columns)) {
      continue;
    }

    // Parse date-no
    const dateInfo = parseDateNo(columns[0]);
    if (!dateInfo || !currentAccount) {
      continue;
    }

    // Create ledger row
    const row: LedgerRow = {
      일자: dateInfo.date,
      일자_no: dateInfo.no,
      적요: columns[1],
      계정코드: currentAccount.accountCode,
      계정명: currentAccount.accountName,
      거래처명: columns[2],
      거래처코드: '', // Not available in CSV
      부서명: columns[2], // Use 거래처명 as 부서명
      담당자코드: '', // Not available in CSV
      차변금액: cleanAmount(columns[3]),
      대변금액: cleanAmount(columns[4]),
      잔액: cleanAmount(columns[5]),
      회사명: currentAccount.company,
      기간: currentAccount.period,
      계정코드_메타: currentAccount.accountCode,
      계정명_메타: currentAccount.accountName,
    };

    rows.push(row);
  }

  return rows;
}

async function rebuildLedgerDatabase(rows: LedgerRow[]) {
  console.log(`Parsed ${rows.length} ledger rows`);

  // Delete existing ledger table
  console.log('Deleting existing ledger table...');
  try {
    await callEgdeskAPI('user_data_delete_table', { tableName: 'ledger' });
    console.log('Existing ledger table deleted');
  } catch (error) {
    console.log('No existing ledger table to delete (or error deleting)');
  }

  // Create new ledger table
  console.log('Creating new ledger table...');
  await callEgdeskAPI('user_data_create_table', {
    displayName: '계정별원장',
    tableName: 'ledger',
    description: 'Rebuilt from CSV with proper date formatting',
    schema: [
      { name: '일자', type: 'TEXT', notNull: false },
      { name: '일자_no', type: 'TEXT', notNull: false },
      { name: '적요', type: 'TEXT', notNull: false },
      { name: '계정코드', type: 'TEXT', notNull: false },
      { name: '계정명', type: 'TEXT', notNull: false },
      { name: '거래처명', type: 'TEXT', notNull: false },
      { name: '거래처코드', type: 'TEXT', notNull: false },
      { name: '부서명', type: 'TEXT', notNull: false },
      { name: '담당자코드', type: 'TEXT', notNull: false },
      { name: '차변금액', type: 'TEXT', notNull: false },
      { name: '대변금액', type: 'TEXT', notNull: false },
      { name: '잔액', type: 'TEXT', notNull: false },
      { name: '회사명', type: 'TEXT', notNull: false },
      { name: '기간', type: 'TEXT', notNull: false },
      { name: '계정코드_메타', type: 'TEXT', notNull: false },
      { name: '계정명_메타', type: 'TEXT', notNull: false },
    ],
  });
  console.log('New ledger table created');

  // Insert rows in batches
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)}...`);

    await callEgdeskAPI('user_data_insert_rows', {
      tableName: 'ledger',
      rows: batch,
    });
  }

  console.log('Ledger database rebuilt successfully!');
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'PY6CYNKAlhtM5cjJ.csv');

  console.log('Starting ledger CSV parsing...');
  console.log(`Reading from: ${csvPath}`);

  const rows = await parseLedgerCSV(csvPath);

  console.log(`\nParsed ${rows.length} total rows`);

  console.log('\n=== Sample of first 5 rows ===');
  console.log(JSON.stringify(rows.slice(0, 5), null, 2));

  console.log('\n=== Sample of last 5 rows ===');
  console.log(JSON.stringify(rows.slice(-5), null, 2));

  const proceed = process.argv.includes('--execute');

  if (!proceed) {
    console.log('\n⚠️  Dry run mode. To actually rebuild the database, run:');
    console.log('   npm run rebuild-ledger -- --execute');
    return;
  }

  console.log('\n🚀 Rebuilding database...');
  await rebuildLedgerDatabase(rows);
}

main().catch(console.error);
