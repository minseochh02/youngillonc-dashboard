import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  const filePath = 'REPORT/[참고] 2602 판매실적.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const target = 132952396;

  console.log('Searching for target value 132,952,396 in any cell...');

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (typeof val === 'number') {
        if (Math.abs(val - target) < 1) {
          console.log(`Found MATCH: ${val} at Row ${r+1}, Col ${c+1}`);
          console.log('Row content:', row);
        }
      } else if (typeof val === 'string') {
        const num = parseFloat(val.replace(/,/g, ''));
        if (Math.abs(num - target) < 1) {
          console.log(`Found MATCH (string): ${val} at Row ${r+1}, Col ${c+1}`);
          console.log('Row content:', row);
        }
      }
    }
  }
}

main();
