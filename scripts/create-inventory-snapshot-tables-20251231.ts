/**
 * EGDesk 재고 스냅샷 테이블 3개 생성 (2025-12-31).
 *
 * Display names (콘솔/EGDesk UI): 영일재고 20251231스냅샷, 서부재고 20251231스냅샷, 동부재고 20251231스냅샷
 * Physical names (sync / SQL): youngil_inventory_20251231, west_inventory_20251231, east_inventory_20251231
 *
 * Run: npx tsx scripts/create-inventory-snapshot-tables-20251231.ts
 * Recreate (drop + create) when adding columns: … --force
 *
 * 세 테이블 동일 스키마: 품목코드, 창고코드, 재고수량, 중량, 총중량, imported_at
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

import { createTable, deleteTable, executeSQL } from '../egdesk-helpers';

const FORCE = process.argv.includes('--force');

/** 영일 / 서부 / 동부 스냅샷 공통 컬럼 */
const SNAPSHOT_SCHEMA = [
  { name: '품목코드', type: 'TEXT' as const, notNull: true },
  { name: '창고코드', type: 'TEXT' as const, notNull: true },
  { name: '재고수량', type: 'REAL' as const, notNull: true },
  { name: '중량', type: 'REAL' as const, notNull: true },
  { name: '총중량', type: 'REAL' as const, notNull: true },
  { name: 'imported_at', type: 'DATE' as const }
] as const;

const UNIQUE = ['품목코드', '창고코드'];

async function tableExists(name: string): Promise<boolean> {
  try {
    await executeSQL(`SELECT 1 FROM ${name} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const list = [
    {
      displayName: '영일재고 20251231스냅샷',
      tableName: 'youngil_inventory_20251231',
      description: '본사 ESZ018R 스냅샷',
      schema: [...SNAPSHOT_SCHEMA],
      uniqueKeyColumns: UNIQUE
    },
    {
      displayName: '서부재고 20251231스냅샷',
      tableName: 'west_inventory_20251231',
      description: '서부 ESZ018R 스냅샷',
      schema: [...SNAPSHOT_SCHEMA],
      uniqueKeyColumns: UNIQUE
    },
    {
      displayName: '동부재고 20251231스냅샷',
      tableName: 'east_inventory_20251231',
      description: '동부 ESZ018R 스냅샷',
      schema: [...SNAPSHOT_SCHEMA],
      uniqueKeyColumns: UNIQUE
    }
  ];

  for (const spec of list) {
    const exists = await tableExists(spec.tableName);
    if (exists && !FORCE) {
      console.log('Skip:', spec.tableName);
      continue;
    }
    if (exists && FORCE) {
      console.log('Drop (--force):', spec.tableName);
      await deleteTable(spec.tableName);
    }
    console.log('Creating:', spec.displayName, '→', spec.tableName);
    await createTable(spec.displayName, spec.schema, {
      tableName: spec.tableName,
      description: spec.description,
      uniqueKeyColumns: spec.uniqueKeyColumns,
      duplicateAction: 'update'
    });
    console.log('OK:', spec.tableName);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
