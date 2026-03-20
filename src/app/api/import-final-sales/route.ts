import { NextRequest, NextResponse } from 'next/server';
import { createTable, insertRows, executeSQL } from '../../../../egdesk-helpers';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting final sales data import...');

    // Read the final mapped JSON files
    const migrationsPath = path.join(process.cwd(), 'migrations');
    const dongbuData = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'dongbu-final.json'), 'utf-8')
    );
    const seobuData = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'seobu-final.json'), 'utf-8')
    );

    console.log(`Loaded 동부: ${dongbuData.length} rows`);
    console.log(`Loaded 서부: ${seobuData.length} rows`);

    // Sales table schema (16 columns - excluding id which is auto-generated)
    const salesSchema = [
      { name: '일자', type: 'TEXT' },
      { name: '거래처코드', type: 'TEXT' },
      { name: '담당자코드', type: 'INTEGER' },
      { name: '품목코드', type: 'TEXT' },
      { name: '단위', type: 'TEXT' },
      { name: '규격명', type: 'TEXT' },
      { name: '수량', type: 'REAL' },
      { name: '중량', type: 'REAL' },
      { name: '단가', type: 'REAL' },
      { name: '공급가액', type: 'REAL' },
      { name: '부가세', type: 'REAL' },
      { name: '합계', type: 'REAL' },
      { name: '출하창고코드', type: 'TEXT' },
      { name: '신규일', type: 'TEXT' },
      { name: '적요', type: 'TEXT' },
      { name: '적요2', type: 'TEXT' }
    ];

    // Create tables with sales schema
    console.log('\nCreating tables...');

    await createTable('동부판매', salesSchema, {
      description: '동부사업소 February 2026 sales data (sales schema)',
      tableName: 'east_division_sales'
    });
    console.log('✓ Created east_division_sales table');

    await createTable('서부판매', salesSchema, {
      description: '서부사업소 February 2026 sales data (sales schema)',
      tableName: 'west_division_sales'
    });
    console.log('✓ Created west_division_sales table');

    // Insert data in batches
    const BATCH_SIZE = 100;

    // Insert 동부 data
    console.log('\nInserting 동부 data...');
    for (let i = 0; i < dongbuData.length; i += BATCH_SIZE) {
      const batch = dongbuData.slice(i, i + BATCH_SIZE);
      await insertRows('east_division_sales', batch);
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(dongbuData.length / BATCH_SIZE)}`);
    }
    console.log(`✓ Inserted ${dongbuData.length} rows into east_division_sales`);

    // Insert 서부 data
    console.log('\nInserting 서부 data...');
    for (let i = 0; i < seobuData.length; i += BATCH_SIZE) {
      const batch = seobuData.slice(i, i + BATCH_SIZE);
      await insertRows('west_division_sales', batch);
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(seobuData.length / BATCH_SIZE)}`);
    }
    console.log(`✓ Inserted ${seobuData.length} rows into west_division_sales`);

    // Verify import
    console.log('\n=== Verification ===');

    const dongbuCount = await executeSQL('SELECT COUNT(*) as count FROM east_division_sales');
    const seobuCount = await executeSQL('SELECT COUNT(*) as count FROM west_division_sales');

    const dongbuTotal = await executeSQL(
      'SELECT SUM(중량) as total_weight, SUM(합계) as total_amount FROM east_division_sales'
    );
    const seobuTotal = await executeSQL(
      'SELECT SUM(중량) as total_weight, SUM(합계) as total_amount FROM west_division_sales'
    );

    const dongbuDateRange = await executeSQL(
      'SELECT MIN(일자) as min_date, MAX(일자) as max_date FROM east_division_sales'
    );
    const seobuDateRange = await executeSQL(
      'SELECT MIN(일자) as min_date, MAX(일자) as max_date FROM west_division_sales'
    );

    // Sample records
    const dongbuSample = await executeSQL('SELECT * FROM east_division_sales LIMIT 3');
    const seobuSample = await executeSQL('SELECT * FROM west_division_sales LIMIT 3');

    const verification = {
      동부판매: {
        rowCount: dongbuCount.rows[0]?.count || 0,
        totalWeight: dongbuTotal.rows[0]?.total_weight || 0,
        totalAmount: dongbuTotal.rows[0]?.total_amount || 0,
        dateRange: dongbuDateRange.rows[0] || {},
        sampleRecords: dongbuSample.rows || []
      },
      서부판매: {
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
      message: 'Branch sales data imported successfully with sales schema',
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
