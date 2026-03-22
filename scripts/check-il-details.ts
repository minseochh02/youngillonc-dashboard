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

  console.log('--- IL Category Rows Details ---');
  const ilRows = filtered.filter(row => row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0);
  
  ilRows.forEach(row => {
    console.log(`${row['거래처그룹1명']} | ${row['거래처명']} | ${row['담당자명']} | Supply: ${row['공급가액']}`);
  });

  // Check MB branch IL
  const mbIL = filtered.filter(row => row['거래처그룹1명'] === 'MB' && row['품목그룹1코드'] === 'IL');
  console.log(`\nMB Branch IL rows: ${mbIL.length}`);

}

main();
