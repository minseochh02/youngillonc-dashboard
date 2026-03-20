import * as XLSX from 'xlsx';

const filePath = './PB4NPAMTL37TW9C.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets['구매현황'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const headers = data[1] as string[];
const rows = data.slice(2);

const 일자Idx = headers.indexOf('일자');
const 품목그룹3코드Idx = headers.indexOf('품목그룹3코드');
const 품목그룹1코드Idx = headers.indexOf('품목그룹1코드');
const 중량Idx = headers.indexOf('중량');
const 창고명Idx = headers.indexOf('창고명');
const 거래처그룹1명Idx = headers.indexOf('거래처그룹1명');
const 품목명Idx = headers.indexOf('품목명');

console.log('=== Nov 1st IL Flagship - Purchases ===\n');

// FLA + IL filter for Nov 1st
const nov1 = rows.filter(row => {
  const date = String(row[일자Idx]);
  const code3 = row[품목그룹3코드Idx];
  const code1 = row[품목그룹1코드Idx];
  const warehouse = String(row[창고명Idx] || '');
  const group = String(row[거래처그룹1명Idx] || '');

  return date.includes('2025/11/01') &&
         code3 === 'FLA' &&
         code1 === 'IL' &&
         (warehouse.includes('창원') || group.includes('창원'));
});

const total = nov1.reduce((sum, row) => sum + (Number(row[중량Idx]) || 0), 0);

console.log('IL Flagship purchases for 창원:');
console.log('Count:', nov1.length);
console.log('Total:', total, 'L');

if (nov1.length > 0) {
  nov1.forEach(row => {
    console.log(`  - ${row[품목명Idx]}: ${row[중량Idx]}L`);
  });
} else {
  console.log('  (No IL flagship purchases for 창원 on Nov 1st)');
}
