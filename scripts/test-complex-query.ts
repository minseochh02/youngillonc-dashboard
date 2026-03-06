import { executeAIQuery } from '../src/lib/ai-query-system';
import * as fs from 'fs';

// Load API key
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
  if (apiKeyMatch) {
    process.env.ANTHROPIC_API_KEY = apiKeyMatch[1].trim();
  }
} catch (error) {
  console.error('Could not load .env.local');
}

async function test() {
  const query = "저번 달 사업소별 매출 현황, 부가세 포함된 합계 금액도 표시해주고 또 사업소 전체 합계도 표시해줘";

  console.log(`Testing complex query:\n"${query}"\n`);

  try {
    const result = await executeAIQuery(query);

    console.log('\n✅ Success!');
    console.log(`Attempts: ${result.attempts}`);
    console.log(`Verified: ${result.verified ? '✅' : '⚠️'}`);
    console.log(`\nGenerated SQL:\n${result.sql}`);
    console.log(`\nResults: ${result.rows.length} rows`);

    if (result.rows.length > 0) {
      console.log('\nColumns:', result.columns);
      console.log('\nFirst 3 rows:');
      result.rows.slice(0, 3).forEach(row => {
        console.log(JSON.stringify(row, null, 2));
      });

      // Check if total row exists
      const totalRow = result.rows.find((r: any) =>
        r.사업소 === '전체' || r.사업소 === '합계' || r.사업소 === 'Total'
      );
      if (totalRow) {
        console.log('\n📊 Total row found:', JSON.stringify(totalRow, null, 2));
      }
    }
  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    console.error('\nFull error:', error);
  }
}

test().catch(console.error);
