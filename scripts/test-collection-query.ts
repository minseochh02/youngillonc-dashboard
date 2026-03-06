import { generateSQLFromTemplate } from '../src/lib/query-templates';

const query = "어제 MB 사업소 수금";

console.log(`Testing query: "${query}"\n`);

const result = generateSQLFromTemplate(query);

if (result) {
  console.log('Template matched!');
  console.log('Intent:', result.intent);
  console.log('\nGenerated SQL:');
  console.log(result.sql);
} else {
  console.log('No template matched - will use LLM');
}
