import { NextRequest, NextResponse } from 'next/server';
import { createTable, insertRows, executeSQL } from '../../../../egdesk-helpers';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Recreating Sales Table & Inserting February 2026 Data ===\n');

    // Read the final sales data
    const migrationsPath = path.join(process.cwd(), 'migrations');
    const salesData = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'youngilonc-sales-final.json'), 'utf-8')
    );

    console.log(`Loaded ${salesData.length} rows to insert`);

    // Step 1: Create sales table with proper schema
    console.log('\nStep 1: Creating sales table...');
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

    try {
      await createTable('판매현황', salesSchema, {
        description: 'Sales data - 판매현황',
        tableName: 'sales'
      });
      console.log('✓ Created sales table');
    } catch (error: any) {
      // Table might already exist, that's okay
      console.log('Sales table already exists or error:', error.message);
    }

    // Step 2: Insert new data in batches
    console.log('\nStep 2: Inserting February 2026 sales data...');
    const BATCH_SIZE = 100;
    let totalInserted = 0;

    for (let i = 0; i < salesData.length; i += BATCH_SIZE) {
      const batch = salesData.slice(i, i + BATCH_SIZE);
      await insertRows('sales', batch);
      totalInserted += batch.length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(salesData.length / BATCH_SIZE)} - ${totalInserted}/${salesData.length} rows`);
    }
    console.log(`✓ Inserted ${totalInserted} rows`);

    // Step 3: Verify insertion
    console.log('\nStep 3: Verifying insertion...');
    const totalCount = await executeSQL(`SELECT COUNT(*) as count FROM sales`);
    const totalRows = totalCount.rows[0]?.count || 0;
    console.log(`✓ Verified: ${totalRows} total rows in sales table`);

    // Get totals for verification
    const totals = await executeSQL(
      `SELECT SUM(중량) as total_weight, SUM(합계) as total_amount FROM sales`
    );

    const dateRange = await executeSQL(
      `SELECT MIN(일자) as min_date, MAX(일자) as max_date FROM sales`
    );

    // Sample records
    const sample = await executeSQL(`SELECT * FROM sales LIMIT 5`);

    const verification = {
      insertedRows: totalInserted,
      totalRows: totalRows,
      totalWeight: totals.rows[0]?.total_weight || 0,
      totalAmount: totals.rows[0]?.total_amount || 0,
      dateRange: dateRange.rows[0] || {},
      sampleRecords: sample.rows || []
    };

    console.log('\n=== Verification ===');
    console.log(JSON.stringify(verification, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Sales table recreated and February 2026 data inserted successfully',
      verification
    });

  } catch (error: any) {
    console.error('Replace error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Replace failed',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
