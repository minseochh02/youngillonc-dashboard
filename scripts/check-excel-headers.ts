import * as XLSX from 'xlsx';
import * as path from 'path';

const xlsxPath = path.join(__dirname, '..', 'WBCNICQV5GIQORL.xlsx');

const workbook = XLSX.readFile(xlsxPath);
console.log('Sheet names:', workbook.SheetNames);

const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get first 10 rows as JSON to see the structure
const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', header: 1 });

console.log('\nFirst 10 rows:');
data.slice(0, 10).forEach((row, idx) => {
  console.log(`Row ${idx}:`, row);
});

console.log('\nColumn headers (first row):');
console.log(data[0]);
