import { buildSchemaContext } from '../src/lib/schema-builder';

const queries = [
  "지난 달 사업소별 매출 현황",
  "오늘 창원 매출",
  "모빌 제품 매출"
];

console.log('Testing selective context loading...\n');

queries.forEach(query => {
  const context = buildSchemaContext(query);
  const hasSection2 = context.includes('## 2. Branch Names');

  console.log(`Query: "${query}"`);
  console.log(`  Context size: ${context.length} chars`);
  console.log(`  Contains Section 2 (Branch Names): ${hasSection2 ? '✅ YES' : '❌ NO'}`);

  if (hasSection2) {
    console.log(`  → LLM knows: sales → 거래처그룹1코드명`);
  } else {
    console.log(`  → ⚠️ LLM doesn't know which column to use for branches!`);
  }
  console.log('');
});
