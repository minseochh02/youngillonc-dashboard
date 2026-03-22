const fs = require('fs');

function parseAmount(s) {
  if (!s || s.trim() === '') return 0;
  return Number(s.replace(/,/g, '').trim()) || 0;
}

const content = fs.readFileSync('계정별원장.csv', 'utf8');
const lines = content.split('\n');

let balance = 1785378579; // Line 41: 이월잔액 for 보통예금
let targetDate = '2026/02/25';
let boguLastBalance = balance;

// Start from line 42 (index 41)
for (let i = 41; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  // Split by "," and clean up quotes and tabs
  const cols = line.split('","').map(c => c.replace(/"/g, '').trim());
  
  const date = cols[0];
  const account = cols[2];
  const debit = parseAmount(cols[4]);
  const credit = parseAmount(cols[5]);
  
  // If we hit a new account section, stop
  if (account && account !== '보통예금') {
    break;
  }
  
  if (date <= targetDate) {
    balance += debit - credit;
    boguLastBalance = balance;
  }
  
  // For debugging: show the last entry of Feb 25
  if (date === '2026/02/25') {
      // console.log(`[${i+1}] ${date} | Balance: ${balance.toLocaleString()}`);
  }
}

console.log('Starting Balance:', (1785378579).toLocaleString());
console.log('Balance as of 2026/02/25:', boguLastBalance.toLocaleString());
