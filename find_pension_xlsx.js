const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '계정별원장.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    console.log('Sheet names:', workbook.SheetNames);

    for (const sheetName of workbook.SheetNames) {
        console.log(`\nScanning sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        rawData.forEach((row, idx) => {
            const rowStr = JSON.stringify(row);
            if (rowStr.includes('퇴직연금운용자산') || rowStr.includes('퇴직연금')) {
                console.log(`Row ${idx}: ${rowStr}`);
            }
        });
    }
} catch (e) {
    console.error('Error reading XLSX:', e.message);
}
