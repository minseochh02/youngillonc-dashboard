import * as XLSX from 'xlsx';
import * as path from 'path';

const xlsxPath = path.join(__dirname, '..', 'WBCNICQV5GIQORL.xlsx');

const workbook = XLSX.readFile(xlsxPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
const headers = rawData[1] as string[];
const dataRows = rawData.slice(2);

console.log(`Total rows: ${dataRows.length}`);

// Sample rows from different parts
const samplesToCheck = [0, 456, 457, 458, 1000, 2000, 3000, 4000, 4689];

console.log('\nDate samples from different positions:');
samplesToCheck.forEach(idx => {
  if (idx < dataRows.length) {
    const rowArray = dataRows[idx];
    const row: any = {};
    headers.forEach((header, i) => {
      row[header] = rowArray[i] || '';
    });

    let dateStr = String(row['일자'] || '');
    const isValid = dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/);

    if (dateStr && dateStr.includes('/')) {
      dateStr = dateStr.replace(/\//g, '-');
    }

    console.log(`Row ${idx}: raw='${row['일자']}', valid=${!!isValid}, converted='${dateStr}'`);
  }
});
