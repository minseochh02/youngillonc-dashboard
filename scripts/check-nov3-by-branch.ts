import * as XLSX from 'xlsx';

const filePath = './PB4NPAMTL37TW9C.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets['구매현황'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const headers = data[1] as string[];
const rows = data.slice(2);

const 일자Idx = headers.indexOf('일자');
const 품목그룹1코드Idx = headers.indexOf('품목그룹1코드');
const 중량Idx = headers.indexOf('중량');
const 창고명Idx = headers.indexOf('창고명');
const 거래처그룹1명Idx = headers.indexOf('거래처그룹1명');

console.log('=== Nov 3rd Mobil Purchases by Branch ===\n');

const nov3 = rows.filter(row => {
  const date = String(row[일자Idx]);
  return date.includes('2025/11/03');
});

const mobilCodes = ['IL', 'PVL', 'CVL', 'AVI', 'MB'];
const nov3Mobil = nov3.filter(row => {
  const code = row[품목그룹1코드Idx];
  return mobilCodes.includes(code);
});

const byBranch = {};

nov3Mobil.forEach(row => {
  const weight = Number(row[중량Idx]) || 0;
  const group = String(row[거래처그룹1명Idx] || 'Unknown');

  if (!byBranch[group]) {
    byBranch[group] = 0;
  }
  byBranch[group] += weight;
});

console.log('Breakdown by 거래처그룹1명:');
Object.keys(byBranch)
  .sort((a, b) => byBranch[b] - byBranch[a])
  .forEach(branch => {
    console.log(`  ${branch}: ${byBranch[branch].toLocaleString()} L (${byBranch[branch].toLocaleString()} L)`);
    if (byBranch[branch] === 10621) {
      console.log('    ★ MATCH! This equals 10,621 L');
    }
  });

// Also check by 창고명
const byWarehouse = {};

nov3Mobil.forEach(row => {
  const weight = Number(row[중량Idx]) || 0;
  const warehouse = String(row[창고명Idx] || 'Unknown');

  if (!byWarehouse[warehouse]) {
    byWarehouse[warehouse] = 0;
  }
  byWarehouse[warehouse] += weight;
});

console.log('\nBreakdown by 창고명:');
Object.keys(byWarehouse)
  .sort((a, b) => byWarehouse[b] - byWarehouse[a])
  .forEach(warehouse => {
    console.log(`  ${warehouse}: ${byWarehouse[warehouse].toLocaleString()} L (${byWarehouse[warehouse].toLocaleString()} L)`);
    if (byWarehouse[warehouse] === 10621) {
      console.log('    ★ MATCH! This equals 10,621 L');
    }
  });
