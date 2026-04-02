/**
 * POST /api/drive/poll
 *
 * Manually poll for Drive changes (no webhook needed).
 * Use this instead of webhooks if you don't want to set up a tunnel.
 *
 * Can be called:
 * - Manually: curl -X POST http://localhost:3000/api/drive/poll
 * - On a schedule: via cron job or Next.js cron (in production)
 */

import { NextRequest, NextResponse } from 'next/server';
import { processChanges } from '../../../../lib/drive-webhook-processor';

export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Polling for Drive changes...');

    const result = await processChanges();

    return NextResponse.json({
      status: 'success',
      message: 'Polling complete',
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error polling for changes:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to poll for changes',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/drive/poll
 *
 * Same as POST, for easier testing
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
