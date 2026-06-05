import { NextResponse } from 'next/server';
import { rebuildComputedInventoryMonthly } from '@/lib/computed-inventory-utils';

export async function POST() {
  try {
    const result = await rebuildComputedInventoryMonthly();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rebuild computed inventory';
    console.error('rebuild-computed-inventory error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
