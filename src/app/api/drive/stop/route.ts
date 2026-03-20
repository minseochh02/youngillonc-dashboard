/**
 * POST /api/drive/stop
 *
 * Stop the active Google Drive watch channel.
 *
 * Steps:
 * 1. Get current channel info from database
 * 2. Call drive.channels.stop()
 * 3. Clear channel fields in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '../../../../../egdesk-helpers';
import { createDriveClient } from '../../../../lib/google-drive-client';
import { getSyncState } from '../../../../lib/drive-webhook-processor';

export async function POST(req: NextRequest) {
  try {
    // Get current sync state
    const state = await getSyncState();
    if (!state) {
      return NextResponse.json(
        {
          error: 'Sync state not initialized'
        },
        { status: 400 }
      );
    }

    if (!state.channel_id || !state.channel_resource_id) {
      return NextResponse.json(
        {
          status: 'not_watching',
          message: 'No active watch channel to stop'
        }
      );
    }

    console.log(`🛑 Stopping watch channel: ${state.channel_id}`);

    // Stop the channel with Google
    const drive = createDriveClient();
    try {
      await drive.channels.stop({
        requestBody: {
          id: state.channel_id,
          resourceId: state.channel_resource_id
        }
      });
      console.log('✅ Channel stopped successfully');
    } catch (stopError: any) {
      // Channel may already be expired or invalid
      console.warn(`⚠️  Failed to stop channel (may already be expired): ${stopError.message}`);
    }

    // Clear channel info from database
    await executeSQL(`
      UPDATE drive_sync_state
      SET channel_id = NULL,
          channel_resource_id = NULL,
          channel_expiration = NULL,
          last_updated = '${new Date().toISOString()}'
      WHERE id = 1
    `);

    console.log('✅ Channel info cleared from database');

    return NextResponse.json({
      status: 'stopped',
      message: 'Watch channel stopped successfully',
      stoppedChannelId: state.channel_id
    });

  } catch (error: any) {
    console.error('❌ Error stopping watch channel:', error);
    return NextResponse.json(
      {
        error: 'Failed to stop watch channel',
        details: error.message
      },
      { status: 500 }
    );
  }
}
