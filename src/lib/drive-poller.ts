/**
 * Google Drive Background Poller Service
 *
 * Automatically starts when the Next.js server boots (via src/instrumentation.ts)
 * and continuously polls Google Drive for changes at regular intervals.
 */

import { executeSQL, insertRows, updateRows, listTables } from '../../egdesk-helpers';
import { createDriveClient, getStartPageToken } from './google-drive-client';
import { getSyncState, parseTargetFolderIds, processChanges } from './drive-webhook-processor';

export interface DrivePollerStatus {
  isRunning: boolean;
  intervalSeconds: number;
  lastPollTime: string | null;
  nextPollTime: string | null;
  lastResult: {
    changesProcessed: number;
    filesLogged: number;
    filesDownloaded: number;
  } | null;
  pollCount: number;
  errorCount: number;
  lastError: string | null;
  isPollingInProgress: boolean;
  startedAt: string | null;
}

interface InternalPollerState extends DrivePollerStatus {
  timerId: NodeJS.Timeout | null;
}

const GLOBAL_POLLER_KEY = Symbol.for('youngillonc.drive_poller');

function getGlobalState(): InternalPollerState {
  const globalAny = globalThis as any;
  if (!globalAny[GLOBAL_POLLER_KEY]) {
    const defaultInterval = parseInt(process.env.DRIVE_POLL_INTERVAL_SECONDS || '30', 10);
    globalAny[GLOBAL_POLLER_KEY] = {
      isRunning: false,
      intervalSeconds: Math.max(10, defaultInterval),
      lastPollTime: null,
      nextPollTime: null,
      lastResult: null,
      pollCount: 0,
      errorCount: 0,
      lastError: null,
      isPollingInProgress: false,
      startedAt: null,
      timerId: null,
    };
  }
  return globalAny[GLOBAL_POLLER_KEY];
}

/**
 * Ensure database tables exist and sync state is ready.
 * Auto-initializes if credentials and target folders are present in environment.
 */
async function ensureSyncStateReady(): Promise<boolean> {
  try {
    // Check if tables exist
    const tables = await listTables();
    const tableNames = tables.tables?.map((t: any) => t.tableName) || [];
    
    if (!tableNames.includes('drive_sync_state')) {
      console.log('⚠️ [Drive Poller] drive_sync_state table does not exist. Run /api/drive/init-tables first.');
      return false;
    }

    const state = await getSyncState();
    if (state && state.page_token) {
      return true;
    }

    // Attempt auto-initialization from env
    const envFolderIds = process.env.DRIVE_TARGET_FOLDER_IDS;
    if (!envFolderIds) {
      console.log('⚠️ [Drive Poller] Sync state not initialized and DRIVE_TARGET_FOLDER_IDS not set in env.');
      return false;
    }

    const targetFolderIds = envFolderIds.split(',').map(id => id.trim()).filter(Boolean);
    if (targetFolderIds.length === 0) {
      return false;
    }

    console.log(`🔄 [Drive Poller] Auto-initializing Drive sync with ${targetFolderIds.length} target folders...`);
    const drive = createDriveClient();
    const pageToken = await getStartPageToken(drive);
    const now = new Date().toISOString();
    const targetFolderIdsJson = JSON.stringify(targetFolderIds);

    const existingState = await executeSQL('SELECT id FROM drive_sync_state WHERE id = 1');
    if (existingState.rows && existingState.rows.length > 0) {
      await updateRows(
        'drive_sync_state',
        {
          page_token: pageToken,
          target_folder_ids: targetFolderIdsJson,
          last_updated: now
        },
        { filters: { id: '1' } }
      );
    } else {
      await insertRows('drive_sync_state', [
        {
          id: 1,
          page_token: pageToken,
          target_folder_ids: targetFolderIdsJson,
          last_updated: now,
          created_at: now
        }
      ]);
    }

    console.log('✅ [Drive Poller] Auto-initialized Drive sync state successfully.');
    return true;
  } catch (err: any) {
    console.error('❌ [Drive Poller] Failed during sync state check/init:', err.message);
    return false;
  }
}

/**
 * Execute a single polling cycle safely.
 */
export async function triggerDrivePollNow(): Promise<{
  success: boolean;
  result?: { changesProcessed: number; filesLogged: number; filesDownloaded: number };
  error?: string;
}> {
  const state = getGlobalState();

  if (state.isPollingInProgress) {
    console.log('⏳ [Drive Poller] A poll operation is already in progress. Skipping this trigger.');
    return { success: false, error: 'Poll already in progress' };
  }

  state.isPollingInProgress = true;
  try {
    const ready = await ensureSyncStateReady();
    if (!ready) {
      const msg = 'Drive sync state not ready or credentials missing.';
      state.lastError = msg;
      return { success: false, error: msg };
    }

    const result = await processChanges();
    const now = new Date();

    state.lastPollTime = now.toISOString();
    state.lastResult = result;
    state.pollCount += 1;
    state.lastError = null;

    if (state.isRunning && state.intervalSeconds > 0) {
      state.nextPollTime = new Date(now.getTime() + state.intervalSeconds * 1000).toISOString();
    }

    return { success: true, result };
  } catch (err: any) {
    state.errorCount += 1;
    state.lastError = err.message || 'Unknown error during polling';
    console.error(`❌ [Drive Poller] Error during poll: ${state.lastError}`);
    return { success: false, error: state.lastError || undefined };
  } finally {
    state.isPollingInProgress = false;
  }
}

/**
 * Start the background polling loop.
 * Safe to call multiple times (idempotent).
 */
export function startDriveBackgroundPoller(options?: {
  intervalSeconds?: number;
  runImmediate?: boolean;
}): void {
  if (process.env.DRIVE_POLLING_DISABLED === 'true') {
    console.log('ℹ️ [Drive Poller] Background polling is disabled by DRIVE_POLLING_DISABLED=true.');
    return;
  }

  const state = getGlobalState();

  if (options?.intervalSeconds) {
    state.intervalSeconds = Math.max(10, options.intervalSeconds);
  }

  if (state.isRunning && state.timerId) {
    console.log(`ℹ️ [Drive Poller] Background poller is already running (interval: ${state.intervalSeconds}s).`);
    return;
  }

  state.isRunning = true;
  state.startedAt = new Date().toISOString();
  console.log(`🚀 [Drive Poller] Starting background Drive polling loop (every ${state.intervalSeconds}s)...`);

  // Initial poll after a short warmup delay (e.g., 3s)
  const initialDelay = options?.runImmediate ? 500 : 3000;
  setTimeout(() => {
    if (state.isRunning) {
      void triggerDrivePollNow();
    }
  }, initialDelay);

  // Set recurring interval
  state.timerId = setInterval(() => {
    if (state.isRunning) {
      void triggerDrivePollNow();
    }
  }, state.intervalSeconds * 1000);
}

/**
 * Stop the background polling loop.
 */
export function stopDriveBackgroundPoller(): void {
  const state = getGlobalState();
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  state.isRunning = false;
  state.nextPollTime = null;
  console.log('🛑 [Drive Poller] Stopped background Drive polling loop.');
}

/**
 * Get current poller status for API and UI views.
 */
export function getDrivePollerStatus(): DrivePollerStatus {
  const state = getGlobalState();
  return {
    isRunning: state.isRunning,
    intervalSeconds: state.intervalSeconds,
    lastPollTime: state.lastPollTime,
    nextPollTime: state.nextPollTime,
    lastResult: state.lastResult,
    pollCount: state.pollCount,
    errorCount: state.errorCount,
    lastError: state.lastError,
    isPollingInProgress: state.isPollingInProgress,
    startedAt: state.startedAt,
  };
}
