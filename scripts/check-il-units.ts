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

  const ilRows = filtered.filter(row => row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0);
  
  const drumIL = ilRows.filter(row => row['단위'] === 'Drum');
  const sumDrumIL = drumIL.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`Drum IL Positive Supply Sum: ${sumDrumIL.toLocaleString()}`);

  const boxIL = ilRows.filter(row => row['단위'] === 'box');
  const sumBoxIL = boxIL.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`Box IL Positive Supply Sum: ${sumBoxIL.toLocaleString()}`);

}

main();
