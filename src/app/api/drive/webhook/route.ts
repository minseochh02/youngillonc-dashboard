/**
 * POST /api/drive/webhook
 *
 * Webhook endpoint for Google Drive change notifications.
 *
 * Google sends two types of notifications:
 * 1. 'sync' - Initial verification (must respond with 200 immediately)
 * 2. 'change' - File change occurred (fetch changes and process)
 *
 * IMPORTANT: Must respond within 10 seconds to avoid Google retries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSyncState } from '../../../../lib/drive-webhook-processor';
import { processChanges } from '../../../../lib/drive-webhook-processor';

export async function POST(req: NextRequest) {
  try {
    // Get Google notification headers
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceId = req.headers.get('x-goog-resource-id');
    const resourceState = req.headers.get('x-goog-resource-state');
    const channelExpiration = req.headers.get('x-goog-channel-expiration');

    console.log('📨 Webhook notification received:');
    console.log(`   State: ${resourceState}`);
    console.log(`   Channel ID: ${channelId}`);
    console.log(`   Resource ID: ${resourceId}`);

    // Verify channel ID matches our stored channel
    const state = await getSyncState();
    if (!state) {
      console.error('❌ Sync state not found');
      return NextResponse.json({ error: 'Sync state not initialized' }, { status: 400 });
    }

    if (channelId !== state.channel_id) {
      console.error(`❌ Channel ID mismatch: expected ${state.channel_id}, got ${channelId}`);
      return NextResponse.json({ error: 'Invalid channel ID' }, { status: 403 });
    }

    if (resourceId !== state.channel_resource_id) {
      console.error(`❌ Resource ID mismatch: expected ${state.channel_resource_id}, got ${resourceId}`);
      return NextResponse.json({ error: 'Invalid resource ID' }, { status: 403 });
    }

    // Handle 'sync' event (initial verification)
    if (resourceState === 'sync') {
      console.log('✅ Sync verification successful');
      return NextResponse.json({ status: 'ok', message: 'Sync acknowledged' });
    }

    // Handle 'change' event
    if (resourceState === 'change' || resourceState === 'update' || resourceState === 'add') {
      console.log('🔄 Change detected, processing...');

      // IMPORTANT: Respond quickly to Google (< 10 seconds)
      // Process changes asynchronously if needed
      // For now, we'll process synchronously since most operations are fast

      try {
        const result = await processChanges();
        console.log(`✅ Changes processed: ${result.changesProcessed} changes, ${result.filesLogged} files logged`);

        return NextResponse.json({
          status: 'processed',
          ...result
        });
      } catch (processingError: any) {
        console.error('❌ Error processing changes:', processingError);
        // Still return 200 to acknowledge receipt
        return NextResponse.json({
          status: 'acknowledged',
          message: 'Notification received, but processing failed',
          error: processingError.message
        });
      }
    }

    // Unknown resource state
    console.log(`⚠️  Unknown resource state: ${resourceState}`);
    return NextResponse.json({
      status: 'ok',
      message: 'Notification acknowledged'
    });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    // Return 200 even on error to avoid Google retries
    return NextResponse.json({
      status: 'error',
      message: 'Internal error, but notification acknowledged',
      error: error.message
    });
  }
}

/**
 * GET /api/drive/webhook
 *
 * Health check endpoint to verify webhook is accessible
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Drive webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}
