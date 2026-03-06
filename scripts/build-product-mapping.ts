/**
 * Script to build product_mapping table
 * This creates a reference table that maps 품목코드 to its group codes
 *
 * Run this with: npx tsx scripts/build-product-mapping.ts
 */

import { executeSQL, createTable, insertRows, deleteTable } from '../egdesk-helpers';

async function buildProductMapping() {
  console.log('🚀 Building product_mapping table...\n');

  try {
    // Step 1: Drop existing table if it exists
    console.log('📋 Step 1: Dropping existing product_mapping table (if exists)...');
    try {
      await deleteTable('product_mapping');
      console.log('✅ Dropped existing table\n');
    } catch (e) {
      console.log('ℹ️  Table does not exist, will create new\n');
    }

    // Step 2: Create the product_mapping table
    console.log('📋 Step 2: Creating product_mapping table...');
    await createTable(
      '품목코드매핑',
      [
        { name: '품목코드', type: 'TEXT', notNull: true },
        { name: '품목명', type: 'TEXT' },
        { name: '품목그룹1코드', type: 'TEXT' },
        { name: '품목그룹1명', type: 'TEXT' },
        { name: '품목그룹2명', type: 'TEXT' },
        { name: '품목그룹3코드', type: 'TEXT' },
        { name: 'last_seen_date', type: 'TEXT' },
      ],
      {
        description: 'Product code mapping table for inventory categorization',
        tableName: 'product_mapping',
        uniqueKeyColumns: ['품목코드'],
        duplicateAction: 'update'
      }
    );
    console.log('✅ Created product_mapping table\n');

    // Step 3: Fetch product data from sales and purchases
    console.log('📋 Step 3: Fetching product data from sales and purchases...');
    const query = `
      SELECT
        품목코드,
        MAX(품목명) as 품목명,
        MAX(품목그룹1코드) as 품목그룹1코드,
        MAX(품목그룹1명) as 품목그룹1명,
        MAX(품목그룹2명) as 품목그룹2명,
        MAX(품목그룹3코드) as 품목그룹3코드,
        MAX(일자) as last_seen_date
      FROM (
        SELECT
          품목코드,
          품목명_규격_ as 품목명,
          품목그룹1코드,
          '' as 품목그룹1명,
          품목그룹2명,
          품목그룹3코드,
          일자
        FROM sales
        WHERE 품목코드 IS NOT NULL AND 품목코드 != ''

        UNION ALL

        SELECT
          품목코드,
          품목명,
          품목그룹1코드,
          COALESCE(품목그룹1명, '') as 품목그룹1명,
          품목그룹2명,
          품목그룹3코드,
          일자
        FROM purchases
        WHERE 품목코드 IS NOT NULL AND 품목코드 != ''
      )
      GROUP BY 품목코드
    `;

    const result = await executeSQL(query);
    const products = result.rows || [];
    console.log(`✅ Found ${products.length} unique products\n`);

    // Step 4: Insert products in batches
    console.log('📋 Step 4: Inserting product mappings...');
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      await insertRows('product_mapping', batch);
      inserted += batch.length;
      console.log(`   Inserted ${inserted}/${products.length} products...`);
    }
    console.log(`✅ Inserted all ${products.length} product mappings\n`);

    // Step 5: Show statistics
    console.log('📊 Statistics:');
    const stats = await executeSQL(`
      SELECT
        COUNT(*) as total_products,
        COUNT(DISTINCT 품목그룹1코드) as unique_group1_codes,
        COUNT(DISTINCT 품목그룹3코드) as unique_group3_codes,
        SUM(CASE WHEN 품목그룹1코드 IS NULL THEN 1 ELSE 0 END) as missing_group1,
        SUM(CASE WHEN 품목그룹3코드 IS NULL THEN 1 ELSE 0 END) as missing_group3
      FROM product_mapping
    `);
    console.log(stats.rows[0]);
    console.log('');

    // Step 6: Show sample data
    console.log('📋 Sample product mappings:');
    const sample = await executeSQL(`
      SELECT * FROM product_mapping LIMIT 10
    `);
    console.table(sample.rows);
    console.log('');

    // Step 7: Show category breakdown
    console.log('📊 Category breakdown:');
    const categories = await executeSQL(`
      SELECT
        품목그룹1코드,
        품목그룹1명,
        COUNT(*) as product_count,
        CASE
          WHEN 품목그룹1코드 IN ('PVL', 'CVL') THEN 'Auto'
          WHEN 품목그룹1코드 = 'IL' THEN 'IL'
          WHEN 품목그룹1코드 IN ('MB', 'AVI') THEN 'MB'
          ELSE 'Others'
        END as category
      FROM product_mapping
      WHERE 품목그룹1코드 IS NOT NULL
      GROUP BY 품목그룹1코드, 품목그룹1명
      ORDER BY product_count DESC
    `);
    console.table(categories.rows);

    console.log('\n✨ Product mapping table built successfully!');
    console.log('📝 You can now use this table to join with inventory and other tables');

  } catch (error) {
    console.error('❌ Error building product mapping:', error);
    throw error;
  }
}

// Run the script
buildProductMapping()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
