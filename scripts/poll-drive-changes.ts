/**
 * Polling-based Drive Monitor (No Webhook/Tunnel Required)
 *
 * Polls Google Drive API every N seconds for changes.
 * Alternative to webhook-based approach.
 */

import { processChanges } from '../src/lib/drive-webhook-processor';

const POLL_INTERVAL_SECONDS = 30; // Poll every 30 seconds

async function pollOnce() {
  console.log(`\n🔍 [${new Date().toISOString()}] Polling for changes...`);

  try {
    const result = await processChanges();
    console.log(`✅ Poll complete: ${result.changesProcessed} changes, ${result.filesLogged} files logged, ${result.filesDownloaded} downloaded`);
  } catch (error: any) {
    console.error('❌ Poll error:', error.message);
  }
}

async function startPolling() {
  console.log('🤖 Google Drive Polling Daemon');
  console.log('================================\n');
  console.log(`📅 Poll interval: Every ${POLL_INTERVAL_SECONDS} seconds`);
  console.log('⏹️  Press Ctrl+C to stop\n');

  // Initial poll
  await pollOnce();

  // Schedule periodic polling
  setInterval(pollOnce, POLL_INTERVAL_SECONDS * 1000);

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Stopping polling daemon...');
    process.exit(0);
  });
}

// Start polling
startPolling().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
