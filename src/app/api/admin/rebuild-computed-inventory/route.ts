import { NextResponse } from 'next/server';
import { rebuildComputedInventoryMonthly, rebuildComputedInventoryDaily } from '@/lib/computed-inventory-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fromMonth = typeof body?.fromMonth === 'string' ? body.fromMonth : undefined;
    const result = await rebuildComputedInventoryMonthly(fromMonth);
    const dailyResult = await rebuildComputedInventoryDaily();
    return NextResponse.json({ success: true, result, dailyResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rebuild computed inventory';
    console.error('rebuild-computed-inventory error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
