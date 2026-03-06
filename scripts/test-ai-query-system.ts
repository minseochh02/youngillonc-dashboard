import { executeAIQuery } from '../src/lib/ai-query-system';
import * as fs from 'fs';

// Load API key from .env.local
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
  if (apiKeyMatch) {
    process.env.ANTHROPIC_API_KEY = apiKeyMatch[1].trim();
  }
} catch (error) {
  console.error('Could not load .env.local');
}

const queries = [
  "저번 달 사업소별 매출 현황",
  "2월 6일 창원 매출",
  "오늘 모빌 제품 매출"
];

async function test() {
  console.log('Testing new AI-driven query system...\n');

  for (const query of queries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Query: "${query}"`);
    console.log('='.repeat(60));

    try {
      const result = await executeAIQuery(query);

      console.log('\n✅ Success!');
      console.log(`Attempts: ${result.attempts}`);
      console.log(`Verified: ${result.verified ? '✅' : '⚠️'}`);
      console.log(`Intent: ${result.intent}`);
      console.log(`\nGenerated SQL:\n${result.sql}`);
      console.log(`\nResults: ${result.rows.length} rows`);

      if (result.rows.length > 0) {
        console.log('\nFirst row:', JSON.stringify(result.rows[0], null, 2));
      }
    } catch (error: any) {
      console.error('\n❌ Failed:', error.message);
    }
  }
}

test().catch(console.error);
