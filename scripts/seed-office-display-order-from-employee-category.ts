/**
 * Seed office_display_order from employee_category.전체사업소 values.
 * Run with: tsx scripts/seed-office-display-order-from-employee-category.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { insertRows, queryTable } from '../egdesk-helpers.ts';

const EXCLUDED_OFFICES = new Set(['동부&서부']);

function splitOfficeValues(value: unknown): string[] {
  if (value == null) return [];
  const text = String(value).trim();
  if (!text) return [];

  return text
    .split(/[\/,|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '-' && !EXCLUDED_OFFICES.has(part));
}

async function seedOfficeDisplayOrder() {
  try {
    console.log('Reading employee_category rows...');
    const result = await queryTable('employee_category', { limit: 10000 });
    const rows: Array<Record<string, unknown>> = result?.rows ?? [];

    const officeSet = new Set<string>();
    for (const row of rows) {
      const offices = splitOfficeValues(row['전체사업소']);
      for (const office of offices) {
        officeSet.add(office);
      }
    }

    const offices = Array.from(officeSet).sort((a, b) => a.localeCompare(b, 'ko'));
    if (offices.length === 0) {
      console.log('No 전체사업소 values found in employee_category.');
      return;
    }

    const seedRows = offices.map((office, index) => ({
      사업소: office,
      노출순서: index + 1
    }));

    console.log(`Seeding ${seedRows.length} offices into office_display_order...`);
    await insertRows('office_display_order', seedRows);
    console.log('✅ Seed completed.');
    console.log('Inserted/updated rows:', seedRows.length);
  } catch (error: any) {
    console.error('❌ Seed failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

seedOfficeDisplayOrder();
