/**
 * Import Clean Ledger from Excel
 *
 * Reads 1iKvrLravEbuFmPY.xlsx and creates a clean ledger table by:
 * - Filtering out header rows, separators, empty rows, and 이월잔액 rows
 * - Converting dates from YYYY/MM/DD to YYYY-MM-DD format
 * - Keeping only valid transaction data
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import { deleteTable, createTable, insertRows } from '../egdesk-helpers';

// Import both January and February data in order
const EXCEL_FILES = [
  'n7LeaB6Q4PTArGo3.xlsx',  // January 2026
  '1iKvrLravEbuFmPY.xlsx',   // February 2026
];
const BATCH_SIZE = 500;

interface LedgerRow {
  일자: string;
  거래유형: string;
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
}

/**
 * Check if a row should be skipped
 */
function shouldSkipRow(cells: any[]): boolean {
  const firstCell = String(cells[0] || '').trim();
  const thirdCell = String(cells[2] || '').trim();

  // Skip if all empty
  if (cells.every(c => !c || String(c).trim() === '')) {
    return true;
  }

  // Skip title rows (회사명 : (주)영일오엔씨 / ...)
  if (firstCell.includes('회사명') && firstCell.includes('계정별원장')) {
    return true;
  }

  // Skip column headers
  if (firstCell === '일자' && String(cells[1]) === '거래유형') {
    return true;
  }

  // Skip opening balance rows (이월잔액)
  if (firstCell === '' && thirdCell === '이월잔액') {
    return true;
  }

  // Skip timestamp separators (2026/03/22 오후 7:02:45)
  if (/\d{4}\/\d{2}\/\d{2}\s+(오전|오후)\s+\d{1,2}:\d{2}:\d{2}/.test(firstCell)) {
    return true;
  }

  // Skip summary rows
  if (thirdCell.includes('합계') || thirdCell.includes('총합계')) {
    return true;
  }

  return false;
}

/**
 * Check if a row is valid transaction data
 */
function isValidDataRow(cells: any[]): boolean {
  const firstCell = String(cells[0] || '').trim();
  // Must start with date pattern YYYY/MM/DD (with optional trailing space)
  return /^\d{4}\/\d{2}\/\d{2}\s*$/.test(firstCell);
}

/**
 * Convert date from YYYY/MM/DD to YYYY-MM-DD
 */
function convertDate(dateStr: string): string {
  return dateStr.trim().replace(/\//g, '-');
}

/**
 * Parse a raw Excel row into LedgerRow object
 */
function parseRow(cells: any[]): LedgerRow {
  return {
    일자: convertDate(String(cells[0] || '')),
    거래유형: String(cells[1] || ''),
    적요: String(cells[2] || ''),
    계정코드: String(cells[3] || ''),
    계정명: String(cells[4] || ''),
    거래처명: String(cells[5] || ''),
    거래처코드: String(cells[6] || ''),
    부서명: String(cells[7] || ''),
    담당자코드: String(cells[8] || ''),
    차변금액: String(cells[9] || ''),
    대변금액: String(cells[10] || ''),
    잔액: String(cells[11] || ''),
  };
}

/**
 * Process a single Excel file and return clean rows
 */
function processExcelFile(filePath: string): LedgerRow[] {
  console.log('🔍 Reading Excel file:', filePath);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // First sheet: 계정별원장
  const worksheet = workbook.Sheets[sheetName];

  console.log('📊 Sheet name:', sheetName);

  // Convert to array of arrays
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log(`📝 Total rows in Excel: ${rawData.length}`);

  // Filter and parse rows
  const cleanRows: LedgerRow[] = [];
  let skippedCount = 0;

  for (let i = 0; i < rawData.length; i++) {
    const cells = rawData[i];

    if (shouldSkipRow(cells)) {
      skippedCount++;
      continue;
    }

    if (isValidDataRow(cells)) {
      cleanRows.push(parseRow(cells));
    } else {
      // Log unexpected rows for debugging
      const firstCell = String(cells[0] || '').trim();
      if (firstCell) {
        console.log(`⚠️  Row ${i + 1} skipped (unexpected format): ${firstCell.substring(0, 50)}`);
        skippedCount++;
      }
    }
  }

  console.log(`✅ Valid data rows: ${cleanRows.length}`);
  console.log(`❌ Skipped rows: ${skippedCount}`);

  return cleanRows;
}

/**
 * Main import function
 */
async function importCleanLedger() {
  // Process all Excel files in order
  let allCleanRows: LedgerRow[] = [];

  for (const fileName of EXCEL_FILES) {
    const filePath = path.join(process.cwd(), fileName);
    const cleanRows = processExcelFile(filePath);
    allCleanRows = allCleanRows.concat(cleanRows);
    console.log(`\n`);
  }

  console.log(`📊 Total clean rows from all files: ${allCleanRows.length}`);

  if (allCleanRows.length === 0) {
    console.error('❌ No valid rows found! Aborting.');
    return;
  }

  // Show sample of first few rows
  console.log('\n📋 Sample rows:');
  allCleanRows.slice(0, 3).forEach((row, idx) => {
    console.log(`  Row ${idx + 1}: ${row.일자} | ${row.계정명} | ${row.적요.substring(0, 30)}`);
  });

  // Delete old table
  console.log('\n🗑️  Deleting old ledger table...');
  try {
    await deleteTable('ledger');
    console.log('✅ Old table deleted');
  } catch (err: any) {
    console.log('⚠️  Could not delete old table (may not exist):', err.message);
  }

  // Create new table with correct schema
  console.log('\n📦 Creating new ledger table...');
  await createTable('계정별원장', [
    { name: '일자', type: 'TEXT', notNull: true },
    { name: '거래유형', type: 'TEXT' },
    { name: '적요', type: 'TEXT' },
    { name: '계정코드', type: 'TEXT' },
    { name: '계정명', type: 'TEXT' },
    { name: '거래처명', type: 'TEXT' },
    { name: '거래처코드', type: 'TEXT' },
    { name: '부서명', type: 'TEXT' },
    { name: '담당자코드', type: 'TEXT' },
    { name: '차변금액', type: 'TEXT' },
    { name: '대변금액', type: 'TEXT' },
    { name: '잔액', type: 'TEXT' },
  ], {
    tableName: 'ledger',
    description: 'Clean ledger from Jan-Feb 2026 (n7LeaB6Q4PTArGo3.xlsx + 1iKvrLravEbuFmPY.xlsx)',
    duplicateAction: 'allow'
  });
  console.log('✅ Table created');

  // Insert in batches
  console.log(`\n💾 Inserting ${allCleanRows.length} rows in batches of ${BATCH_SIZE}...`);
  let insertedCount = 0;

  for (let i = 0; i < allCleanRows.length; i += BATCH_SIZE) {
    const batch = allCleanRows.slice(i, i + BATCH_SIZE);
    await insertRows('ledger', batch);
    insertedCount += batch.length;
    console.log(`  ✓ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertedCount}/${allCleanRows.length} rows`);
  }

  console.log('\n✅ Import complete!');
  console.log(`📊 Total rows inserted: ${insertedCount}`);
}

// Run the import
importCleanLedger().catch(err => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
