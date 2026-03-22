const fs = require('fs');

function parseAmount(s) {
  if (!s || s.trim() === '') return 0;
  return Number(s.replace(/,/g, '').trim()) || 0;
}

const content = fs.readFileSync('계정별원장.csv', 'utf8');
const lines = content.split('\n');

let totalDeb = 0;
let totalCre = 0;
let targetDate = '2026/02/25';

const fundAccounts = [
  '현금 시재금-서울', '현금 시재금-창원', '현금 시재금-화성',
  '보통예금', '외화예금', '받을어음',
  '정기예.적금', '장기금융상품', '기타단기금융상품'
];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  const cols = line.split('","').map(c => c.replace(/"/g, '').trim());
  const date = cols[0];
  const account = cols[2];
  const debit = parseAmount(cols[4]);
  const credit = parseAmount(cols[5]);
  
  if (date === targetDate && fundAccounts.includes(account)) {
    totalDeb += debit;
    totalCre += credit;
  }
}

console.log(`Totals for ${targetDate} across Fund Accounts:`);
console.log('Total Deb (당입):', totalDeb.toLocaleString());
console.log('Total Cre (지출):', totalCre.toLocaleString());
