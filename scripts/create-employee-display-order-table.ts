/**
 * 팀 내 사원 노출 순서 — (scope, 팀, 담당자) unique
 * Run: npm run create-employee-display-order-table
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createTable } from '../egdesk-helpers.ts';

async function main() {
  const result = await createTable(
    '팀 내 사원 노출 순서',
    [
      { name: 'scope', type: 'TEXT', notNull: true },
      { name: '팀', type: 'TEXT', notNull: true },
      { name: '담당자', type: 'TEXT', notNull: true },
      { name: '팀내_노출순서', type: 'INTEGER', notNull: true, defaultValue: 0 }
    ],
    {
      tableName: 'employee_display_order',
      description: '채널·팀별 담당자 표시 순서 — employee_category가 마스터',
      uniqueKeyColumns: ['scope', '팀', '담당자'],
      duplicateAction: 'update'
    }
  );
  console.log('✅ employee_display_order', JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
