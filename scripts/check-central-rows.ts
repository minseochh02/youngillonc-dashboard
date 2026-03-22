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

  const centralEmps = ['송주탁', '임희영', '황종석', '화성auto'];
  console.log('--- Central Employees Transactions (Total Sum > 0) ---');
  const centralRows = filtered.filter(row => centralEmps.includes(row['현 담당자']) && row['합계'] > 0);
  
  centralRows.forEach(row => {
    console.log(`${row['현 담당자']} | ${row['품목그룹1코드']} | ${row['거래처명']} | Total: ${row['합계']}`);
  });

  const total = centralRows.reduce((s, row) => s + row['합계'], 0);
  console.log(`\nGrand Total: ${total.toLocaleString()}`);
  
  // User's value: 19,841,120
  console.log(`User Central: 19,841,120`);
  console.log(`Diff: ${(total - 19841120).toLocaleString()}`);

}

main();
