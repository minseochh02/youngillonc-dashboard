import { NextResponse } from 'next/server';
import { loadFullDisplayOrderContext, mapToRecord } from '@/lib/display-order';

/**
 * Single JSON payload for browser tabs: office + B2C/B2B team/employee order keys.
 * Use with compareOffices / compareTeams / compareEmployees + recordToMap on the client if needed.
 */
export async function GET() {
  try {
    const ctx = await loadFullDisplayOrderContext();
    return NextResponse.json({
      success: true,
      office: mapToRecord(ctx.office),
      teamB2c: mapToRecord(ctx.teamB2c),
      teamB2b: mapToRecord(ctx.teamB2b),
      empB2c: mapToRecord(ctx.empB2c),
      empB2b: mapToRecord(ctx.empB2b),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('display-order bootstrap GET:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
