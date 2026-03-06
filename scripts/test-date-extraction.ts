import { generateSQLFromTemplate } from '../src/lib/query-templates';

const query = "2월 7일 창원 매출";

console.log(`Testing query: "${query}"\n`);

const result = generateSQLFromTemplate(query);

if (result) {
  console.log('Intent:', result.intent);
  console.log('\nFull SQL:');
  console.log(result.sql);

  // Check if the date is correctly extracted
  const dateMatch = result.sql.match(/WHERE 일자 = '(\d{4}-\d{2}-\d{2})'/);
  if (dateMatch) {
    console.log('\n✅ Date extracted:', dateMatch[1]);
  } else {
    console.log('\n❌ Date not found in SQL');
  }

  // Check if the division filter is correct
  const divisionMatch = result.sql.match(/거래처그룹1코드명 LIKE '%(.+?)%'/);
  if (divisionMatch) {
    console.log('✅ Division filter:', divisionMatch[1]);
  } else {
    console.log('❌ Division filter not found');
  }
}
