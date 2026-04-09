console.log('Deleting and recreating sales_goals table...');

// Load environment variables from .env.local
require('dotenv').config({ path: '/Users/minseocha/Desktop/projects/youngilonc/.env.local' });

const EGDESK_API_URL = process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080';
const EGDESK_API_KEY = process.env.NEXT_PUBLIC_EGDESK_API_KEY;

async function callUserDataTool(toolName, args = {}) {
  const response = await fetch(`${EGDESK_API_URL}/user-data/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': EGDESK_API_KEY
    },
    body: JSON.stringify({ tool: toolName, arguments: args })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Tool call failed');
  }

  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

async function main() {
  // Delete the old table
  console.log('Deleting old sales_goals table...');
  try {
    await callUserDataTool('user_data_delete_table', { tableName: 'sales_goals' });
    console.log('✅ Old table deleted');
  } catch (e) {
    console.log('Note: Table may not exist, continuing...', e.message);
  }

  // Create new table
  console.log('Creating new sales_goals table...');
  const result = await callUserDataTool('user_data_create_table', {
    displayName: '판매 목표',
    tableName: 'sales_goals',
    schema: [
      { name: 'year', type: 'TEXT', notNull: true },
      { name: 'month', type: 'TEXT', notNull: true },
      { name: 'employee_name', type: 'TEXT', notNull: true },
      { name: 'category_type', type: 'TEXT', notNull: true },
      { name: 'category', type: 'TEXT', notNull: true },
      { name: 'industry', type: 'TEXT', defaultValue: '미분류' },
      { name: 'sector', type: 'TEXT', defaultValue: '미분류' },
      { name: 'target_weight', type: 'REAL', defaultValue: 0 },
      { name: 'target_amount', type: 'REAL', defaultValue: 0 }
    ],
    uniqueKeyColumns: ['year', 'month', 'employee_name', 'category_type', 'category', 'industry', 'sector'],
    duplicateAction: 'update'
  });

  console.log('✅ New table created successfully!');
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(e => console.error('Error:', e));
