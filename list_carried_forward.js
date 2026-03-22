const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '계정별원장.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log('--- Account Names for 이월잔액 ---');
    let lastAccountName = '';
    rawData.forEach((row, idx) => {
        if (row[2] && row[2] !== '계정명') {
            lastAccountName = row[2];
        }
        if (row[1] === '이월잔액') {
            // Check rows above/below to find account name if not in the same row
            let account = row[2] || lastAccountName;
            if (!account) {
                // Peek ahead for the first transaction
                for (let j = idx + 1; j < idx + 10 && j < rawData.length; j++) {
                    if (rawData[j][2]) {
                        account = rawData[j][2];
                        break;
                    }
                }
            }
            console.log(`Row ${idx}: Account: [${account}], Balance: ${row[4] || row[7]}`);
        }
    });
} catch (e) {
    console.error('Error:', e.message);
}
