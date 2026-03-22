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

  console.log('Searching for row with Supply around -17,204...');
  filtered.forEach(row => {
    if (Math.abs(row['공급가액'] + 17204) < 10) {
      console.log('Found:', row['거래처명'], row['공급가액']);
    }
  });
}

main();
