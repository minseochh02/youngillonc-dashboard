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

console.log('=== Nov 5th IL Flagship Verification ===\n');

// Old filter (FLA only)
const oldFilter = rows.filter(row => {
  const date = String(row[일자Idx]);
  const code3 = row[품목그룹3코드Idx];
  const warehouse = String(row[창고명Idx] || '');
  const group = String(row[거래처그룹1명Idx] || '');

  return date.includes('2025/11/05') &&
         code3 === 'FLA' &&
         (warehouse.includes('창원') || group.includes('창원'));
});

const oldTotal = oldFilter.reduce((sum, row) => sum + (Number(row[중량Idx]) || 0), 0);

console.log('OLD Filter (품목그룹3코드 = FLA only):');
console.log('Count:', oldFilter.length);
console.log('Total:', oldTotal, 'L');
oldFilter.forEach(row => {
    console.log(`  - ${row[품목명Idx]}: ${row[중량Idx]}L (품목그룹1코드: ${row[품목그룹1코드Idx]})`);
});

// New filter (FLA + IL)
const newFilter = rows.filter(row => {
  const date = String(row[일자Idx]);
  const code3 = row[품목그룹3코드Idx];
  const code1 = row[품목그룹1코드Idx];
  const warehouse = String(row[창고명Idx] || '');
  const group = String(row[거래처그룹1명Idx] || '');

  return date.includes('2025/11/05') &&
         code3 === 'FLA' &&
         code1 === 'IL' &&
         (warehouse.includes('창원') || group.includes('창원'));
});

const newTotal = newFilter.reduce((sum, row) => sum + (Number(row[중량Idx]) || 0), 0);

console.log('\nNEW Filter (품목그룹3코드 = FLA AND 품목그룹1코드 = IL):');
console.log('Count:', newFilter.length);
console.log('Total:', newTotal, 'L');
newFilter.forEach(row => {
    console.log(`  - ${row[품목명Idx]}: ${row[중량Idx]}L (품목그룹1코드: ${row[품목그룹1코드Idx]})`);
});

console.log('\n=== Result ===');
console.log(`Changed from ${oldTotal}L to ${newTotal}L`);
console.log(`Employee reported: 500kg`);
console.log(`Match: ${newTotal === 500 ? '✓ YES' : '✗ NO'}`);
