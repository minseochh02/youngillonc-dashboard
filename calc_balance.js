const fs = require('fs');

function parseAmount(s) {
  if (!s) return 0;
  return Number(s.replace(/,/g, '').trim()) || 0;
}

const content = fs.readFileSync('계정별원장.csv', 'utf8');
const lines = content.split('\n');

let inBogu = false;
let balance = 0;
let targetDate = '2026/02/25';
let boguLastBalance = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const cols = line.split('","').map(c => c.replace(/"/g, '').trim());
  
  if (cols[2] === '보통예금' || (cols[1] === '이월잔액' && inBogu === false && i > 40)) {
    if (cols[1] === '이월잔액') {
      balance = parseAmount(cols[4]);
      inBogu = true;
      continue;
    }
    
    const date = cols[0];
    const debit = parseAmount(cols[4]);
    const credit = parseAmount(cols[5]);
    
    if (date <= targetDate) {
      balance += debit - credit;
      boguLastBalance = balance;
    } else {
      // Different account or past date
      if (date && !date.startsWith('2026')) {
          // might be end of bogu section
      }
    }
  } else if (inBogu && cols[2] && cols[2] !== '보통예금' && cols[2] !== '') {
      inBogu = false;
  }
}

console.log('Balance as of 2026/02/25:', boguLastBalance.toLocaleString());
