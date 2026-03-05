import * as XLSX from 'xlsx';

const filePath = './PB4NPAMTL37TW9C.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets['구매현황'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const headers = data[1] as string[];
const rows = data.slice(2);

console.log('All headers:', headers);
console.log('\n');

const 일자Idx = headers.indexOf('일자');
const 품목그룹3코드Idx = headers.indexOf('품목그룹3코드');
const 중량Idx = headers.indexOf('중량');
const 창고명Idx = headers.indexOf('창고명');
const 거래처그룹1명Idx = headers.indexOf('거래처그룹1명');
const 품목명Idx = headers.indexOf('품목명');
const 구매처명Idx = headers.indexOf('구매처명');
const 품목그룹1코드Idx = headers.indexOf('품목그룹1코드');
const 품목그룹1명Idx = headers.indexOf('품목그룹1명');

// All Nov 5th FLA purchases with 창고명 = 창원
const nov5Changwon = rows.filter(row => {
  const date = String(row[일자Idx]);
  const code = row[품목그룹3코드Idx];
  const warehouse = String(row[창고명Idx] || '');
  return date.includes('2025/11/05') && code === 'FLA' && warehouse.includes('창원');
});

console.log('=== Nov 5th FLA with 창고명=창원 - FULL DETAILS ===\n');

nov5Changwon.forEach((row, idx) => {
  console.log(`[Transaction ${idx + 1}]`);
  headers.forEach((header, headerIdx) => {
    if (row[headerIdx] !== undefined && row[headerIdx] !== null && row[headerIdx] !== '') {
      console.log(`  ${header}: ${row[headerIdx]}`);
    }
  });
  console.log('\n');
});
