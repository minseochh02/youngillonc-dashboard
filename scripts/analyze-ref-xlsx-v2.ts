import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  const filePath = 'REPORT/[참고] 2602 판매실적.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[] = XLSX.utils.sheet_to_json(sheet);

  // 2026-02-01 is 46054
  // 2026-02-26: 46079
  // 2026-02-27: 46080
  // 2026-02-28: 46081
  const start = 46079;
  const end = 46081;

  const filtered = data.filter(row => row['일자'] >= start && row['일자'] <= end);
  console.log(`Rows in range 2/26-2/28: ${filtered.length}`);

  const targetValue = 132952396;

  // 1. Try "IL" category total (supply or total sum)
  const ilSupply = filtered.reduce((s, row) => row['품목그룹1코드'] === 'IL' ? s + (row['공급가액'] || 0) : s, 0);
  const ilSum = filtered.reduce((s, row) => row['품목그룹1코드'] === 'IL' ? s + (row['합계'] || 0) : s, 0);
  
  console.log(`IL Category Supply: ${ilSupply.toLocaleString()}`);
  console.log(`IL Category Total Sum: ${ilSum.toLocaleString()}`);

  // 2. Try Hwaseong + Seoul branches + IL
  const shILSupply = filtered.reduce((s, row) => {
    const branch = String(row['거래처그룹1명'] || '');
    if (row['품목그룹1코드'] === 'IL' && (branch.includes('서울') || branch.includes('화성'))) {
      return s + (row['공급가액'] || 0);
    }
    return s;
  }, 0);
  console.log(`Seoul/Hwaseong IL Supply: ${shILSupply.toLocaleString()}`);

  // 3. Maybe it includes AVI?
  const shILAVISupply = filtered.reduce((s, row) => {
    const branch = String(row['거래처그룹1명'] || '');
    const cat = row['품목그룹1코드'];
    if ((cat === 'IL' || cat === 'AVI') && (branch.includes('서울') || branch.includes('화성'))) {
      return s + (row['공급가액'] || 0);
    }
    return s;
  }, 0);
  console.log(`Seoul/Hwaseong IL+AVI Supply: ${shILAVISupply.toLocaleString()}`);

  // 4. Group by category and branch to see components
  const breakdown = {};
  filtered.forEach(row => {
    const key = `${row['거래처그룹1명']} - ${row['품목그룹1코드']}`;
    breakdown[key] = (breakdown[key] || 0) + (row['공급가액'] || 0);
  });
  
  console.log('\n--- Breakdown by Branch & Category (Supply) ---');
  Object.entries(breakdown).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]: any) => {
    console.log(`${k}: ${v.toLocaleString()}`);
  });

  // 5. Look for the exact target 132,952,396
  // Check if it's "Seoul" + "Hwaseong" + "something else"?
  // Or maybe it's total sales minus returns?
  
  const targetCheck = filtered.reduce((s, row) => {
    const branch = String(row['거래처그룹1명'] || '');
    if (branch.includes('서울') || branch.includes('화성')) {
      if (row['품목그룹1코드'] === 'IL') return s + (row['공급가액'] || 0);
    }
    return s;
  }, 0);
  
  console.log(`\nChecking specific logic for target ${targetValue.toLocaleString()}:`);
  console.log(`Current calc: ${targetCheck.toLocaleString()}`);
  console.log(`Difference: ${(targetValue - targetCheck).toLocaleString()}`);

}

main();
