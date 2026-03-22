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

  console.log('--- Searching for "IL" in PVL/CVL product names ---');
  filtered.forEach(row => {
    const cat = row['품목그룹1코드'];
    const name = String(row['품목명(규격)']);
    if ((cat === 'PVL' || cat === 'CVL') && (name.includes('IL') || name.includes('il'))) {
      console.log(`${cat} | ${name} | Supply: ${row['공급가액']}`);
    }
  });
}

main();
