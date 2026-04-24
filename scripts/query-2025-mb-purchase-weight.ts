import { config } from 'dotenv';
import { executeSQL } from '../egdesk-helpers';
import { sqlAndPurchaseExcludeMeetingCounterpartyCodes } from '../src/lib/special-handling-employees';

config({ path: '.env.local' });

async function main() {
  const query = `
    SELECT
      SUM(CAST(REPLACE(p.중량, ',', '') AS NUMERIC)) AS mb_purchase_weight
    FROM purchases p
    LEFT JOIN items i ON p.품목코드 = i.품목코드
    WHERE p.일자 IS NOT NULL
      AND p.일자 != ''
      AND substr(p.일자, 1, 4) = '2025'
      AND i.품목그룹1코드 = 'MB'
      ${sqlAndPurchaseExcludeMeetingCounterpartyCodes('p')}
  `;

  const result = await executeSQL(query);
  const rows = result?.rows ?? result;
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
