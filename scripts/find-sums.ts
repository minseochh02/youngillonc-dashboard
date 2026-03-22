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

  // Targets
  // 서울,화성 IL    132,952,396 
  // 창원    103,078,140 

  console.log('--- Testing combinations for Changwon (103,078,140) ---');
  // Maybe it's AVI total supply? (97,224,960)
  // Maybe AVI + something?
  
  const aviSupply = filtered.reduce((s, row) => row['품목그룹1코드'] === 'AVI' && row['공급가액'] > 0 ? s + row['공급가액'] : s, 0);
  console.log(`AVI Positive Supply: ${aviSupply.toLocaleString()}`);
  
  const diffCW = 103078140 - aviSupply;
  console.log(`Difference for Changwon: ${diffCW.toLocaleString()}`);

  // Let's check for any category or group that sums to this diff
  const byGroup = {};
  filtered.forEach(row => {
    if (row['공급가액'] > 0) {
      const key = `${row['거래처그룹1명']} - ${row['품목그룹1코드']}`;
      byGroup[key] = (byGroup[key] || 0) + row['공급가액'];
    }
  });
  console.log('\nGroups and their Positive Supply:');
  Object.entries(byGroup).forEach(([k, v]: any) => {
    if (Math.abs(v - diffCW) < 1000000) console.log(`${k}: ${v.toLocaleString()}`);
  });

  console.log('\n--- Testing combinations for Seoul, Hwaseong IL (132,952,396) ---');
  // We found Hwaseong+Changwon+Busan IL Supply = 132,969,600
  // Diff = 17,204
  
}

main();
