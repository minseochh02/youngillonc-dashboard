import { getTableSchema } from './egdesk-helpers';
async function run() {
  const schema = await getTableSchema('purchases');
  console.log('Purchases Schema:', JSON.stringify(schema, null, 2));
}
run();
