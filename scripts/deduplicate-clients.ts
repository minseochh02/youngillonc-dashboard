import { config } from 'dotenv';
import { existsSync } from 'fs';
import { executeSQL, deleteRows } from '../egdesk-helpers';

if (existsSync('.env.development.local')) {
  config({ path: '.env.development.local' });
} else {
  config({ path: '.env.local' });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const tableName = 'clients';
  console.log(`=== Deduplicating clients table ===`);

  try {
    const query = `
      SELECT t1.id
      FROM clients t1
      LEFT JOIN (
        SELECT MIN(id) as keep_id
        FROM clients
        GROUP BY 거래처코드, 거래처명, 거래처그룹1코드, 거래처그룹1명, 업종분류코드, 담당자코드, 지역코드, 신규일
      ) t2 ON t1.id = t2.keep_id
      WHERE t2.keep_id IS NULL
    `;
    
    console.log(`Querying duplicate client rows to delete...`);
    const queryRes = await executeSQL(query);
    const idsToDelete = (queryRes.rows || []).map((r: any) => r.id);
    const count = idsToDelete.length;

    if (count === 0) {
      console.log(`No duplicate clients found.`);
      return;
    }

    console.log(`Found ${count} duplicate client rows to delete.`);
    console.log(`Deleting in chunks of 500...`);

    const CHUNK_SIZE = 500;
    for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
      const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
      await deleteRows(tableName, { ids: chunk });
      await sleep(100);
      process.stdout.write(`.`);
    }

    console.log(`\nSuccessfully deleted ${count} duplicate rows from clients table.`);

  } catch (error: any) {
    console.error('Error during client deduplication:', error.message);
  }
}

main().catch(console.error);
