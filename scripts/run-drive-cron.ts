/**
 * Google Drive Webhook Auto-Renewal Daemon
 *
 * Runs a cron job that automatically renews the watch channel before expiration.
 * Channels expire after 7 days, so this checks daily and renews if needed.
 */

import cron from 'node-cron';
import { getSyncState } from '../src/lib/drive-webhook-processor';

async function checkAndRenewChannel() {
  console.log(`\n🔍 [${new Date().toISOString()}] Checking watch channel status...`);

  try {
    const state = await getSyncState();

    if (!state) {
      console.log('⚠️  Sync state not initialized. Skipping renewal.');
      return;
    }

    if (!state.channel_id || !state.channel_expiration) {
      console.log('⚠️  No active watch channel. Skipping renewal.');
      return;
    }

    const expirationDate = new Date(state.channel_expiration);
    const now = new Date();
    const timeUntilExpiration = expirationDate.getTime() - now.getTime();
    const hoursUntilExpiration = timeUntilExpiration / (1000 * 60 * 60);

    console.log(`📅 Channel expires: ${expirationDate.toISOString()}`);
    console.log(`⏰ Time until expiration: ${Math.round(hoursUntilExpiration)} hours`);

    // Renew if expiring within 24 hours
    if (timeUntilExpiration < 24 * 60 * 60 * 1000) {
      console.log('🔄 Channel expires soon, renewing...');

      // Make API call to renew
      const baseUrl = process.env.DRIVE_WEBHOOK_BASE_URL?.replace(/^https?:\/\/[^/]+/, 'http://localhost:3000') || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/drive/watch`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Channel renewed successfully!');
        console.log(`   New expiration: ${result.expiration}`);
      } else {
        const error = await response.text();
        console.error('❌ Failed to renew channel:', error);
      }
    } else {
      console.log('✅ Channel is healthy, no renewal needed.');
    }

  } catch (error: any) {
    console.error('❌ Error checking channel status:', error.message);
  }
}

async function startCronDaemon() {
  console.log('🤖 Google Drive Watch Channel Auto-Renewal Daemon');
  console.log('================================================\n');
  console.log('📅 Schedule: Daily at 2:00 AM');
  console.log('🔄 Renews channels expiring within 24 hours');
  console.log('⏹️  Press Ctrl+C to stop\n');

  // Run immediately on startup
  console.log('🚀 Running initial check...');
  await checkAndRenewChannel();

  // Schedule daily check at 2 AM
  cron.schedule('0 2 * * *', async () => {
    await checkAndRenewChannel();
  });

  console.log('\n✅ Cron daemon started. Waiting for scheduled runs...\n');

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Shutting down cron daemon...');
    process.exit(0);
  });
}

// Run daemon
startCronDaemon().catch((error) => {
  console.error('❌ Daemon error:', error);
  process.exit(1);
});
