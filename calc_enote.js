const fs = require('fs');

function parseAmount(s) {
  if (!s || s.trim() === '') return 0;
  return Number(s.replace(/,/g, '').trim()) || 0;
}

const content = fs.readFileSync('계정별원장.csv', 'utf8');
const lines = content.split('\n');

let enoteFlow = 0;
let targetDate = '2026/02/28';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  const cols = line.split('","').map(c => c.replace(/"/g, '').trim());
  
  const date = cols[0];
  const account = cols[2];
  const detail = cols[1] || '';
  const debit = parseAmount(cols[4]);
  const credit = parseAmount(cols[5]);
  
  if (account === '받을어음') {
    if (date <= targetDate) {
      if (detail.includes('전자어음')) {
        enoteFlow += debit;
      }
      // If it's not 매출채권 and not 어음만기, it might be enote decrease?
      // Guide says: "전자어음 balance relationship: portion not tagged as 매출채권"
    }
  }
}

console.log('Total Net Flow of 전자어음 up to Feb 28 (Debits only):', enoteFlow.toLocaleString());
const targetFeb28Enote = 172286440;
console.log('Implied starting balance for 전자어음 (if only debits):', (targetFeb28Enote - enoteFlow).toLocaleString());
