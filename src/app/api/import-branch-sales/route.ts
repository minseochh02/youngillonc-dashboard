import { NextRequest, NextResponse } from 'next/server';
import { createTable, insertRows, deleteTable, executeSQL } from '../../../../egdesk-helpers';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting branch sales import...');

    // Read the parsed JSON files
    const migrationsPath = path.join(process.cwd(), 'migrations');
    const dongbuData = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'dongbu-parsed.json'), 'utf-8')
    );
    const seobuData = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'seobu-parsed.json'), 'utf-8')
    );
    const schema = JSON.parse(
      fs.readFileSync(path.join(migrationsPath, 'branch-sales-schema.json'), 'utf-8')
    );

    console.log(`Loaded 동부: ${dongbuData.length} rows`);
    console.log(`Loaded 서부: ${seobuData.length} rows`);

    // Delete existing tables if they exist
    try {
      await deleteTable('동부판매');
      console.log('Deleted existing 동부판매 table');
    } catch (e) {
      console.log('No existing 동부판매 table to delete');
    }

    try {
      await deleteTable('서부판매');
      console.log('Deleted existing 서부판매 table');
    } catch (e) {
      console.log('No existing 서부판매 table to delete');
    }

    // Create 동부판매 table
    console.log('\nCreating 동부판매 table...');
    await createTable('동부판매', schema, {
      description: '동부사업소 February 2026 sales data imported from Excel',
      tableName: '동부판매'
    });
    console.log('✓ Created 동부판매 table');

    // Create 서부판매 table
    console.log('\nCreating 서부판매 table...');
    await createTable('서부판매', schema, {
      description: '서부사업소 February 2026 sales data imported from Excel',
      tableName: '서부판매'
    });
    console.log('✓ Created 서부판매 table');

    // Insert data in batches (MCP might have limits)
    const BATCH_SIZE = 100;

    // Insert 동부 data
    console.log('\nInserting 동부 data...');
    for (let i = 0; i < dongbuData.length; i += BATCH_SIZE) {
      const batch = dongbuData.slice(i, i + BATCH_SIZE);
      await insertRows('동부판매', batch);
      console.log(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(dongbuData.length / BATCH_SIZE)}`);
    }
    console.log(`✓ Inserted ${dongbuData.length} rows into 동부판매`);

    // Insert 서부 data
    console.log('\nInserting 서부 data...');
    for (let i = 0; i < seobuData.length; i += BATCH_SIZE) {
      const batch = seobuData.slice(i, i + BATCH_SIZE);
      await insertRows('서부판매', batch);
      console.log(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(seobuData.length / BATCH_SIZE)}`);
    }
    console.log(`✓ Inserted ${seobuData.length} rows into 서부판매`);

    // Verify import
    console.log('\n=== Verification ===');

    const dongbuCount = await executeSQL('SELECT COUNT(*) as count FROM 동부판매');
    const seobuCount = await executeSQL('SELECT COUNT(*) as count FROM 서부판매');

    const dongbuTotal = await executeSQL(
      'SELECT SUM(중량) as total_weight, SUM(합계) as total_amount FROM 동부판매'
    );
    const seobuTotal = await executeSQL(
      'SELECT SUM(중량) as total_weight, SUM(합계) as total_amount FROM 서부판매'
    );

    const dongbuDateRange = await executeSQL(
      'SELECT MIN(일자) as min_date, MAX(일자) as max_date FROM 동부판매'
    );
    const seobuDateRange = await executeSQL(
      'SELECT MIN(일자) as min_date, MAX(일자) as max_date FROM 서부판매'
    );

    const verification = {
      동부판매: {
        rowCount: dongbuCount.rows[0]?.count || 0,
        totalWeight: dongbuTotal.rows[0]?.total_weight || 0,
        totalAmount: dongbuTotal.rows[0]?.total_amount || 0,
        dateRange: dongbuDateRange.rows[0] || {}
      },
      서부판매: {
        rowCount: seobuCount.rows[0]?.count || 0,
        totalWeight: seobuTotal.rows[0]?.total_weight || 0,
        totalAmount: seobuTotal.rows[0]?.total_amount || 0,
        dateRange: seobuDateRange.rows[0] || {}
      }
    };

    console.log('Verification results:', JSON.stringify(verification, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Branch sales data imported successfully',
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
