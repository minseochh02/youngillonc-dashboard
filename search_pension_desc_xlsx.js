const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '계정별원장.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log('--- Searching for "퇴직연금" in descriptions (column 1) ---');
    rawData.forEach((row, idx) => {
        const description = String(row[1] || '');
        if (description.includes('퇴직연금')) {
            console.log(`Row ${idx}: ${JSON.stringify(row)}`);
        }
    });
} catch (e) {
    console.error('Error:', e.message);
}
