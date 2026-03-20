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
const 구매처명Idx = headers.indexOf('구매처명');

// All Nov 1st FLA purchases
const nov1Fla = rows.filter(row => {
  const date = String(row[일자Idx]);
  const code = row[품목그룹3코드Idx];
  return date.includes('2025/11/01') && code === 'FLA';
});

console.log('=== ALL Nov 1st Flagship Purchases ===');
console.log('Total count:', nov1Fla.length);

if (nov1Fla.length > 0) {
  let totalWeight = 0;
  nov1Fla.forEach((row, idx) => {
    const weight = Number(row[중량Idx]) || 0;
    totalWeight += weight;
    console.log(`\n[${idx + 1}]`);
    console.log('  구매처명:', row[구매처명Idx]);
    console.log('  품목명:', row[품목명Idx]);
    console.log('  중량:', weight);
    console.log('  창고명:', row[창고명Idx]);
    console.log('  거래처그룹1명:', row[거래처그룹1명Idx]);
  });
  console.log('\n=== Total Volume:', totalWeight, 'L ===');
}
