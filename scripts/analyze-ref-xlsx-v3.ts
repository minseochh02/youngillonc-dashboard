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

  const target = 132952396;

  console.log('--- Positive Supply Sums by Category (2/26-2/28) ---');
  const cats = Array.from(new Set(filtered.map(row => row['품목그룹1코드'])));
  
  cats.forEach(cat => {
    const sum = filtered.reduce((s, row) => (row['품목그룹1코드'] === cat && row['공급가액'] > 0) ? s + row['공급가액'] : s, 0);
    console.log(`${cat}: ${sum.toLocaleString()}`);
  });

  console.log('\n--- Positive Total Sums (합계) by Category (2/26-2/28) ---');
  cats.forEach(cat => {
    const sum = filtered.reduce((s, row) => (row['품목그룹1코드'] === cat && row['합계'] > 0) ? s + row['합계'] : s, 0);
    console.log(`${cat}: ${sum.toLocaleString()}`);
  });

  // Try combining Seoul/Hwaseong IL specifically
  const shILPosSupply = filtered.reduce((s, row) => {
    const branch = String(row['거래처그룹1명'] || '');
    if (row['품목그룹1코드'] === 'IL' && (branch.includes('서울') || branch.includes('화성')) && row['공급가액'] > 0) {
      return s + row['공급가액'];
    }
    return s;
  }, 0);
  console.log(`\nSeoul/Hwaseong Positive IL Supply: ${shILPosSupply.toLocaleString()}`);

  // Try summing ALL Positive IL across ALL branches
  const allPosILSupply = filtered.reduce((s, row) => (row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0) ? s + row['공급가액'] : s, 0);
  console.log(`ALL Positive IL Supply: ${allPosILSupply.toLocaleString()}`);

  // Maybe it's IL + MB + ...?
  const allPosIL_MB_Supply = filtered.reduce((s, row) => ((row['품목그룹1코드'] === 'IL' || row['품목그룹1코드'] === 'MB') && row['공급가액'] > 0) ? s + row['공급가액'] : s, 0);
  console.log(`ALL Positive IL+MB Supply: ${allPosIL_MB_Supply.toLocaleString()}`);

}

main();
