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

  console.log('--- Breakdown by Branch & Category (Total Sum / 합계) ---');
  const breakdown = {};
  filtered.forEach(row => {
    const key = `${row['거래처그룹1명']} - ${row['품목그룹1코드']}`;
    breakdown[key] = (breakdown[key] || 0) + (row['합계'] || 0);
  });
  
  Object.entries(breakdown).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]: any) => {
    console.log(`${k}: ${v.toLocaleString()}`);
  });

  console.log('\n--- Positive Total Sum (합계) by Branch & Category ---');
  const posBreakdown = {};
  filtered.forEach(row => {
    if (row['합계'] > 0) {
      const key = `${row['거래처그룹1명']} - ${row['품목그룹1코드']}`;
      posBreakdown[key] = (posBreakdown[key] || 0) + (row['합계'] || 0);
    }
  });
  Object.entries(posBreakdown).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]: any) => {
    console.log(`${k}: ${v.toLocaleString()}`);
  });
}

main();
