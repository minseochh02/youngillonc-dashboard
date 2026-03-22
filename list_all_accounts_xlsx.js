const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '계정별원장.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    const accounts = new Set();
    rawData.forEach(row => {
        if (row[2] && row[2] !== '계정명') {
            accounts.add(row[2].trim());
        }
    });

    console.log('--- All Unique Account Names in XLSX ---');
    console.log(Array.from(accounts).sort().join('\n'));
} catch (e) {
    console.error('Error:', e.message);
}
