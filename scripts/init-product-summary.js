/**
 * Initialize client_product_summary table
 * Run this script to create and populate the summary table
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function initProductSummary() {
  console.log('\n🚀 Initializing Product Summary Table...\n');

  const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const endpoint = `${apiUrl}/api/admin/refresh-product-summary`;

  console.log(`🌐 API Endpoint: ${endpoint}`);
  console.log(`📋 Strategy: All years on first run, recent years on subsequent runs\n`);

  rl.question('Proceed with initialization? (y/n): ', async (answer) => {
    if (answer.toLowerCase() !== 'y') {
      console.log('❌ Cancelled');
      rl.close();
      return;
    }

    console.log('\n⏳ Processing...');
    console.log('⏱️  First run may take 1-3 minutes (processing all years)');
    console.log('⏱️  Subsequent runs will be faster (10-30 seconds)\n');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Success!');
        console.log(`📊 Load Type: ${result.isInitialLoad ? 'Initial (All Years)' : 'Incremental (Recent Years)'}`);
        console.log(`📊 Rows inserted: ${result.rowsInserted}`);
        console.log(`📅 Years processed: ${result.years.join(', ')}`);
        console.log(`📅 Year range: ${result.yearRange || 'N/A'}`);
        console.log('\n✨ Product summary table is ready!');
      } else {
        console.error('❌ Failed:', result.error);
        console.error('Details:', result.details);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error('\n💡 Make sure your dev server is running: npm run dev');
    }

    rl.close();
  });
}

initProductSummary();
