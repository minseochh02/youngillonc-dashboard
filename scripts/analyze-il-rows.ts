import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  const filePath = 'REPORT/[참고] 2602 판매실적.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[] = XLSX.utils.sheet_to_json(sheet);

  const start = 46079;
  const end = 46081;
  const ilRows = data.filter(row => row['일자'] >= start && row['일자'] <= end && row['품목그룹1코드'] === 'IL' && row['공급가액'] > 0);

  console.log(`Positive IL rows: ${ilRows.length}`);
  
  const diff = 133145964 - 132952396;
  console.log(`Looking for rows with Supply around ${diff.toLocaleString()} or combinations...`);

  ilRows.sort((a, b) => a['공급가액'] - b['공급가액']);
  
  for (const row of ilRows) {
    if (Math.abs(row['공급가액'] - diff) < 100) {
      console.log('MATCH FOUND:', row);
    }
  }

  // Check for specific clients or branches that might be excluded
  const byBranch = {};
  ilRows.forEach(row => {
    const b = row['거래처그룹1명'];
    byBranch[b] = (byBranch[b] || 0) + row['공급가액'];
  });
  console.log('\n--- Positive IL Supply by Branch ---');
  console.table(byBranch);

  // Maybe Seoul + Hwaseong + Busan + Changwon + Central?
  // User listed:
  // 서울,화성 IL    132,952,396 
  // 창원    103,078,140 
  // 화성auto(남부)  - 926,031 
  // 화성auto(중부)    19,841,120 
  // 인천(서부)    26,549,858 
  // 남양주(동부)    3,773,771 
  // 제주    1,272,200 
  // 부산    26,980,250 

  // Total of these: 132,952,396 + 103,078,140 - 926,031 + 19,841,120 + 26,549,858 + 3,773,771 + 1,272,200 + 26,980,250 = 313,521,704
}

main();
