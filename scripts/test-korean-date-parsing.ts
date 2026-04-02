import { parseKoreanDateTime } from '../src/lib/eml-processor';

interface TestCase {
  input: string;
  expected: string;
  description: string;
}

const testCases: TestCase[] = [
  {
    input: '2024년 2월 13일 오후 5:30',
    expected: '2024-02-13T17:30:00',
    description: 'Standard afternoon time'
  },
  {
    input: '2024년 2월 13일 오전 10:40',
    expected: '2024-02-13T10:40:00',
    description: 'Standard morning time'
  },
  {
    input: '2024년 2월 13일 오전 12:30',
    expected: '2024-02-13T00:30:00',
    description: 'Midnight hour (오전 12시)'
  },
  {
    input: '2024년 2월 13일 오후 12:30',
    expected: '2024-02-13T12:30:00',
    description: 'Noon hour (오후 12시)'
  },
  {
    input: '2024년 2월 13일 오전 11:59',
    expected: '2024-02-13T11:59:00',
    description: 'Late morning (11:59 AM)'
  },
  {
    input: '2024년 2월 13일 오후 11:59',
    expected: '2024-02-13T23:59:00',
    description: 'Late night (11:59 PM)'
  },
  {
    input: '2024년 1월 1일 오전 12:00',
    expected: '2024-01-01T00:00:00',
    description: 'Midnight exactly'
  },
  {
    input: '2024년 12월 31일 오후 11:59',
    expected: '2024-12-31T23:59:00',
    description: 'End of year'
  },
  {
    input: '2024년 2월 13일 오전 1:05',
    expected: '2024-02-13T01:05:00',
    description: 'Single digit hour (오전 1시)'
  },
  {
    input: '2024년 2월 13일 오후 1:05',
    expected: '2024-02-13T13:05:00',
    description: 'Single digit hour PM (오후 1시)'
  }
];

function runTests() {
  console.log('🧪 Testing Korean DateTime Parser\n');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = parseKoreanDateTime(testCase.input);
      const success = result === testCase.expected;

      if (success) {
        console.log(`✅ PASS: ${testCase.description}`);
        console.log(`   Input:    "${testCase.input}"`);
        console.log(`   Expected: "${testCase.expected}"`);
        console.log(`   Got:      "${result}"`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${testCase.description}`);
        console.log(`   Input:    "${testCase.input}"`);
        console.log(`   Expected: "${testCase.expected}"`);
        console.log(`   Got:      "${result}"`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ ERROR: ${testCase.description}`);
      console.log(`   Input:    "${testCase.input}"`);
      console.log(`   Error:    ${error.message}`);
      failed++;
    }
    console.log('-'.repeat(80));
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${testCases.length} total\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. Please review the results above.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
