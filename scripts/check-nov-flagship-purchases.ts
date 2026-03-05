import * as XLSX from 'xlsx';

const filePath = './PB4NPAMTL37TW9C.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets['구매현황'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Skip header rows (row 0 is title, row 1 is headers)
const headers = data[1] as string[];
const rows = data.slice(2);

console.log('Headers:', headers);
console.log('Total data rows:', rows.length);

// Find column indices
const 일자Idx = headers.indexOf('일자');
const 품목그룹3코드Idx = headers.indexOf('품목그룹3코드');
const 중량Idx = headers.indexOf('중량');
const 창고명Idx = headers.indexOf('창고명');
const 거래처그룹1명Idx = headers.indexOf('거래처그룹1명');
const 품목명Idx = headers.indexOf('품목명');

console.log('\nColumn indices:');
console.log('일자:', 일자Idx);
console.log('품목그룹3코드:', 품목그룹3코드Idx);
console.log('중량:', 중량Idx);
console.log('창고명:', 창고명Idx);
console.log('거래처그룹1명:', 거래처그룹1명Idx);

// Find all FLA purchases
const flaPurchases = rows.filter(row => {
  const code = row[품목그룹3코드Idx];
  return code === 'FLA';
});

console.log('\n=== Flagship (FLA) Purchases ===');
console.log('Total FLA purchases:', flaPurchases.length);

if (flaPurchases.length > 0) {
  console.log('\nFirst 10 FLA purchases:');
  flaPurchases.slice(0, 10).forEach((row, idx) => {
    console.log(`\nRow ${idx + 1}:`);
    console.log('  일자:', row[일자Idx]);
    console.log('  품목명:', row[품목명Idx]);
    console.log('  중량:', row[중량Idx]);
    console.log('  창고명:', row[창고명Idx]);
    console.log('  거래처그룹1명:', row[거래처그룹1명Idx]);
  });

  // Calculate total for Nov 1st, 창원
  const nov1Changwon = flaPurchases.filter(row => {
    const date = String(row[일자Idx]);
    const warehouse = String(row[창고명Idx] || '');
    const group = String(row[거래처그룹1명Idx] || '');

    return date.includes('2025/11/01') &&
           (warehouse.includes('창원') || group.includes('창원'));
  });

  console.log('\n=== Nov 1st, 창원 Flagship Purchases ===');
  console.log('Count:', nov1Changwon.length);

  if (nov1Changwon.length > 0) {
    let totalWeight = 0;
    nov1Changwon.forEach(row => {
      const weight = Number(row[중량Idx]) || 0;
      totalWeight += weight;
      console.log('\n  품목명:', row[품목명Idx]);
      console.log('  중량:', weight);
      console.log('  창고명:', row[창고명Idx]);
      console.log('  거래처그룹1명:', row[거래처그룹1명Idx]);
    });
    console.log('\nTotal weight:', totalWeight, 'kg');
  }
}
