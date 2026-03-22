const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(process.cwd(), '계정별원장.xlsx');

try {
    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log('--- Loose Search for "연금" or "퇴직" in ALL cells ---');
    rawData.forEach((row, rowIdx) => {
        row.forEach((cell, colIdx) => {
            const cellStr = String(cell);
            if (cellStr.includes('연금') || cellStr.includes('퇴직')) {
                console.log(`Row ${rowIdx}, Col ${colIdx}: "${cellStr}"`);
            }
        });
    });

    const accountNames = new Set();
    rawData.forEach(row => {
        if (row[2]) accountNames.add(String(row[2]).trim());
        if (row[4]) accountNames.add(String(row[4]).trim()); // Just in case columns are shifted
    });
    
    console.log('\n--- Checking for "퇴직연금운용자산" in unique names found ---');
    const matches = Array.from(accountNames).filter(name => name.includes('퇴직연금운용자산'));
    if (matches.length > 0) {
        console.log('Found matches:', matches);
    } else {
        console.log('No exact or partial matches for "퇴직연금운용자산" found in unique account list.');
    }

} catch (e) {
    console.error('Error:', e.message);
}
