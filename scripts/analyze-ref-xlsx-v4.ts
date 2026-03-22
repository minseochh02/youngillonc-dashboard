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

  console.log('--- Checking ALL Category Supply Totals (Positive) ---');
  const catTotals = {};
  filtered.forEach(row => {
    if (row['공급가액'] > 0) {
      const cat = row['품목그룹1코드'] || 'NULL';
      catTotals[cat] = (catTotals[cat] || 0) + row['공급가액'];
    }
  });
  console.table(catTotals);

  // Look for any combination of these that equals 132,952,396
  const entries = Object.entries(catTotals);
  // Total of IL: 133,145,964
  // We need 132,952,396
  // Diff: 193,568
  
  // Let's check if there's any client with 193,568 supply in IL
  const ilRows = filtered.filter(row => row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0);
  console.log('\n--- Searching for rows with supply around 193,568 in IL ---');
  ilRows.forEach(row => {
    if (Math.abs(row['공급가액'] - 193568) < 1000) {
      console.log('Found row:', row['거래처명'], row['공급가액']);
    }
  });

  // Maybe it's "Seoul" + "Hwaseong" but "Seoul" is a specific branch code?
  // Let's look at the "현 담당자" or "B2B사업소" or "B2C사업소" columns
  const branchCols = ['거래처그룹1명', 'B2B사업소', 'B2C사업소', '현 담당자'];
  branchCols.forEach(col => {
    const vals = Array.from(new Set(filtered.map(row => row[col])));
    console.log(`Distinct ${col}:`, vals);
  });

}

main();
