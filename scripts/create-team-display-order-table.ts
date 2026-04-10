/**
 * B2C/B2B 팀 노출 순서 — scope + 팀 unique
 * Run: npm run create-team-display-order-table
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createTable } from '../egdesk-helpers.ts';

async function main() {
  const result = await createTable(
    '팀 노출 순서 (B2C/B2B)',
    [
      { name: 'scope', type: 'TEXT', notNull: true },
      { name: '팀', type: 'TEXT', notNull: true },
      { name: '노출순서', type: 'INTEGER', notNull: true, defaultValue: 0 }
    ],
    {
      tableName: 'team_display_order',
      description: 'B2C(b2c_팀) / B2B(b2b팀) 팀 표시 순서 — employee_category가 마스터',
      uniqueKeyColumns: ['scope', '팀'],
      duplicateAction: 'update'
    }
  );
  console.log('✅ team_display_order', JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
