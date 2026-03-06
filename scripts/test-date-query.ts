import { generateSQLFromTemplate } from '../src/lib/query-templates';

const queries = [
  "2월 7일 창원 매출",
  "오늘 화성 매출",
  "2026-02-07 MB 매출"
];

console.log('Testing date + division queries...\n');

queries.forEach(query => {
  const result = generateSQLFromTemplate(query);

  console.log(`Query: "${query}"`);
  if (result) {
    console.log(`  ✅ Template matched: ${result.intent}`);
    console.log(`  SQL: ${result.sql.trim().substring(0, 150)}...`);
  } else {
    console.log(`  ❌ No template matched - will use LLM`);
  }
  console.log('');
});
