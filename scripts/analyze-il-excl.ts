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

  console.log('--- Testing Exclusions for IL Category Supply ---');

  const ilRows = filtered.filter(row => row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0);
  const totalIL = ilRows.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`Initial Total IL Supply: ${totalIL.toLocaleString()}`);

  // Try excluding 김도량
  const exclDoRyang = ilRows.filter(row => row['담당자명'] !== '김도량');
  const sumExclDoRyang = exclDoRyang.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`Excluding 김도량: ${sumExclDoRyang.toLocaleString()}`);

  // Try excluding specific clients like "영일"
  const exclYoungil = ilRows.filter(row => !String(row['거래처명']).includes('영일'));
  const sumExclYoungil = exclYoungil.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`Excluding "영일" clients: ${sumExclYoungil.toLocaleString()}`);

  // Look for the exact difference
  const diff = totalIL - target;
  console.log(`\nLooking for rows summing to ${diff.toLocaleString()}...`);
  
  ilRows.forEach(row => {
    if (Math.abs(row['공급가액'] - diff) < 10) {
      console.log('EXACT MATCH ROW:', row);
    }
  });

  // Maybe it's "화성사업소" IL + "MB" IL?
  const shIL = ilRows.filter(row => row['거래처그룹1명'] === '화성사업소' || row['거래처그룹1명'] === 'MB');
  const sumSHIL = shIL.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`\n화성사업소 + MB IL Supply: ${sumSHIL.toLocaleString()}`);

}

main();
