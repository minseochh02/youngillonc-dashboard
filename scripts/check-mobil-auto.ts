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

  const branches = Array.from(new Set(filtered.map(row => row['거래처그룹1명'])));
  
  console.log('--- Positive Supply of PVL + CVL (Mobil Auto) by Branch ---');
  branches.forEach(b => {
    const sum = filtered.reduce((s, row) => (row['거래처그룹1명'] === b && (row['품목그룹1코드'] === 'PVL' || row['품목그룹1코드'] === 'CVL') && row['공급가액'] > 0) ? s + row['공급가액'] : s, 0);
    console.log(`${b}: ${sum.toLocaleString()}`);
  });

  console.log('\n--- Positive Total Sum (합계) of PVL + CVL by Branch ---');
  branches.forEach(b => {
    const sum = filtered.reduce((s, row) => (row['거래처그룹1명'] === b && (row['품목그룹1코드'] === 'PVL' || row['품목그룹1코드'] === 'CVL') && row['합계'] > 0) ? s + row['합계'] : s, 0);
    console.log(`${b}: ${sum.toLocaleString()}`);
  });
}

main();
