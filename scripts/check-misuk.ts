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

  const miSuk = filtered.filter(row => row['현 담당자'] === '이미숙' && row['공급가액'] > 0);
  const sumMiSuk = miSuk.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`이미숙 Positive Supply Sum: ${sumMiSuk.toLocaleString()}`);
  
  const miSukTotal = miSuk.reduce((s, row) => s + row['합계'], 0);
  console.log(`이미숙 Positive Total Sum: ${miSukTotal.toLocaleString()}`);

  // Check IL Supply for 이미숙
  const miSukIL = miSuk.filter(row => row['품목그룹1코드'] === 'IL');
  console.log(`이미숙 IL Supply: ${miSukIL.reduce((s, row) => s + row['공급가액'], 0).toLocaleString()}`);

}

main();
