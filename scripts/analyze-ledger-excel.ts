/**
 * Analyze the November ledger Excel file structure
 */

import * as XLSX from 'xlsx';
import * as path from 'path';

const xlsxPath = path.join(__dirname, '..', 'VPSO3WU1If6Yi7eO.xlsx');

const workbook = XLSX.readFile(xlsxPath);
console.log('Sheet names:', workbook.SheetNames);

const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get raw data as array of arrays
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

console.log(`\nTotal rows in sheet: ${rawData.length}`);

// Show first 50 rows to understand structure
console.log('\n=== First 50 rows ===');
rawData.slice(0, 50).forEach((row, idx) => {
  const nonEmpty = row.filter((cell: any) => cell !== '').length;
  if (nonEmpty > 0) {
    console.log(`Row ${idx}: [${nonEmpty} cells] ${JSON.stringify(row.slice(0, 10))}`);
  }
});

// Look for title patterns matching "회사명 : (주)영일오엔씨 / ..."
console.log('\n=== Looking for island title patterns ===');
rawData.forEach((row, idx) => {
  const firstCell = String(row[0] || '');
  if (firstCell.includes('회사명') || firstCell.includes('계정별원장')) {
    console.log(`Row ${idx}: ${firstCell}`);
  }
});

// Look for header rows (일자-No., 적요, etc.)
console.log('\n=== Looking for header patterns ===');
rawData.forEach((row, idx) => {
  const rowStr = row.join('|');
  if (rowStr.includes('일자') && rowStr.includes('적요')) {
    console.log(`Row ${idx}: ${JSON.stringify(row)}`);
  }
});
