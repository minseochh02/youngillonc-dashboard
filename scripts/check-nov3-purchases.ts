import * as XLSX from 'xlsx';

const filePath = './PB4NPAMTL37TW9C.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets['구매현황'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const headers = data[1] as string[];
const rows = data.slice(2);

const 일자Idx = headers.indexOf('일자');
const 품목그룹1코드Idx = headers.indexOf('품목그룹1코드');
const 품목그룹1명Idx = headers.indexOf('품목그룹1명');
const 중량Idx = headers.indexOf('중량');
const 창고명Idx = headers.indexOf('창고명');
const 거래처그룹1명Idx = headers.indexOf('거래처그룹1명');
const 품목명Idx = headers.indexOf('품목명');
const 구매처명Idx = headers.indexOf('구매처명');

console.log('=== Nov 3rd, 2025 - Mobil Purchases ===\n');

// Filter for Nov 3rd
const nov3 = rows.filter(row => {
  const date = String(row[일자Idx]);
  return date.includes('2025/11/03');
});

console.log('Total purchases on Nov 3rd:', nov3.length);

// Filter for Mobil products (IL, PVL, CVL, AVI, MB)
const mobilCodes = ['IL', 'PVL', 'CVL', 'AVI', 'MB'];
const nov3Mobil = nov3.filter(row => {
  const code = row[품목그룹1코드Idx];
  return mobilCodes.includes(code);
});

console.log('Mobil purchases on Nov 3rd:', nov3Mobil.length);

let totalWeight = 0;
const byCode = {};

nov3Mobil.forEach(row => {
  const weight = Number(row[중량Idx]) || 0;
  const code = row[품목그룹1코드Idx];

  totalWeight += weight;

  if (!byCode[code]) {
    byCode[code] = { count: 0, weight: 0, items: [] };
  }
  byCode[code].count++;
  byCode[code].weight += weight;
  byCode[code].items.push({
    품목명: row[품목명Idx],
    중량: weight,
    창고명: row[창고명Idx]
  });
});

console.log('\n=== Breakdown by Product Code ===');
Object.keys(byCode).forEach(code => {
  console.log(`\n${code}: ${byCode[code].weight} kg (${byCode[code].count} items)`);
  byCode[code].items.slice(0, 5).forEach(item => {
    console.log(`  - ${item.품목명}: ${item.중량}kg (${item.창고명})`);
  });
  if (byCode[code].items.length > 5) {
    console.log(`  ... and ${byCode[code].items.length - 5} more items`);
  }
});

console.log('\n=== Total ===');
console.log('Total weight:', totalWeight, 'kg');
console.log('Total volume (assuming 1L ≈ 1kg):', totalWeight, 'L');
console.log('Expected:', '10,621 L');
console.log('Match:', totalWeight === 10621 ? '✓ YES' : '✗ NO');
