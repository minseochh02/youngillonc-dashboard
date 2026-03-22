import { getTableSchema, listTables } from './egdesk-helpers';

async function run() {
  try {
    const tables = ['sales', 'east_division_sales', 'west_division_sales', 'south_division_sales', 'employees', 'employee_category', 'items'];
    for (const table of tables) {
      console.log(`--- Schema for ${table} ---`);
      const schema = await getTableSchema(table);
      console.log(JSON.stringify(schema, null, 2));
    }
  } catch (error) {
    console.error(error);
  }
}

run();
