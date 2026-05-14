import { config } from 'dotenv';
config({ path: '.env.local' });

import { executeSQL } from '../egdesk-helpers';
import { 
  sqlMeetingPurchaseIncludedClientPredicate
} from '../src/lib/special-handling-employees';

async function main() {
  const month = '2026-03';
  const category = 'IL';

  const queries = [
    {
      name: 'Unfiltered Purchases (Raw)',
      sql: `
        SELECT SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
        FROM purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE substr(p.일자, 1, 7) = '${month}'
          AND i.품목그룹1코드 = '${category}'
      `
    },
    {
      name: 'Inclusion Filtered (PR00061 only)',
      sql: `
        SELECT SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) as weight
        FROM purchases p
        LEFT JOIN items i ON p.품목코드 = i.품목코드
        WHERE substr(p.일자, 1, 7) = '${month}'
          AND i.품목그룹1코드 = '${category}'
          AND ${sqlMeetingPurchaseIncludedClientPredicate('p.거래처코드')}
      `
    }
  ];

  console.log(`Analyzing IL purchases for ${month}...`);
  for (const q of queries) {
    const res = await executeSQL(q.sql);
    const weight = res?.rows?.[0]?.weight || 0;
    console.log(`${q.name}: ${Number(weight).toLocaleString('ko-KR')}`);
  }
}

main().catch(console.error);
