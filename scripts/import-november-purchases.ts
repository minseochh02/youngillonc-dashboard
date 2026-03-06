import * as XLSX from 'xlsx';
import { insertRows } from '../egdesk-helpers';

const filePath = './PB4NPAMTL37TW9C.xlsx';

async function importNovemberPurchases() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets['구매현황'];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const headers = data[1] as string[];
  const rows = data.slice(2);

  console.log('Total rows in Excel:', rows.length);

  // Map column indices
  const columnMap = {
    일자: headers.indexOf('일자'),
    거래처코드: headers.indexOf('거래처코드'),
    거래처그룹1명: headers.indexOf('거래처그룹1명'),
    구매처명: headers.indexOf('구매처명'),
    창고명: headers.indexOf('창고명'),
    품목코드: headers.indexOf('품목코드'),
    품목명: headers.indexOf('품목명'),
    단위: headers.indexOf('단위'),
    규격_규격명: headers.indexOf('규격+규격명'),
    수량: headers.indexOf('수량'),
    중량: headers.indexOf('중량'),
    단가: headers.indexOf('단가'),
    공급가액: headers.indexOf('공급가액'),
    합_계: headers.indexOf('합 계'),
    적요: headers.indexOf('적요'),
    적요1: headers.indexOf('적요1'),
    적요2: headers.findIndex(h => h === '적요' && headers.indexOf('적요') !== headers.findIndex(h => h === '적요')),
    품목그룹1명: headers.indexOf('품목그룹1명'),
    품목그룹1코드: headers.indexOf('품목그룹1코드'),
    품목그룹2명: headers.indexOf('품목그룹2명'),
    품목그룹3코드: headers.indexOf('품목그룹3코드')
  };

  // Get 적요 column indices (there are duplicates)
  const 적요Indices = headers.reduce((acc, h, idx) => {
    if (h === '적요') acc.push(idx);
    return acc;
  }, [] as number[]);

  console.log('적요 columns found at indices:', 적요Indices);

  // Transform rows to match database schema
  const purchaseRows = rows
    .map((row, idx) => {
      const dateStr = String(row[columnMap.일자] || '').trim();

      // Parse date: "2025/11/01 " -> "2025-11-01"
      let parsedDate = null;
      if (dateStr) {
        const match = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        if (match) {
          const [, year, month, day] = match;
          parsedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      if (!parsedDate) {
        console.warn(`Row ${idx + 3}: Invalid date "${dateStr}", skipping`);
        return null;
      }

      return {
        일자: parsedDate,
        거래처코드: String(row[columnMap.거래처코드] || ''),
        거래처그룹1명: String(row[columnMap.거래처그룹1명] || ''),
        구매처명: String(row[columnMap.구매처명] || ''),
        창고명: String(row[columnMap.창고명] || ''),
        품목코드: String(row[columnMap.품목코드] || ''),
        품목명: String(row[columnMap.품목명] || ''),
        단위: String(row[columnMap.단위] || ''),
        규격_규격명: String(row[columnMap.규격_규격명] || ''),
        수량: String(row[columnMap.수량] || '0'),
        중량: String(row[columnMap.중량] || '0'),
        단가: String(row[columnMap.단가] || '0'),
        공급가액: String(row[columnMap.공급가액] || '0'),
        합_계: String(row[columnMap.합_계] || '0'),
        적요: String(row[적요Indices[0]] || ''),
        적요1: String(row[columnMap.적요1] || ''),
        적요2: String(적요Indices.length > 1 ? row[적요Indices[1]] : ''),
        품목그룹1명: String(row[columnMap.품목그룹1명] || ''),
        품목그룹1코드: String(row[columnMap.품목그룹1코드] || ''),
        품목그룹2명: String(row[columnMap.품목그룹2명] || ''),
        품목그룹3코드: String(row[columnMap.품목그룹3코드] || '')
      };
    })
    .filter(row => row !== null);

  console.log('Valid rows to import:', purchaseRows.length);

  // Show sample row
  console.log('\nSample row:');
  console.log(JSON.stringify(purchaseRows[0], null, 2));

  // Insert in batches of 100
  const batchSize = 100;
  let imported = 0;

  for (let i = 0; i < purchaseRows.length; i += batchSize) {
    const batch = purchaseRows.slice(i, i + batchSize);
    console.log(`\nInserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(purchaseRows.length / batchSize)} (${batch.length} rows)...`);

    try {
      await insertRows('purchases', batch);
      imported += batch.length;
      console.log(`✓ Inserted ${imported}/${purchaseRows.length} rows`);
    } catch (error) {
      console.error('Error inserting batch:', error);
      console.error('Failed batch:', batch[0]);
      break;
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Successfully imported: ${imported} rows`);
}

importNovemberPurchases().catch(console.error);
