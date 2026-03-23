import { listTables } from './egdesk-helpers';

async function main() {
  const tables = await listTables();
  console.log('Available tables:', tables);
}

main().catch(console.error);
