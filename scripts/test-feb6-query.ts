import { generateSQLFromTemplate } from '../src/lib/query-templates';
import { executeSQL } from '../egdesk-helpers';

async function test() {
  const query = "2월 6일 창원 매출";

  console.log(`Testing query: "${query}"\n`);

  const result = generateSQLFromTemplate(query);

  if (result) {
    console.log('✅ Template matched:', result.intent);

    const data = await executeSQL(result.sql);
    console.log('\nQuery result:');
    console.log(JSON.stringify(data.rows, null, 2));
    console.log(`\nRow count: ${data.rowCount}`);
  }
}

test().catch(console.error);
