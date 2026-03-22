import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  const filePath = 'REPORT/[참고] 2602 판매실적.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error('File not found');
    return;
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`Total rows in Excel: ${data.length}`);

  // Target: 132,952,396
  const target = 132952396;

  // Filter dates
  const filtered = data.filter(row => {
    const d = String(row['일자']);
    return d.includes('02/26') || d.includes('02/27') || d.includes('02/28') ||
           d.includes('2026-02-26') || d.includes('2026-02-27') || d.includes('2026-02-28');
  });

  console.log(`Rows in date range (2/26-2/28): ${filtered.length}`);

  // Group by various combinations to find 132,952,396
  
  // Logic A: Branch (전체사업소 or 거래처그룹1명) + Category (품목그룹1코드)
  // Let's check available columns first
  if (filtered.length > 0) {
    console.log('Available columns:', Object.keys(filtered[0]));
  }

  const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
    return 0;
  };

  // Attempt 1: All rows where 품목그룹1코드 = 'IL' or similar
  const ilTotalSupply = filtered.reduce((sum, row) => {
    if (String(row['품목그룹1코드']) === 'IL') {
      return sum + parseNum(row['공급가액']);
    }
    return sum;
  }, 0);
  console.log(`IL Total Supply: ${ilTotalSupply.toLocaleString()}`);

  const ilTotalSum = filtered.reduce((sum, row) => {
    if (String(row['품목그룹1코드']) === 'IL') {
      return sum + parseNum(row['합계']);
    }
    return sum;
  }, 0);
  console.log(`IL Total Sum: ${ilTotalSum.toLocaleString()}`);

  // Attempt 2: Seoul + Hwaseong branches + IL
  const shILSupply = filtered.reduce((sum, row) => {
    const branch = String(row['거래처그룹1명'] || row['사업소'] || '');
    const cat = String(row['품목그룹1코드'] || '');
    if (cat === 'IL' && (branch.includes('서울') || branch.includes('화성'))) {
      return sum + parseNum(row['공급가액']);
    }
    return sum;
  }, 0);
  console.log(`Seoul/Hwaseong IL Supply: ${shILSupply.toLocaleString()}`);

  // Attempt 3: Specific employees?
  const byEmp = {};
  filtered.forEach(row => {
    const emp = row['담당자명'] || row['사원명'];
    const val = parseNum(row['공급가액']);
    byEmp[emp] = (byEmp[emp] || 0) + val;
  });
  // console.log('Supply by Employee:', byEmp);

  // Attempt 4: Let's look for the exact sum 132,952,396 by trying different combinations
  // Maybe it's IL + MB + ...?
  const categories = Array.from(new Set(filtered.map(row => String(row['품목그룹1코드']))));
  console.log('Categories:', categories);

  categories.forEach(cat => {
    const sum = filtered.reduce((s, row) => String(row['품목그룹1코드']) === cat ? s + parseNum(row['공급가액']) : s, 0);
    console.log(`Category ${cat} Supply: ${sum.toLocaleString()}`);
  });

}

main();
