import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  const filePath = 'REPORT/[참고] 2602 판매실적.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[] = XLSX.utils.sheet_to_json(sheet);

  const start = 46079;
  const end = 46081;
  const filtered = data.filter(row => row['일자'] >= start && row['일자'] <= end);

  console.log('--- Positive Total Sum (합계) by Warehouse (창고명) ---');
  const whTotals = {};
  filtered.forEach(row => {
    if (row['합계'] > 0) {
      const wh = row['창고명'] || 'NULL';
      whTotals[wh] = (whTotals[wh] || 0) + row['합계'];
    }
  });
  console.table(whTotals);
}

main();
