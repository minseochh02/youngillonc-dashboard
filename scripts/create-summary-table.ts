/**
 * Create client_product_summary table directly using egdesk-helpers
 * Run: npm run create-summary-table
 */

import { createTable, executeSQL } from '../egdesk-helpers';

async function createSummaryTable() {
  console.log('\n🏗️  Creating client_product_summary table...\n');

  try {
    // Check if table already exists
    try {
      const existing = await executeSQL('SELECT COUNT(*) as count FROM client_product_summary LIMIT 1');
      const count = Array.isArray(existing) ? existing[0]?.count : existing?.rows?.[0]?.count;
      console.log('✅ Table already exists!');
      console.log(`📊 Current rows: ${count || 0}`);
      return;
    } catch (error) {
      // Table doesn't exist, proceed with creation
      console.log('📝 Table does not exist, creating...');
    }

    // Create the table
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
    console.log('📋 Table Name: client_product_summary');
    console.log('📋 Schema:');
    console.log('   - client_code (TEXT) - Client identifier');
    console.log('   - year (TEXT) - Year of data');
    console.log('   - category_type (TEXT) - tier/division/family');
    console.log('   - category (TEXT) - Standard/AUTO/MOBIL 1/etc.');
    console.log('   - total_weight (REAL) - Aggregated weight');
    console.log('   - total_amount (REAL) - Aggregated amount');
    console.log('   - computed_date (DATE) - Computation date');
    console.log('\n🔑 Unique Key: [client_code, year, category_type, category]');
    console.log('♻️  Duplicate Action: update');
    console.log('\n💡 Next step: Populate the table');
    console.log('   Option 1 (UI): ');
    console.log('     1. Start server: npm run dev');
    console.log('     2. Go to Client Assignments page');
    console.log('     3. Click "제품 정보" → "DB 새로고침"');
    console.log('   Option 2 (Script):');
    console.log('     1. Start server: npm run dev');
    console.log('     2. Run: node scripts/init-product-summary.js\n');

  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

createSummaryTable()
  .then(() => {
    console.log('✨ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to create table\n');
    console.error(error);
    process.exit(1);
  });
