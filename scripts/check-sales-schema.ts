import { executeSQL } from '../egdesk-helpers';

async function main() {
  const tables = ['sales', 'east_division_sales', 'west_division_sales', 'south_division_sales'];
  for (const table of tables) {
    try {
      const info = await executeSQL(`PRAGMA table_info(${table})`);
      console.log(`Schema for ${table}:`, info.rows.map((r: any) => r.name).join(', '));
    } catch (e) {
      console.log(`Failed to get schema for ${table}:`, (e as Error).message);
    }
  }
}

main().catch(console.error);
