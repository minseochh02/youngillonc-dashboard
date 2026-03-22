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

  console.log('--- IL Supply by B2B사업소 (Positive) ---');
  const b2bHwaseong = filtered.filter(row => row['B2B사업소'] === '화성사업소' && row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0);
  const sumB2BHwaseong = b2bHwaseong.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`B2B Hwaseong IL Supply: ${sumB2BHwaseong.toLocaleString()}`);

  const b2bBusan = filtered.filter(row => row['B2B사업소'] === '부산사업소' && row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0);
  const sumB2BBusan = b2bBusan.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`B2B Busan IL Supply: ${sumB2BBusan.toLocaleString()}`);

  const b2bChangwon = filtered.filter(row => row['B2B사업소'] === '경남사업소' && row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0);
  const sumB2BChangwon = b2bChangwon.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`B2B Changwon IL Supply: ${sumB2BChangwon.toLocaleString()}`);

  const b2bB2C = filtered.filter(row => row['B2B사업소'] === 'B2C' && row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0);
  const sumB2BB2C = b2bB2C.reduce((s, row) => s + row['공급가액'], 0);
  console.log(`B2B B2C IL Supply: ${sumB2BB2C.toLocaleString()}`);

  const total = sumB2BHwaseong + sumB2BBusan + sumB2BChangwon + sumB2BB2C;
  console.log(`Total: ${total.toLocaleString()}`);

}

main();
