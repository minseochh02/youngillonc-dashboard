const fs = require('fs');

function parseAmount(s) {
  if (!s || s.trim() === '') return 0;
  return Number(s.replace(/,/g, '').trim()) || 0;
}

const content = fs.readFileSync('계정별원장.csv', 'utf8');
const lines = content.split('\n');

let oedamFlow = 0;
let targetDate = '2026/02/25';

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
      if (detail.includes('매출채권')) {
        oedamFlow += debit;
      }
      if (detail.includes('어음만기')) {
        oedamFlow -= credit;
      }
    }
  }
}

console.log('Net Flow of 외담대 up to Feb 25:', oedamFlow.toLocaleString());
const targetFeb26Prev = 1091111109;
console.log('Implied starting balance for 외담대:', (targetFeb26Prev - oedamFlow).toLocaleString());
