/**
 * POST /api/drive/watch
 *
 * Register or renew a Google Drive watch channel for change notifications.
 *
 * Steps:
 * 1. Get current page token from database
 * 2. Call drive.changes.watch() with webhook URL
 * 3. Store channel info (ID, resource ID, expiration) in database
 *
 * Channel expires after 7 days and must be renewed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '../../../../../egdesk-helpers';
import { createDriveClient } from '../../../../lib/google-drive-client';
import { getSyncState } from '../../../../lib/drive-webhook-processor';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // Get current sync state
    const state = await getSyncState();
    if (!state) {
      return NextResponse.json(
        {
          error: 'Sync state not initialized. Run GET /api/drive/init first.'
        },
        { status: 400 }
      );
    }

    // Get webhook base URL from env
    const webhookBaseUrl = process.env.DRIVE_WEBHOOK_BASE_URL;
    if (!webhookBaseUrl) {
      return NextResponse.json(
        {
          error: 'DRIVE_WEBHOOK_BASE_URL not configured in .env.local'
        },
        { status: 500 }
      );
    }

    const webhookUrl = `${webhookBaseUrl}/api/drive/webhook`;

    // Generate unique channel ID
    const channelId = `drive-watch-${crypto.randomBytes(8).toString('hex')}`;

    console.log(`🔔 Registering watch channel: ${channelId}`);
    console.log(`📍 Webhook URL: ${webhookUrl}`);

    // Register watch channel with Google Drive
    const drive = createDriveClient();
    const response = await drive.changes.watch({
      pageToken: state.page_token,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        // Optional: add token for verification
        // token: 'optional-verification-token'
      }
    });

    const resourceId = response.data.resourceId;
    const expiration = response.data.expiration;

    if (!resourceId || !expiration) {
      throw new Error('Failed to get channel resource ID or expiration from Google');
    }

    // Convert expiration from milliseconds timestamp to ISO string
    const expirationDate = new Date(parseInt(expiration));
    const expirationIso = expirationDate.toISOString();

    console.log(`✅ Channel registered successfully`);
    console.log(`   Channel ID: ${channelId}`);
    console.log(`   Resource ID: ${resourceId}`);
    console.log(`   Expires: ${expirationIso}`);

    // Update database with channel info
    await executeSQL(`
      UPDATE drive_sync_state
      SET channel_id = '${channelId.replace(/'/g, "''")}',
          channel_resource_id = '${resourceId.replace(/'/g, "''")}',
          channel_expiration = '${expirationIso}',
          last_updated = '${new Date().toISOString()}'
      WHERE id = 1
    `);

    return NextResponse.json({
      status: 'watching',
      channelId,
      resourceId,
      expiration: expirationIso,
      expiresIn: `${Math.round((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`,
      webhookUrl,
      message: 'Watch channel registered successfully. Waiting for file changes...'
    });

  } catch (error: any) {
    console.error('❌ Error registering watch channel:', error);
    return NextResponse.json(
      {
        error: 'Failed to register watch channel',
        details: error.message
      },
      { status: 500 }
    );
  }
}
