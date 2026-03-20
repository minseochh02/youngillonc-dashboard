/**
 * Google Drive Watch Channel Auto-Renewal
 *
 * Runs a cron job to automatically renew the watch channel before expiration.
 * Channel expires after 7 days, so we check daily and renew if < 24 hours remain.
 */

import cron from 'node-cron';
import { getSyncState } from './drive-webhook-processor';

/**
 * Initialize the cron job for watch channel renewal
 *
 * Schedule: Daily at 2 AM
 * Action: Check expiration and renew if needed
 */
export function initializeDriveCron() {
  // Run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('\n🕐 [Drive Cron] Running daily channel check...');

    try {
      const state = await getSyncState();

      if (!state) {
        console.log('⚠️  [Drive Cron] Sync state not initialized, skipping check');
        return;
      }

      if (!state.channel_expiration) {
        console.log('⚠️  [Drive Cron] No active channel, skipping renewal');
        return;
      }

      const expirationDate = new Date(state.channel_expiration);
      const now = new Date();
      const timeUntilExpiration = expirationDate.getTime() - now.getTime();
      const hoursUntilExpiration = timeUntilExpiration / (1000 * 60 * 60);

      console.log(`📅 [Drive Cron] Channel expires in ${hoursUntilExpiration.toFixed(1)} hours`);

      // Renew if expiring within 24 hours
      if (timeUntilExpiration < 24 * 60 * 60 * 1000) {
        console.log('🔄 [Drive Cron] Channel expiring soon, renewing...');

        // Call the watch API to renew
        const webhookBaseUrl = process.env.DRIVE_WEBHOOK_BASE_URL;
        if (!webhookBaseUrl) {
          console.error('❌ [Drive Cron] DRIVE_WEBHOOK_BASE_URL not set, cannot renew');
          return;
        }

        const response = await fetch(`${webhookBaseUrl}/api/drive/watch`, {
          method: 'POST'
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ [Drive Cron] Channel renewed successfully until ${data.expiration}`);
        } else {
          const error = await response.text();
          console.error(`❌ [Drive Cron] Failed to renew channel: ${error}`);
        }
      } else {
        console.log('✅ [Drive Cron] Channel still valid, no renewal needed');
      }

    } catch (error: any) {
      console.error(`❌ [Drive Cron] Error during channel check: ${error.message}`);
    }
  });

  console.log('✅ Drive channel renewal cron job initialized (runs daily at 2 AM)');
}

/**
 * Manual trigger for testing
 * Call this function to immediately check and renew if needed
 */
export async function manuallyCheckAndRenew() {
  console.log('🔄 Manually checking channel expiration...');

  try {
    const state = await getSyncState();

    if (!state) {
      console.log('❌ Sync state not initialized');
      return { success: false, message: 'Sync state not initialized' };
    }

    if (!state.channel_expiration) {
      console.log('❌ No active channel');
      return { success: false, message: 'No active channel' };
    }

    const expirationDate = new Date(state.channel_expiration);
    const now = new Date();
    const timeUntilExpiration = expirationDate.getTime() - now.getTime();

    console.log(`Channel expires: ${expirationDate.toISOString()}`);
    console.log(`Time until expiration: ${Math.floor(timeUntilExpiration / (1000 * 60 * 60))} hours`);

    if (timeUntilExpiration < 24 * 60 * 60 * 1000) {
      console.log('⚠️  Channel expires soon, should renew');
      return { success: true, shouldRenew: true, expiresIn: timeUntilExpiration };
    } else {
      console.log('✅ Channel still valid');
      return { success: true, shouldRenew: false, expiresIn: timeUntilExpiration };
    }

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    return { success: false, message: error.message };
  }
}
