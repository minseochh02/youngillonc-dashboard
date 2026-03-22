const fs = require('fs');

function parseAmount(s) {
  if (!s || s.trim() === '') return 0;
  return Number(s.replace(/,/g, '').trim()) || 0;
}

const content = fs.readFileSync('계정별원장.csv', 'utf8');
const lines = content.split('\n');

let balance = 1785378579;
let targetDate = '2026/02/24';

for (let i = 41; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const cols = line.split('","').map(c => c.replace(/"/g, '').trim());
  const date = cols[0];
  const account = cols[2];
  const debit = parseAmount(cols[4]);
  const credit = parseAmount(cols[5]);
  
  if (account === '보통예금') {
    if (date && date.startsWith('2026')) {
      if (date <= targetDate) {
        balance += debit - credit;
      }
    }
  }
}

console.log('보통예금 Balance as of 2026/02/24 (전잔 for 25th):', balance.toLocaleString());
