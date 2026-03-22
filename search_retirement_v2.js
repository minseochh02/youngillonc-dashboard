const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '계정별원장.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log('--- Searching for "연금" or "퇴직" ---');
    rawData.forEach((row, idx) => {
        const rowStr = JSON.stringify(row);
        if (rowStr.includes('연금') || rowStr.includes('퇴직')) {
            console.log(`Row ${idx}: ${rowStr}`);
        }
    });
} catch (e) {
    console.error('Error:', e.message);
}
