/**
 * Next.js Server Startup Hook
 *
 * Runs once when the Next.js server boots (both dev & production).
 * Initializes background workers such as Google Drive polling.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startDriveBackgroundPoller } = await import('./lib/drive-poller');
      startDriveBackgroundPoller();
    } catch (err: any) {
      console.error('❌ Failed to initialize background workers in instrumentation:', err.message);
    }
  }
}
