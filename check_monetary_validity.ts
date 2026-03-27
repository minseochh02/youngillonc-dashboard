
import { executeSQL } from './egdesk-helpers';

async function main() {
  try {
    const result = await executeSQL(`
      SELECT COUNT(*) as count FROM ledger 
      WHERE (일자 LIKE '%회사명%' OR 일자 LIKE '%~%' OR 일자 LIKE '%/%/%' OR 일자 LIKE '%오전%' OR 일자 LIKE '%오후%')
      AND (차변금액 IS NOT NULL OR 대변금액 IS NOT NULL)
      AND 일자 NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    `);
    console.log('Metadata rows with money values:', result.rows[0].count);

    const resultWrongFormat = await executeSQL(`
      SELECT COUNT(*) as count FROM ledger 
      WHERE 일자 LIKE '%/%/%' 
      AND 일자 NOT LIKE '%오전%' AND 일자 NOT LIKE '%오후%'
      AND (차변금액 != 0 OR 대변금액 != 0)
    `);
    console.log('Wrong format (YYYY/MM/DD) rows with money values:', resultWrongFormat.rows[0].count);
  } catch (error) {
    console.error(error);
  }
}
main();
