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

  const westEmps = ['이영광', '안천수', '문경복', '정승윤', '이병훈', '주우철', '김중호', '인천'];
  const westSupply = filtered.reduce((s, row) => westEmps.includes(row['현 담당자']) && row['공급가액'] > 0 ? s + row['공급가액'] : s, 0);
  console.log(`West Employees Positive Supply Sum: ${westSupply.toLocaleString()}`);

  const eastEmps = ['심경섭', '이상욱', '박태원', '박경식', '김태일', '하남', '박문희'];
  const eastSupply = filtered.reduce((s, row) => eastEmps.includes(row['현 담당자']) && row['공급가액'] > 0 ? s + row['공급가액'] : s, 0);
  console.log(`East Employees Positive Supply Sum: ${eastSupply.toLocaleString()}`);

  const busanEmps = ['김철주', '이상만', '부산'];
  const busanSupply = filtered.reduce((s, row) => busanEmps.includes(row['현 담당자']) && row['공급가액'] > 0 ? s + row['공급가액'] : s, 0);
  console.log(`Busan Employees Positive Supply Sum: ${busanSupply.toLocaleString()}`);

  const centralEmps = ['송주탁', '임희영', '황종석', '화성auto'];
  const centralSupply = filtered.reduce((s, row) => centralEmps.includes(row['현 담당자']) && row['공급가액'] > 0 ? s + row['공급가액'] : s, 0);
  console.log(`Central Employees Positive Supply Sum: ${centralSupply.toLocaleString()}`);

}

main();
