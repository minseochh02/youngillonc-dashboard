import { executeSQL, deleteRows, getTableSchema } from '../egdesk-helpers';
import { config } from 'dotenv';
import { existsSync } from 'fs';

if (existsSync('.env.development.local')) {
  config({ path: '.env.development.local' });
} else {
  config({ path: '.env.local' });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('=== Truncating items table via deleteRows ===');
  try {
    // 1. Get all IDs from items table
    const res = await executeSQL('SELECT id FROM items');
    const ids = (res.rows || []).map((r: any) => r.id);
    const count = ids.length;

    if (count === 0) {
      console.log('Items table is already empty.');
      return;
    }

    console.log(`Found ${count} rows to delete in items table.`);
    console.log('Deleting in chunks of 500...');

    const CHUNK_SIZE = 500;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      await deleteRows('items', { ids: chunk });
      await sleep(100);
      process.stdout.write(`.`);
    }

    console.log(`\nVerification: checking remaining count...`);
    const countRes = await executeSQL('SELECT COUNT(*) as cnt FROM items');
    console.log('Verification: row count is now', countRes.rows[0].cnt);

    const schemaRes = await getTableSchema('items');
    console.log('Verification: schema exists. Columns:', schemaRes.schema.map((f: any) => f.name));

  } catch (error: any) {
    console.error('Error truncating items table:', error.message);
  }
}

main();
