import * as XLSX from 'xlsx';
import * as path from 'path';

const xlsxPath = path.join(__dirname, '..', 'WBCNICQV5GIQORL.xlsx');

const workbook = XLSX.readFile(xlsxPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
const headers = rawData[1] as string[];
const dataRows = rawData.slice(2);

const rows: any[] = [];

for (const rowArray of dataRows) {
  const row: any = {};
  headers.forEach((header, idx) => {
    row[header] = rowArray[idx] || '';
  });

  let dateStr = String(row['일자'] || '');

  if (!dateStr || !dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
    continue;
  }

  if (dateStr && dateStr.includes('/')) {
    dateStr = dateStr.replace(/\//g, '-');
  }

  const salesRow = {
    일자: dateStr,
    거래처그룹1코드명: String(row['거래처그룹1명'] || ''),
    판매처명: String(row['거래처명'] || ''),
    품목그룹1코드: String(row['품목그룹1코드'] || ''),
  };

  rows.push(salesRow);
}

console.log('Total rows constructed:', rows.length);
console.log('\nSample rows from different positions:');
[0, 456, 457, 1000, 2000].forEach(idx => {
  if (rows[idx]) {
    console.log(`Row ${idx}:`, rows[idx]);
  }
});

// Check unique dates
const dateCount: Record<string, number> = {};
rows.forEach(r => {
  dateCount[r.일자] = (dateCount[r.일자] || 0) + 1;
});

console.log('\nUnique dates in constructed rows:');
console.log(JSON.stringify(dateCount, null, 2));
