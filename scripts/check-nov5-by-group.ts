import * as XLSX from 'xlsx';

const filePath = './PB4NPAMTL37TW9C.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets['구매현황'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const headers = data[1] as string[];
const rows = data.slice(2);

const 일자Idx = headers.indexOf('일자');
const 품목그룹3코드Idx = headers.indexOf('품목그룹3코드');
const 중량Idx = headers.indexOf('중량');
const 창고명Idx = headers.indexOf('창고명');
const 거래처그룹1명Idx = headers.indexOf('거래처그룹1명');
const 품목명Idx = headers.indexOf('품목명');

// All Nov 5th FLA purchases
const nov5Fla = rows.filter(row => {
  const date = String(row[일자Idx]);
  const code = row[품목그룹3코드Idx];
  return date.includes('2025/11/05') && code === 'FLA';
});

console.log('=== Nov 5th Flagship - Comparison ===\n');

// Method 1: Current filter (warehouse OR group)
const currentFilter = nov5Fla.filter(row => {
  const warehouse = String(row[창고명Idx] || '');
  const group = String(row[거래처그룹1명Idx] || '');
  return warehouse.includes('창원') || group.includes('창원');
});

console.log('Method 1: Current Filter (창고명 OR 거래처그룹1명)');
console.log('Count:', currentFilter.length);
let currentTotal = 0;
currentFilter.forEach(row => {
  const weight = Number(row[중량Idx]) || 0;
  currentTotal += weight;
  console.log(`  ${row[품목명Idx]} - ${weight}L (창고: ${row[창고명Idx]}, 그룹: ${row[거래처그룹1명Idx]})`);
});
console.log('Total:', currentTotal, 'L\n');

// Method 2: Group-only filter
const groupOnlyFilter = nov5Fla.filter(row => {
  const group = String(row[거래처그룹1명Idx] || '');
  return group.includes('창원');
});

console.log('Method 2: Group-Only Filter (거래처그룹1명 ONLY)');
console.log('Count:', groupOnlyFilter.length);
if (groupOnlyFilter.length > 0) {
  let groupTotal = 0;
  groupOnlyFilter.forEach(row => {
    const weight = Number(row[중량Idx]) || 0;
    groupTotal += weight;
    console.log(`  ${row[품목명Idx]} - ${weight}L (창고: ${row[창고명Idx]}, 그룹: ${row[거래처그룹1명Idx]})`);
  });
  console.log('Total:', groupTotal, 'L');
} else {
  console.log('Total: 0 L (No purchases with 거래처그룹1명 containing "창원")');
}

console.log('\n=== Difference ===');
console.log(`Current filter: ${currentTotal} L`);
console.log(`Group-only filter: ${groupOnlyFilter.length > 0 ? groupOnlyFilter.reduce((sum, row) => sum + (Number(row[중량Idx]) || 0), 0) : 0} L`);
console.log(`Difference: ${currentTotal - (groupOnlyFilter.length > 0 ? groupOnlyFilter.reduce((sum, row) => sum + (Number(row[중량Idx]) || 0), 0) : 0)} L`);
