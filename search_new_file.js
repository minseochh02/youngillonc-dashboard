const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '1iKvrLravEbuFmPY.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    console.log('Sheet names:', workbook.SheetNames);

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        console.log(`Sheet: ${sheetName}, Rows: ${rawData.length}`);

        rawData.forEach((row, rowIdx) => {
            const rowStr = JSON.stringify(row);
            if (rowStr.includes('퇴직연')) {
                console.log(`FOUND at [${sheetName}] Row ${rowIdx}: ${rowStr}`);
            }
        });
    });
} catch (e) {
    console.error('Error reading XLSX:', e.message);
}
