const fs = require('fs');

function parseAmount(s) {
  if (!s || s.trim() === '') return 0;
  let val = s.replace(/,/g, '').trim();
  if (val.startsWith('(') && val.endsWith(')')) {
      val = '-' + val.substring(1, val.length - 1);
  }
  return Number(val) || 0;
}

const content = fs.readFileSync('계정별원장.csv', 'utf8');
const lines = content.split('\n');

let netFlow = 0;
let targetDate = '2026/02/25';

for (let i = 0; i < lines.length; i++) {
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
        netFlow += debit - credit;
      }
    }
  }
}

console.log('Corrected Net Flow of 보통예금 up to Feb 25:', netFlow.toLocaleString());
const targetBalance = 501243038;
console.log('Implied starting balance for 보통예금:', (targetBalance - netFlow).toLocaleString());
