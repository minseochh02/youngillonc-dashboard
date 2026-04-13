import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { deleteTable } from '../egdesk-helpers';

async function main() {
  console.log('Deleting user data table: sales (판매현황)...\n');
  await deleteTable('purchases');
  console.log('Done.');
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
