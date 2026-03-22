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

  const empBranchMap = {};
  filtered.forEach(row => {
    const emp = row['현 담당자'];
    const branch = row['거래처그룹1명'];
    if (!empBranchMap[emp]) empBranchMap[emp] = new Set();
    empBranchMap[emp].add(branch);
  });

  console.log('--- Employee to Branch Mapping ---');
  Object.entries(empBranchMap).forEach(([emp, branches]: any) => {
    console.log(`${emp}: ${Array.from(branches).join(', ')}`);
  });
}

main();
