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

  console.log('--- Busan Branch Positive Total Sum (합계) ---');
  const busanRows = filtered.filter(row => row['거래처그룹1명'] === '부산사업소' && row['합계'] > 0);
  const busanTotal = busanRows.reduce((s, row) => s + row['합계'], 0);
  console.log(`Busan Positive Total Sum: ${busanTotal.toLocaleString()}`);

  console.log('\n--- Searching for rows related to Busan in other branches ---');
  // Maybe Busan transactions are in 'MB' or 'Central'?
  const otherBusan = filtered.filter(row => row['거래처그룹1명'] !== '부산사업소' && String(row['창고명']).includes('부산'));
  otherBusan.forEach(row => {
    console.log(`${row['거래처그룹1명']} | ${row['품목그룹1코드']} | Sum: ${row['합계']}`);
  });

  const sumOtherBusan = otherBusan.reduce((s, row) => s + (row['합계'] || 0), 0);
  console.log(`Sum of non-Busan branch but Busan warehouse: ${sumOtherBusan.toLocaleString()}`);

}

main();
