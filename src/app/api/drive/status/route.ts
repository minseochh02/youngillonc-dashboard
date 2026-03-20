/**
 * GET /api/drive/status
 *
 * Check the status of the Google Drive webhook system:
 * - Current sync state
 * - Active watch channel info
 * - Recent file events
 * - Channel expiration status
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeSQL } from '../../../../../egdesk-helpers';
import { getSyncState, parseTargetFolderIds } from '../../../../lib/drive-webhook-processor';

export async function GET(req: NextRequest) {
  try {
    // Get sync state
    const state = await getSyncState();
    if (!state) {
      return NextResponse.json({
        status: 'not_initialized',
        message: 'Drive sync not initialized. Run GET /api/drive/init to set up.'
      });
    }

    // Parse target folders
    const targetFolderIds = parseTargetFolderIds(state);

    // Check channel status
    let channelStatus: 'active' | 'expired' | 'none' = 'none';
    let expiresIn: string | null = null;
    let timeUntilExpiration: number | null = null;

    if (state.channel_id && state.channel_resource_id && state.channel_expiration) {
      const expirationDate = new Date(state.channel_expiration);
      const now = new Date();
      timeUntilExpiration = expirationDate.getTime() - now.getTime();

      if (timeUntilExpiration > 0) {
        channelStatus = 'active';
        const daysLeft = Math.floor(timeUntilExpiration / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeUntilExpiration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        expiresIn = `${daysLeft}d ${hoursLeft}h`;
      } else {
        channelStatus = 'expired';
        expiresIn = 'expired';
      }
    }

    // Get recent file events (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentEventsResult = await executeSQL(`
      SELECT COUNT(*) as count
      FROM drive_file_events
      WHERE detected_at >= '${oneDayAgo}'
    `);
    const recentEventsCount = recentEventsResult.rows?.[0]?.count || 0;

    // Get total events
    const totalEventsResult = await executeSQL(`
      SELECT COUNT(*) as count
      FROM drive_file_events
    `);
    const totalEventsCount = totalEventsResult.rows?.[0]?.count || 0;

    // Get downloaded files count
    const downloadedResult = await executeSQL(`
      SELECT COUNT(*) as count
      FROM drive_file_events
      WHERE downloaded = 1
    `);
    const downloadedCount = downloadedResult.rows?.[0]?.count || 0;

    // Get latest event
    const latestEventResult = await executeSQL(`
      SELECT file_name, event_type, detected_at
      FROM drive_file_events
      ORDER BY detected_at DESC
      LIMIT 1
    `);
    const latestEvent = latestEventResult.rows?.[0] || null;

    // Build response
    return NextResponse.json({
      status: 'initialized',
      sync: {
        initialized: true,
        lastUpdated: state.last_updated,
        createdAt: state.created_at,
        targetFolders: targetFolderIds.length,
        targetFolderIds
      },
      channel: {
        status: channelStatus,
        channelId: state.channel_id || null,
        resourceId: state.channel_resource_id || null,
        expiration: state.channel_expiration || null,
        expiresIn,
        needsRenewal: timeUntilExpiration !== null && timeUntilExpiration < 24 * 60 * 60 * 1000 // < 24 hours
      },
      events: {
        total: totalEventsCount,
        last24Hours: recentEventsCount,
        downloaded: downloadedCount,
        latest: latestEvent
      },
      recommendations: getRecommendations(channelStatus, timeUntilExpiration)
    });

  } catch (error: any) {
    console.error('❌ Error getting status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get status',
        details: error.message
      },
      { status: 500 }
    );
  }
}

function getRecommendations(
  channelStatus: 'active' | 'expired' | 'none',
  timeUntilExpiration: number | null
): string[] {
  const recommendations: string[] = [];

  if (channelStatus === 'none') {
    recommendations.push('No active watch channel. Run POST /api/drive/watch to start monitoring.');
  } else if (channelStatus === 'expired') {
    recommendations.push('Watch channel has expired. Run POST /api/drive/watch to renew.');
  } else if (timeUntilExpiration !== null && timeUntilExpiration < 24 * 60 * 60 * 1000) {
    recommendations.push('Watch channel expires soon. Consider renewing with POST /api/drive/watch.');
  }

  return recommendations;
}
