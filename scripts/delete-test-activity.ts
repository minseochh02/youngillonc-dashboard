import { deleteRows } from '../egdesk-helpers';

async function cleanup() {
  console.log('🗑️  Deleting test activity ID 41755...\n');

  await deleteRows('employee_activity_log', { ids: [41755] });

  console.log('✅ Deleted test activity');
}

cleanup().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
