const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '1iKvrLravEbuFmPY.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log('--- Transactions for 퇴직연금운용자산 (Rows 4714+) ---');
    // Start from Row 4714 and look for subsequent rows until account changes
    for (let i = 4714; i < rawData.length; i++) {
        const row = rawData[i];
        const rowStr = JSON.stringify(row);
        
        // If the row contains a different account code or name after the pension section, stop
        if (i > 4716 && row[4] && row[4] !== '퇴직연금운용자산' && row[4] !== '') {
            break;
        }
        
        if (row.some(cell => cell !== '')) {
            console.log(`Row ${i}: ${rowStr}`);
        }
    }
} catch (e) {
    console.error('Error:', e.message);
}
