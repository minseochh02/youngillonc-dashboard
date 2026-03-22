const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '계정별원장.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    console.log('Sheet names:', workbook.SheetNames);

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        console.log(`Sheet: ${sheetName}, Rows: ${rawData.length}`);

        rawData.forEach((row, rowIdx) => {
            row.forEach((cell, colIdx) => {
                const cellStr = String(cell);
                if (cellStr.includes('퇴직연금')) {
                    console.log(`FOUND at [${sheetName}] Row ${rowIdx}, Col ${colIdx}: ${cellStr}`);
                    console.log(`Full Row: ${JSON.stringify(row)}`);
                }
            });
        });
    });
} catch (e) {
    console.error('Error:', e.message);
}
