import * as XLSX from 'xlsx';

const filePath = process.argv[2] || './PB4NPAMTL37TW9C.xlsx';

const workbook = XLSX.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);
console.log('\n');

workbook.SheetNames.forEach(sheetName => {
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  console.log(`\n=== Sheet: ${sheetName} ===`);
  console.log(`Total rows: ${data.length}`);

  if (data.length > 0) {
    console.log('\nHeaders:', data[0]);
    console.log('\nFirst 5 rows:');
    data.slice(0, 5).forEach((row, idx) => {
      console.log(`Row ${idx}:`, row);
    });
  }
});
