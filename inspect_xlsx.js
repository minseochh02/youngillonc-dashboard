const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '계정별원장.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log(`Total rows: ${rawData.length}`);
    
    // Check first 50 rows
    console.log('\n--- First 50 rows ---');
    rawData.slice(0, 50).forEach((row, idx) => {
        if (row.length > 0 && row.some(cell => cell !== '')) {
            console.log(`Row ${idx}: ${JSON.stringify(row)}`);
        }
    });

    // Case-insensitive search for keywords
    console.log('\n--- Searching for keywords ---');
    const keywords = ['퇴직', '연금', '운용', '자산'];
    rawData.forEach((row, idx) => {
        const rowStr = JSON.stringify(row);
        if (keywords.some(kw => rowStr.includes(kw))) {
            console.log(`Row ${idx}: ${rowStr}`);
        }
    });
} catch (e) {
    console.error('Error:', e.message);
}
