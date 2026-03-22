const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '1iKvrLravEbuFmPY.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log('--- Account Names for 이월잔액 in 1iKvrLravEbuFmPY.xlsx ---');
    let lastAccountName = '';
    rawData.forEach((row, idx) => {
        if (row[4] && row[4] !== '계정명') {
            lastAccountName = row[4];
        }
        if (row[2] === '이월잔액') {
            const account = row[4] || lastAccountName;
            console.log(`Row ${idx}: Account: [${account}], Balance: ${row[9] || row[11]}`);
        }
    });
} catch (e) {
    console.error('Error:', e.message);
}
