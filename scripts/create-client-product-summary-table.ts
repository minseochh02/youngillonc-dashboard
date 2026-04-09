/**
 * Script to create the client_product_summary table
 * Run with: tsx scripts/create-client-product-summary-table.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createTable } from '../egdesk-helpers.ts';

async function createClientProductSummaryTable() {
  try {
    console.log('Creating client_product_summary table...');

    const result = await createTable(
      'Client Product Summary',
      [
        { name: 'client_code', type: 'TEXT', notNull: true },
        { name: 'year', type: 'TEXT', notNull: true },
        { name: 'category_type', type: 'TEXT', notNull: true },
        { name: 'category', type: 'TEXT', notNull: true },
        { name: 'total_weight', type: 'REAL', notNull: true, defaultValue: 0 },
        { name: 'total_amount', type: 'REAL', notNull: true, defaultValue: 0 },
        { name: 'computed_date', type: 'DATE', notNull: true }
      ],
      {
        tableName: 'client_product_summary',
        description: 'Pre-computed client product category summaries by year',
        uniqueKeyColumns: ['client_code', 'year', 'category_type', 'category'],
        duplicateAction: 'update'
      }
    );

    console.log('✅ Table created successfully!');
    console.log('Result:', result);

  } catch (error: any) {
    console.error('❌ Error creating table:', error.message);
    console.error('Full error:', error);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n🔴 EGdesk API is not running on port 8080');
      console.error('   Please start the EGdesk API server first.');
    }

    process.exit(1);
  }
}

createClientProductSummaryTable();
