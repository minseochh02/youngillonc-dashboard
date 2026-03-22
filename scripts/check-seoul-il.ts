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

  const seoulEmps = ['김건우', '정현우', '김중경', '이승복', '김기진', '김윤석', '조성호', '임재창'];
  const seoulILSupply = filtered.reduce((s, row) => seoulEmps.includes(row['현 담당자']) && row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0 ? s + row['공급가액'] : s, 0);
  console.log(`Seoul Employees Positive IL Supply Sum: ${seoulILSupply.toLocaleString()}`);

  const diff = 132952396 - seoulILSupply;
  console.log(`Diff to target: ${diff.toLocaleString()}`);

}

main();
