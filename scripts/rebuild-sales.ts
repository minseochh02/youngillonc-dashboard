/**
 * Script to rebuild the sales database from Excel file
 * Parses the sales Excel file and inserts data with proper 품목그룹1코드
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

import { EGDESK_CONFIG } from '../egdesk.config';

// API call to EGDesk
async function callEgdeskAPI(tool: string, args: any) {
  const apiUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EGDESK_API_URL) ||
    EGDESK_CONFIG.apiUrl;
  const apiKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EGDESK_API_KEY) ||
    EGDESK_CONFIG.apiKey;

  const response = await fetch(`${apiUrl}/user-data/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      tool,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Tool call failed');
  }

  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

interface SalesRow {
  일자: string;
  거래처그룹1코드명: string;
  세무신고거래처코드: string;
  거래처코드: string;
  담당자코드명: string;
  판매처명: string;
  품목코드: string;
  품목명_규격_: string;
  단위: string;
  규격명: string;
  수량: string;
  중량: string;
  단가: string;
  공급가액: string;
  합_계: string;
  품목그룹1코드: string;
  품목그룹2명: string;
  품목그룹3코드: string;
  창고명: string;
  거래처그룹2명: string;
  신규일: string;
  적요: string;
  적요2: string;
  코드변경: string;
  실납업체: string;
}

function parseExcelToSales(xlsxPath: string): SalesRow[] {
  console.log(`Reading Excel file: ${xlsxPath}`);

  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Get raw data as array of arrays
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

  // Skip first row (company header), use second row as headers
  const headers = rawData[1] as string[];
  const dataRows = rawData.slice(2);

  console.log(`Found ${dataRows.length} data rows in Excel`);

  const rows: SalesRow[] = [];

  for (const rowArray of dataRows) {
    // Create object from array using headers
    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = rowArray[idx] || '';
    });

    // Convert date from YYYY/MM/DD to YYYY-MM-DD
    let dateStr = String(row['일자'] || '');

    // Skip summary rows (contains Korean text like "계", "합계", "총합계")
    if (!dateStr || !dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
      continue;
    }

    if (dateStr && dateStr.includes('/')) {
      dateStr = dateStr.replace(/\//g, '-');
    }

    // Map Excel columns to database columns
    const salesRow: SalesRow = {
      일자: dateStr,
      거래처그룹1코드명: String(row['거래처그룹1명'] || ''),
      세무신고거래처코드: String(row['세무신고거래처코드'] || ''),
      거래처코드: String(row['거래처코드'] || ''),
      담당자코드명: String(row['담당자명'] || ''),
      판매처명: String(row['거래처명'] || ''),
      품목코드: String(row['품목코드'] || ''),
      품목명_규격_: String(row['품목명(규격)'] || ''),
      단위: String(row['단위'] || ''),
      규격명: String(row['규격명'] || ''),
      수량: String(row['수량'] || ''),
      중량: String(row['중량'] || ''),
      단가: String(row['단가'] || ''),
      공급가액: String(row['공급가액'] || ''),
      합_계: String(row['합계'] || ''),
      품목그룹1코드: String(row['품목그룹1코드'] || ''),
      품목그룹2명: String(row['품목그룹2명'] || ''),
      품목그룹3코드: String(row['품목그룹3코드'] || ''),
      창고명: String(row['창고명'] || ''),
      거래처그룹2명: String(row['거래처그룹2명'] || ''),
      신규일: String(row['신규일'] || ''),
      적요: String(row['적요'] || ''),
      적요2: String(row['적요2'] || ''),
      코드변경: String(row['코드변경'] || ''),
      실납업체: String(row['실납업체'] || ''),
    };

    rows.push(salesRow);
  }

  return rows;
}

async function rebuildSalesDatabase(rows: SalesRow[]) {
  console.log(`Parsed ${rows.length} sales rows`);

  // Get date range from the data
  const dates = rows.map(r => r.일자).filter(d => d);
  const minDate = dates.reduce((a, b) => a < b ? a : b);
  const maxDate = dates.reduce((a, b) => a > b ? a : b);

  console.log(`Date range in Excel: ${minDate} to ${maxDate}`);

  // First, get all IDs of November 2025 rows
  console.log(`Finding existing rows for date range ${minDate} to ${maxDate}...`);

  const findQuery = `SELECT id FROM sales WHERE 일자 >= '${minDate}' AND 일자 <= '${maxDate}'`;

  try {
    const findResult = await callEgdeskAPI('user_data_sql_query', { query: findQuery });
    const idsToDelete = findResult.rows.map((row: any) => row.id);

    if (idsToDelete.length > 0) {
      console.log(`Deleting ${idsToDelete.length} existing November 2025 rows...`);

      // Delete in batches of 1000 IDs
      const deleteBatchSize = 1000;
      for (let i = 0; i < idsToDelete.length; i += deleteBatchSize) {
        const batchIds = idsToDelete.slice(i, i + deleteBatchSize);
        await callEgdeskAPI('user_data_delete_rows', {
          tableName: 'sales',
          ids: batchIds
        });
        console.log(`  Deleted batch ${Math.floor(i / deleteBatchSize) + 1}/${Math.ceil(idsToDelete.length / deleteBatchSize)}`);
      }
      console.log(`Successfully deleted ${idsToDelete.length} old rows`);
    } else {
      console.log('No existing November 2025 rows found to delete');
    }
  } catch (error: any) {
    console.log(`Error deleting rows: ${error.message}`);
    throw error;
  }

  // Group rows by date (workaround for API bug where batches get assigned first row's date)
  const rowsByDate: Record<string, SalesRow[]> = {};
  rows.forEach(row => {
    if (!rowsByDate[row.일자]) {
      rowsByDate[row.일자] = [];
    }
    rowsByDate[row.일자].push(row);
  });

  const sortedDates = Object.keys(rowsByDate).sort();
  console.log(`Grouped into ${sortedDates.length} dates: ${sortedDates.join(', ')}`);

  // Insert each date's rows separately
  for (const date of sortedDates) {
    const dateRows = rowsByDate[date];
    console.log(`\nInserting ${dateRows.length} rows for ${date}...`);

    // Still batch within each date to avoid overwhelming the API
    const batchSize = 100;
    for (let i = 0; i < dateRows.length; i += batchSize) {
      const batch = dateRows.slice(i, i + batchSize);

      await callEgdeskAPI('user_data_insert_rows', {
        tableName: 'sales',
        rows: batch,
      });

      if (dateRows.length > batchSize) {
        console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dateRows.length / batchSize)}`);
      }
    }
    console.log(`  ✓ Completed ${date}`);
  }

  console.log('Sales data for November 2025 updated successfully!');

  // Verify the update
  const countQuery = `SELECT COUNT(*) as total FROM sales WHERE 일자 >= '${minDate}' AND 일자 <= '${maxDate}'`;
  const countResult = await callEgdeskAPI('user_data_sql_query', { query: countQuery });
  console.log(`\nVerification: ${countResult.rows[0].total} rows now exist for November 2025`);
}

async function main() {
  const xlsxPath = path.join(__dirname, '..', 'WBCNICQV5GIQORL.xlsx');

  console.log('Starting sales Excel parsing...');
  console.log(`Reading from: ${xlsxPath}`);

  const rows = parseExcelToSales(xlsxPath);

  console.log('\n=== Sample of first 3 rows ===');
  console.log(JSON.stringify(rows.slice(0, 3), null, 2));

  console.log('\n=== Checking 품목그룹1코드 distribution ===');
  const codeDistribution: Record<string, number> = {};
  rows.forEach(row => {
    const code = row.품목그룹1코드 || 'null';
    codeDistribution[code] = (codeDistribution[code] || 0) + 1;
  });
  console.log(JSON.stringify(codeDistribution, null, 2));

  const proceed = process.argv.includes('--execute');

  if (!proceed) {
    console.log('\n⚠️  Dry run mode. To actually update the database, run:');
    console.log('   npm run rebuild-sales -- --execute');
    console.log('\n📝 This will:');
    console.log('   1. Delete November 2025 rows from existing sales table');
    console.log('   2. Insert 4,690 new rows with proper 품목그룹1코드 values');
    console.log('   3. Keep all other months\' data intact');
    return;
  }

  console.log('\n🚀 Updating November 2025 sales data...');
  await rebuildSalesDatabase(rows);
}

main().catch(console.error);
