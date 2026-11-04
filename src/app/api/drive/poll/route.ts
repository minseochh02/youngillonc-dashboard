/**
 * POST /api/drive/poll
 *
 * Poll Google Drive for changes or control the background polling worker.
 *
 * Actions:
 * - action: 'poll' (default): Trigger a poll cycle immediately
 * - action: 'start': Start/resume background poller
 * - action: 'stop': Stop/pause background poller
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  triggerDrivePollNow,
  startDriveBackgroundPoller,
  stopDriveBackgroundPoller,
  getDrivePollerStatus
} from '../../../../lib/drive-poller';

export async function POST(req: NextRequest) {
  try {
    let action = 'poll';
    let intervalSeconds: number | undefined;

    // Check query params and JSON body if provided
    const searchParams = req.nextUrl.searchParams;
    if (searchParams.has('action')) {
      action = searchParams.get('action') || 'poll';
    }

    try {
      const body = await req.json();
      if (body.action) action = body.action;
      if (body.intervalSeconds) intervalSeconds = Number(body.intervalSeconds);
    } catch {
      // Body may be empty, which is fine
    }

    if (action === 'start') {
      startDriveBackgroundPoller({ intervalSeconds, runImmediate: true });
      return NextResponse.json({
        status: 'success',
        message: 'Drive background poller started',
        poller: getDrivePollerStatus()
      });
    }

    if (action === 'stop') {
      stopDriveBackgroundPoller();
      return NextResponse.json({
        status: 'success',
        message: 'Drive background poller stopped',
        poller: getDrivePollerStatus()
      });
    }

    // Default: Trigger poll now
    console.log('🔄 Triggering Drive change poll...');
    const pollRes = await triggerDrivePollNow();

    if (!pollRes.success) {
      return NextResponse.json(
        {
          status: 'error',
          error: pollRes.error || 'Failed to poll Drive changes',
          poller: getDrivePollerStatus()
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Polling complete',
      ...pollRes.result,
      poller: getDrivePollerStatus(),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error in /api/drive/poll:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to process drive poll request',
        details: error.message,
        poller: getDrivePollerStatus()
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/drive/poll
 *
 * Same as POST, for convenient browser / script testing
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
