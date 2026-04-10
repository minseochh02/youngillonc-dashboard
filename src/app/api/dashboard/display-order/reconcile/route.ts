import { NextResponse } from 'next/server';
import { buildDisplayOrderReconcileReport } from '@/lib/display-order-reconcile';

/**
 * GET: compare employee_category vs office / team / employee display-order tables.
 * See DisplayOrderReconcileReport in `@/lib/display-order-reconcile`.
 */
export async function GET() {
  try {
    const data = await buildDisplayOrderReconcileReport();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('display-order reconcile GET:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
