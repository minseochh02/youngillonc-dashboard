import { NextRequest, NextResponse } from 'next/server';
import { createTable, insertRows, executeSQL } from '../../../../egdesk-helpers';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting final purchase data import...');

    // Read the final enriched JSON files
    const migrationsPath = path.join(process.cwd(), 'migrations');
    const dongbuData = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'dongbu-purchases-final.json'), 'utf-8')
    );
    const seobuData = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'seobu-purchases-final.json'), 'utf-8')
    );

    console.log(`Loaded 동부: ${dongbuData.length} rows`);
    console.log(`Loaded 서부: ${seobuData.length} rows`);

    // Purchases table schema (21 columns - excluding id and imported_at which are auto-generated)
    const purchasesSchema = [
      { name: '일자', type: 'TEXT' },
      { name: '거래처코드', type: 'TEXT' },
      { name: '거래처그룹1명', type: 'TEXT' },
      { name: '구매처명', type: 'TEXT' },
      { name: '창고명', type: 'TEXT' },
      { name: '품목코드', type: 'TEXT' },
      { name: '품목명', type: 'TEXT' },
      { name: '단위', type: 'TEXT' },
      { name: '규격_규격명', type: 'TEXT' },
      { name: '수량', type: 'REAL' },
      { name: '중량', type: 'REAL' },
      { name: '단가', type: 'REAL' },
      { name: '공급가액', type: 'REAL' },
      { name: '합계', type: 'REAL' },
      { name: '적요', type: 'TEXT' },
      { name: '적요1', type: 'TEXT' },
      { name: '적요2', type: 'TEXT' },
      { name: '품목그룹1명', type: 'TEXT' },
      { name: '품목그룹1코드', type: 'TEXT' },
      { name: '품목그룹2명', type: 'TEXT' },
      { name: '품목그룹3코드', type: 'TEXT' }
    ];

    // Create tables with purchases schema
    console.log('\nCreating tables...');

    await createTable('동부구매', purchasesSchema, {
      description: '동부사업소 February 2026 purchase data (purchases schema)',
      tableName: 'east_division_purchases'
    });
    console.log('✓ Created east_division_purchases table');

    await createTable('서부구매', purchasesSchema, {
      description: '서부사업소 February 2026 purchase data (purchases schema)',
      tableName: 'west_division_purchases'
    });
    console.log('✓ Created west_division_purchases table');

    // Insert data in batches
    const BATCH_SIZE = 100;

    // Insert 동부 data
    console.log('\nInserting 동부 data...');
    for (let i = 0; i < dongbuData.length; i += BATCH_SIZE) {
      const batch = dongbuData.slice(i, i + BATCH_SIZE);
      await insertRows('east_division_purchases', batch);
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(dongbuData.length / BATCH_SIZE)}`);
    }
    console.log(`✓ Inserted ${dongbuData.length} rows into east_division_purchases`);

    // Insert 서부 data
    console.log('\nInserting 서부 data...');
    for (let i = 0; i < seobuData.length; i += BATCH_SIZE) {
      const batch = seobuData.slice(i, i + BATCH_SIZE);
      await insertRows('west_division_purchases', batch);
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(seobuData.length / BATCH_SIZE)}`);
    }
    console.log(`✓ Inserted ${seobuData.length} rows into west_division_purchases`);

    // Verify import
    console.log('\n=== Verification ===');

    const dongbuCount = await executeSQL('SELECT COUNT(*) as count FROM east_division_purchases');
    const seobuCount = await executeSQL('SELECT COUNT(*) as count FROM west_division_purchases');

    const dongbuTotal = await executeSQL(
      'SELECT SUM(중량) as total_weight, SUM(합계) as total_amount FROM east_division_purchases'
    );
    const seobuTotal = await executeSQL(
      'SELECT SUM(중량) as total_weight, SUM(합계) as total_amount FROM west_division_purchases'
    );

    const dongbuDateRange = await executeSQL(
      'SELECT MIN(일자) as min_date, MAX(일자) as max_date FROM east_division_purchases'
    );
    const seobuDateRange = await executeSQL(
      'SELECT MIN(일자) as min_date, MAX(일자) as max_date FROM west_division_purchases'
    );

    // Sample records
    const dongbuSample = await executeSQL('SELECT * FROM east_division_purchases LIMIT 3');
    const seobuSample = await executeSQL('SELECT * FROM west_division_purchases LIMIT 3');

    const verification = {
      동부구매: {
        rowCount: dongbuCount.rows[0]?.count || 0,
        totalWeight: dongbuTotal.rows[0]?.total_weight || 0,
        totalAmount: dongbuTotal.rows[0]?.total_amount || 0,
        dateRange: dongbuDateRange.rows[0] || {},
        sampleRecords: dongbuSample.rows || []
      },
      서부구매: {
        rowCount: seobuCount.rows[0]?.count || 0,
        totalWeight: seobuTotal.rows[0]?.total_weight || 0,
        totalAmount: seobuTotal.rows[0]?.total_amount || 0,
        dateRange: seobuDateRange.rows[0] || {},
        sampleRecords: seobuSample.rows || []
      }
    };

    console.log('Verification results:', JSON.stringify(verification, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Branch purchase data imported successfully with purchases schema',
      verification
    });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Import failed',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
